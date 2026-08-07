import type { ProjectIcon, ProjectIconSeries } from '../model/projectIcons'
import type { ProjectIconCatalogEntry } from './projectIconCatalog'

export type ProjectCustomBlockIconAtlas = {
  bytes: Uint8Array
  width: number
  height: number
  icons: readonly ProjectIcon[]
}

type Placement = { entry: ProjectIconCatalogEntry; x: number; y: number }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load custom block icon source: ${src}`))
    image.src = src
  })
}

function canvasPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => canvas.toBlob(async blob => {
    if (!blob) {
      reject(new Error('Could not encode custom block icon atlas'))
      return
    }
    resolve(new Uint8Array(await blob.arrayBuffer()))
  }, 'image/png'))
}

export async function composeProjectCustomBlockIconAtlas(
  entries: readonly ProjectIconCatalogEntry[],
): Promise<ProjectCustomBlockIconAtlas> {
  if (entries.length === 0) throw new Error('Custom block icon atlas is empty')
  const targetRowWidth = Math.max(
    ...entries.map(entry => entry.width),
    Math.ceil(Math.sqrt(entries.reduce((sum, entry) => sum + entry.width * entry.height, 0))),
  )
  const placements: Placement[] = []
  let x = 0
  let y = 0
  let rowHeight = 0
  let width = 0
  for (const entry of entries) {
    if (x > 0 && x + entry.width > targetRowWidth) {
      y += rowHeight
      x = 0
      rowHeight = 0
    }
    placements.push({ entry, x, y })
    x += entry.width
    width = Math.max(width, x)
    rowHeight = Math.max(rowHeight, entry.height)
  }
  const height = y + rowHeight
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Custom block icon atlas canvas is unavailable')
  const images = new Map<string, HTMLImageElement>()
  for (const placement of placements) {
    let image = images.get(placement.entry.src)
    if (!image) {
      image = await loadImage(placement.entry.src)
      images.set(placement.entry.src, image)
    }
    context.drawImage(
      image,
      placement.entry.x,
      placement.entry.y,
      placement.entry.width,
      placement.entry.height,
      placement.x,
      placement.y,
      placement.entry.width,
      placement.entry.height,
    )
  }
  return {
    bytes: await canvasPngBytes(canvas),
    width,
    height,
    icons: placements.map(({ entry, x, y }, index) => ({
      iconKey: `icon-${index + 1}`,
      name: entry.name,
      x,
      y,
      width: entry.width,
      height: entry.height,
      ...(entry.pixelated !== undefined ? { pixelated: entry.pixelated } : {}),
      ...(entry.rotation !== undefined ? { rotation: entry.rotation } : {}),
      ...(entry.atlasRotation !== undefined ? { atlasRotation: entry.atlasRotation } : {}),
    })),
  }
}

export function createProjectCustomBlockIconSeries(options: {
  packageKey: string
  source: string
  icons: readonly ProjectIcon[]
}): ProjectIconSeries {
  return {
    name: options.packageKey,
    key: `ocblock-${options.packageKey}`,
    source: options.source,
    icons: options.icons,
  }
}
