import type { ProjectCustomBlockCatalog } from '../model/projectCustomBlocks'
import { createProjectCustomBlockFontFamily } from './projectCustomBlockResources'
import { findProjectCustomBlockFile } from './projectCustomBlock'

type LoadedFont = { face: FontFace; url: string }

export type ProjectCustomBlockFontLoadError = {
  packageKey: string
  fontKey: string
  source: string
  reason: 'load-failed'
}

export type ProjectCustomBlockFontSession = {
  errors: readonly ProjectCustomBlockFontLoadError[]
  release: () => void
}

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

function fontMimeForPath(path: string): string {
  if (/\.woff2$/i.test(path)) return 'font/woff2'
  if (/\.woff$/i.test(path)) return 'font/woff'
  if (/\.otf$/i.test(path)) return 'font/otf'
  if (/\.ttf$/i.test(path)) return 'font/ttf'
  return 'application/octet-stream'
}

export async function createProjectCustomBlockFontSession(
  catalog: ProjectCustomBlockCatalog,
  runtime = defaultRuntime(),
): Promise<ProjectCustomBlockFontSession> {
  if (!runtime) return { errors: [], release: () => undefined }
  const next: LoadedFont[] = []
  const errors: ProjectCustomBlockFontLoadError[] = []
  for (const entry of catalog.values()) {
    for (const font of entry.manifest.resources?.fonts ?? []) {
      let url: string | null = null
      let face: FontFace | null = null
      try {
        const bytes = findProjectCustomBlockFile(entry.files, font.source)
        if (!bytes) throw new Error(`Custom block font resource is missing: ${font.source}`)
        url = runtime.createObjectUrl(new Blob([bytes.slice().buffer], { type: fontMimeForPath(font.source) }))
        const family = createProjectCustomBlockFontFamily(entry.manifest.key, font.key)
        face = runtime.createFontFace(family, `url(${JSON.stringify(url)})`)
        await face.load()
        runtime.addFont(face)
        next.push({ face, url })
      } catch {
        if (face) runtime.deleteFont(face)
        if (url) runtime.revokeObjectUrl(url)
        errors.push({
          packageKey: entry.manifest.key,
          fontKey: font.key,
          source: font.source,
          reason: 'load-failed',
        })
      }
    }
  }
  let released = false
  return {
    errors,
    release: () => {
      if (released) return
      released = true
      for (const loaded of next) {
        runtime.deleteFont(loaded.face)
        runtime.revokeObjectUrl(loaded.url)
      }
    },
  }
}
