import type { ProjectCustomBlockCatalog } from '../model/projectCustomBlocks'
import { createProjectCustomBlockFontFamily } from './projectCustomBlockResources'

type LoadedFont = { face: FontFace; url: string }
let loadedFonts: LoadedFont[] = []

export type ProjectCustomBlockFontRuntime = {
  createObjectUrl: (blob: Blob) => string
  revokeObjectUrl: (url: string) => void
  createFontFace: (family: string, source: string) => FontFace
  addFont: (face: FontFace) => void
  deleteFont: (face: FontFace) => void
}

function defaultRuntime(): ProjectCustomBlockFontRuntime | null {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !document.fonts) return null
  return {
    createObjectUrl: blob => URL.createObjectURL(blob),
    revokeObjectUrl: url => URL.revokeObjectURL(url),
    createFontFace: (family, source) => new FontFace(family, source),
    addFont: face => document.fonts.add(face),
    deleteFont: face => document.fonts.delete(face),
  }
}

export function clearProjectCustomBlockFonts(runtime = defaultRuntime()): void {
  if (runtime) {
    for (const loaded of loadedFonts) {
      runtime.deleteFont(loaded.face)
      runtime.revokeObjectUrl(loaded.url)
    }
  }
  loadedFonts = []
}

export async function syncProjectCustomBlockFonts(
  catalog: ProjectCustomBlockCatalog,
  runtime = defaultRuntime(),
): Promise<void> {
  clearProjectCustomBlockFonts(runtime)
  if (!runtime) return
  const next: LoadedFont[] = []
  try {
    for (const entry of catalog.values()) {
      for (const font of entry.manifest.resources?.fonts ?? []) {
        const bytes = entry.files.get(font.source)
        if (!bytes) throw new Error(`Custom block font resource is missing: ${font.source}`)
        const url = runtime.createObjectUrl(new Blob([bytes]))
        const family = createProjectCustomBlockFontFamily(entry.manifest.key, font.key)
        const face = runtime.createFontFace(family, `url(${JSON.stringify(url)})`)
        await face.load()
        runtime.addFont(face)
        next.push({ face, url })
      }
    }
    loadedFonts = next
  } catch (error) {
    for (const loaded of next) {
      runtime.deleteFont(loaded.face)
      runtime.revokeObjectUrl(loaded.url)
    }
    throw error
  }
}
