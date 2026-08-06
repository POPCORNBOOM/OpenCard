use std::io::Cursor;

use image::{imageops, DynamicImage, ImageFormat, RgbaImage};
use image_atlas::{solve_offline, RequestRect};
use serde::{Deserialize, Serialize};

const DEFAULT_MAX_SIDE: u32 = 8192;
const MAX_SOURCE_IMAGES: usize = 2048;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComposeRequest {
    pub images: Vec<SourceImage>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceImage {
    pub path: String,
    pub name: String,
    pub icon_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComposeResult {
    pub bytes: Vec<u8>,
    pub width: u32,
    pub height: u32,
    pub icons: Vec<GeneratedIcon>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedIcon {
    pub icon_key: String,
    pub name: String,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pixelated: Option<bool>,
}

struct LoadedImage {
    source: SourceImage,
    bitmap: RgbaImage,
}

#[tauri::command]
pub async fn compose_project_icon_spritesheet(
    request: ComposeRequest,
) -> Result<ComposeResult, String> {
    tauri::async_runtime::spawn_blocking(move || compose(request))
        .await
        .map_err(|error| format!("Icon spritesheet task failed: {error}"))?
}

fn compose(request: ComposeRequest) -> Result<ComposeResult, String> {
    if request.images.is_empty() {
        return Err("At least one source image is required".to_string());
    }
    if request.images.len() > MAX_SOURCE_IMAGES {
        return Err(format!(
            "At most {MAX_SOURCE_IMAGES} source images are supported"
        ));
    }
    let mut images = Vec::with_capacity(request.images.len());
    for source in request.images {
        if source.name.trim().is_empty() || source.icon_key.trim().is_empty() {
            return Err("Every source image must have a name and icon key".to_string());
        }
        let bytes = std::fs::read(&source.path)
            .map_err(|error| format!("Could not read '{}': {error}", source.path))?;
        let bitmap = image::load_from_memory(&bytes)
            .map_err(|error| format!("Could not decode '{}': {error}", source.path))?
            .to_rgba8();
        if bitmap.width() == 0 || bitmap.height() == 0 {
            return Err(format!("Image '{}' has invalid dimensions", source.path));
        }
        images.push(LoadedImage { source, bitmap });
    }

    let requests: Vec<RequestRect> = images
        .iter()
        .enumerate()
        .map(|(id, image)| RequestRect {
            id,
            width: image.bitmap.width(),
            height: image.bitmap.height(),
        })
        .collect();
    let lower_bound = lower_bound(&requests);
    if lower_bound > DEFAULT_MAX_SIDE {
        return Err("The selected images are too large to fit the spritesheet limit".to_string());
    }

    let mut low = lower_bound;
    let mut high = DEFAULT_MAX_SIDE;
    if solve_one(&requests, high).is_none() {
        return Err("The selected images could not be packed into one spritesheet".to_string());
    }
    while low < high {
        let middle = low + (high - low) / 2;
        if solve_one(&requests, middle).is_some() {
            high = middle;
        } else {
            low = middle + 1;
        }
    }
    let bin = solve_one(&requests, low)
        .ok_or_else(|| "The selected images could not be packed".to_string())?;
    let width = bin
        .occupied_rects
        .iter()
        .map(|item| item.rect.x + item.rect.width)
        .max()
        .unwrap_or(0);
    let height = bin
        .occupied_rects
        .iter()
        .map(|item| item.rect.y + item.rect.height)
        .max()
        .unwrap_or(0);
    let mut atlas = RgbaImage::new(width, height);
    let mut icons = Vec::with_capacity(images.len());

    for occupied in bin.occupied_rects {
        let image = &images[occupied.id];
        let source = image.bitmap.clone();
        imageops::replace(
            &mut atlas,
            &source,
            occupied.rect.x as i64,
            occupied.rect.y as i64,
        );
        let short_side = image.bitmap.width().min(image.bitmap.height());
        icons.push(GeneratedIcon {
            icon_key: image.source.icon_key.clone(),
            name: image.source.name.clone(),
            x: occupied.rect.x,
            y: occupied.rect.y,
            width: occupied.rect.width,
            height: occupied.rect.height,
            pixelated: (short_side < 32).then_some(true),
        });
    }
    icons.sort_by_key(|icon| request_index(&images, &icon.icon_key));

    let mut bytes = Cursor::new(Vec::new());
    DynamicImage::ImageRgba8(atlas)
        .write_to(&mut bytes, ImageFormat::Png)
        .map_err(|error| format!("Could not encode spritesheet: {error}"))?;
    Ok(ComposeResult {
        bytes: bytes.into_inner(),
        width,
        height,
        icons,
    })
}

fn request_index(images: &[LoadedImage], icon_key: &str) -> usize {
    images
        .iter()
        .position(|image| image.source.icon_key == icon_key)
        .unwrap_or(usize::MAX)
}

fn lower_bound(requests: &[RequestRect]) -> u32 {
    let largest = requests
        .iter()
        .map(|request| request.width.max(request.height))
        .max()
        .unwrap_or(1);
    let area = requests
        .iter()
        .map(|request| u64::from(request.width) * u64::from(request.height))
        .sum::<u64>();
    let square = (area as f64).sqrt().ceil() as u32;
    largest.max(square)
}

fn solve_one(requests: &[RequestRect], side: u32) -> Option<image_atlas::Bin> {
    let mut bins = solve_offline(requests, side, side, false)?;
    if bins.len() == 1 {
        bins.pop()
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};

    #[test]
    fn composes_png_and_marks_small_sources_as_pixelated() {
        let path = std::env::temp_dir().join(format!(
            "opencard-icon-spritesheet-{}-{}.png",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let image = ImageBuffer::from_pixel(8, 16, Rgba([255u8, 0, 0, 255]));
        image.save_with_format(&path, ImageFormat::Png).unwrap();

        let result = compose(ComposeRequest {
            images: vec![SourceImage {
                path: path.to_string_lossy().into_owned(),
                name: "Small".to_string(),
                icon_key: "small".to_string(),
            }],
        })
        .unwrap();

        assert_eq!(result.width * result.height, 8 * 16);
        assert_eq!(result.icons[0].width * result.icons[0].height, 8 * 16);
        assert_eq!(result.icons[0].pixelated, Some(true));
        assert!(result.bytes.starts_with(b"\x89PNG\r\n\x1a\n"));
        std::fs::remove_file(path).unwrap();
    }
}
