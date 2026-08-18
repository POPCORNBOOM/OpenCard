import type { ProjectIcon, ProjectIconSeries } from '../model/projectIcons'
import type { ProjectIconCatalogEntry } from './projectIconCatalog'

export type ProjectCustomBlockIconAtlas = {
  bytes: Uint8Array
  width: number
  height: number
  icons: readonly ProjectIcon[]
}

type Placement = { entry: ProjectIconCatalogEntry; x: number; y: number }

function iconSourceMimeType(source: string): string {
  const extension = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(source)?.[1]?.toLowerCase()
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  return 'application/octet-stream'
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not decode custom block icon source'))
    image.src = src
  })
}

function canvasPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(async blob => {
        if (!blob) {
          reject(new Error('Could not encode custom block icon atlas'))
          return
        }
        resolve(new Uint8Array(await blob.arrayBuffer()))
      }, 'image/png')
    } catch {
      reject(new Error('Could not encode custom block icon atlas'))
    }
  })
}

export async function composeProjectCustomBlockIconAtlas(
  entries: readonly ProjectIconCatalogEntry[],
  loadSourceBytes: (entry: ProjectIconCatalogEntry) => Promise<Uint8Array>,
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
  const images = new Map<string, { image: HTMLImageElement; objectUrl: string }>()
  try {
    for (const placement of placements) {
      let loaded = images.get(placement.entry.src)
      if (!loaded) {
        const bytes = await loadSourceBytes(placement.entry)
        const objectUrl = URL.createObjectURL(new Blob([bytes], {
          type: iconSourceMimeType(placement.entry.source),
        }))
        try {
          loaded = { image: await loadImage(objectUrl), objectUrl }
          images.set(placement.entry.src, loaded)
        } catch (cause) {
          URL.revokeObjectURL(objectUrl)
          throw cause
        }
      }
      context.drawImage(
        loaded.image,
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
  } finally {
    for (const { objectUrl } of images.values()) URL.revokeObjectURL(objectUrl)
  }
}

export function createProjectCustomBlockIconSeries(options: {
  packageKey: string
  source: string
  icons: readonly ProjectIcon[]
}): ProjectIconSeries {
  return {
    name: options.packageKey,
    key: 'icons',
    source: options.source,
    icons: options.icons,
  }
}
