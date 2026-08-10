use notify::{Event, EventKind, RecursiveMode, Watcher};
use std::collections::BTreeSet;
use std::path::Path;
use std::process::Command;
use std::sync::Mutex;
use tauri::{Emitter, State};

#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL};

mod external_open;
mod icon_spritesheet;
mod version_history;

// 存储 watcher 的全局状态
struct WatcherState {
    watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn list_system_font_families() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut database = fontdb::Database::new();
        database.load_system_fonts();
        database
            .faces()
            .flat_map(|face| face.families.iter().map(|(name, _language)| name.trim()))
            .filter(|name| !name.is_empty() && !name.starts_with('@'))
            .map(str::to_owned)
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect()
    })
    .await
    .map_err(|error| format!("Failed to enumerate system fonts: {error}"))
}

#[tauri::command]
fn watch_directory(
    path: String,
    app_handle: tauri::AppHandle,
    state: State<WatcherState>,
) -> Result<String, String> {
    // 停止之前的监听
    let mut watcher_lock = state.watcher.lock().unwrap();
    *watcher_lock = None;

    // 创建新的 watcher
    let (tx, rx) = std::sync::mpsc::channel::<Result<Event, notify::Error>>();

    let mut watcher =
        notify::recommended_watcher(tx).map_err(|e| format!("创建监听器失败: {}", e))?;

    watcher
        .watch(std::path::Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| format!("监听目录失败: {}", e))?;

    // 在新线程中处理文件变化事件
    let app_handle_clone = app_handle.clone();
    std::thread::spawn(move || {
        for res in rx {
            match res {
                Ok(event) => {
                    // 过滤掉一些不重要的事件
                    match event.kind {
                        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) => {
                            let paths: Vec<String> = event
                                .paths
                                .iter()
                                .map(|p| p.to_string_lossy().to_string())
                                .collect();

                            let payload = serde_json::json!({
                                "kind": format!("{:?}", event.kind),
                                "paths": paths
                            });

                            // 发送事件到前端
                            if let Err(e) = app_handle_clone.emit("file-changed", payload) {
                                eprintln!("发送事件失败: {}", e);
                            }
                        }
                        _ => {} // 忽略其他事件
                    }
                }
                Err(e) => eprintln!("监听错误: {}", e),
            }
        }
    });

    // 保存 watcher（防止被 drop）
    *watcher_lock = Some(watcher);

    Ok(format!("开始监听: {}", path))
}

#[tauri::command]
fn stop_watching(state: State<WatcherState>) -> Result<String, String> {
    let mut watcher_lock = state.watcher.lock().unwrap();
    *watcher_lock = None;
    Ok("停止监听".to_string())
}

#[tauri::command]
fn trash_path(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    std::fs::symlink_metadata(target)
        .map_err(|error| format!("Cannot trash '{}': {}", path, error))?;
    trash::delete(target).map_err(|error| format!("Failed to move '{}' to trash: {}", path, error))
}

#[cfg(target_os = "windows")]
fn create_windows_reveal_command(target: &Path, is_directory: bool) -> Command {
    let mut command = Command::new("explorer.exe");
    let windows_path = target.to_string_lossy().replace('/', "\\");
    if is_directory {
        command.arg(windows_path);
    } else {
        command.arg(format!("/select,{}", windows_path));
    }
    command
}

#[tauri::command]
fn reveal_path(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    let metadata = std::fs::symlink_metadata(target)
        .map_err(|error| format!("Cannot reveal '{}': {}", path, error))?;

    #[cfg(target_os = "windows")]
    let mut command = create_windows_reveal_command(target, metadata.is_dir());

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg("-R").arg(target);
        command
    };

    #[cfg(target_os = "linux")]
    let mut command = {
        let directory = if metadata.is_dir() {
            target
        } else {
            target
                .parent()
                .ok_or_else(|| format!("Cannot resolve parent directory for '{}'", path))?
        };
        let mut command = Command::new("xdg-open");
        command.arg(directory);
        command
    };

    command
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Failed to reveal '{}': {}", path, error))
}

#[cfg(target_os = "windows")]
fn open_with_default_app(target: &Path) -> Result<(), String> {
    let operation = std::ffi::OsStr::new("open")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let target_path = target
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            operation.as_ptr(),
            target_path.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    };
    if result as isize <= 32 {
        return Err(format!(
            "ShellExecuteW failed with code {}",
            result as isize
        ));
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn open_with_default_app(target: &Path) -> Result<(), String> {
    Command::new("open")
        .arg(target)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "linux")]
fn open_with_default_app(target: &Path) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(target)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    std::fs::symlink_metadata(target)
        .map_err(|error| format!("Cannot open '{}': {}", path, error))?;

    open_with_default_app(target).map_err(|error| format!("Failed to open '{}': {}", path, error))
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::*;

    #[test]
    fn explorer_select_switch_and_path_are_one_argument() {
        let target = Path::new("D:/My Cards/main.ocdocument");
        let command = create_windows_reveal_command(target, false);

        let arguments: Vec<_> = command.get_args().collect();
        assert_eq!(arguments, [r"/select,D:\My Cards\main.ocdocument"]);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder =
        tauri::Builder::default().manage(external_open::ExternalOpenState::from_current_process());

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
        external_open::enqueue_arguments(app, args, cwd);
    }));

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(WatcherState {
            watcher: Mutex::new(None),
        })
        .manage(version_history::VersionHistoryState::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            list_system_font_families,
            watch_directory,
            stop_watching,
            trash_path,
            reveal_path,
            open_path,
            external_open::take_external_open_requests,
            icon_spritesheet::compose_project_icon_spritesheet,
            version_history::version_prepare_project,
            version_history::repository::version_get_status,
            version_history::repository::version_create,
            version_history::repository::version_list,
            version_history::repository::version_list_file_history,
            version_history::repository::version_publish,
            version_history::repository::version_edit_release_description,
            version_history::repository::version_preview_restore,
            version_history::repository::version_restore_project,
            version_history::compare::version_prepare_compare,
            version_history::compare::version_release_compare,
            version_history::repository::version_preview_changes,
            version_history::local_history::local_history_record,
            version_history::local_history::local_history_list,
            version_history::local_history::local_history_read,
            version_history::local_history::local_history_delete,
            version_history::local_history::local_history_find_files,
            version_history::local_history::local_history_move,
            version_history::local_history::local_history_restore,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                let paths = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .map(|path| path.to_string_lossy().replace('\\', "/"))
                    .collect();
                external_open::enqueue_paths(_app, paths);
            }
        });
}
