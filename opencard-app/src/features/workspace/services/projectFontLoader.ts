import type { ProjectFontRegistry } from '../model/projectMetadata'
import { createProjectFontCssFamily } from '../model/projectFonts'

let generation = 0
let loadedFaces: FontFace[] = []
let readiness: Promise<ProjectFontLoadResult> = Promise.resolve({ current: true, errors: [] })

export type ProjectFontLoadError = {
  fontId: string
  source: string
  message: string
}

export type ProjectFontLoadResult = {
  current: boolean
  errors: readonly ProjectFontLoadError[]
}

function removeLoadedFaces(): void {
  if (typeof document !== 'undefined' && document.fonts) {
    for (const face of loadedFaces) document.fonts.delete(face)
  }
  loadedFaces = []
}

async function loadFonts(
  currentGeneration: number,
  fonts: ProjectFontRegistry | null | undefined,
  resolveAssetSrc: (source: string) => string,
): Promise<ProjectFontLoadResult> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) {
    return { current: currentGeneration === generation, errors: [] }
  }

  const errors: ProjectFontLoadError[] = []

  for (const [id, definition] of Object.entries(fonts ?? {})) {
    for (const faceDefinition of definition.faces) {
      try {
        const face = new FontFace(
          createProjectFontCssFamily(id),
          `url(${JSON.stringify(resolveAssetSrc(faceDefinition.source))})`,
          {
            weight: faceDefinition.weight ?? 'normal',
            style: faceDefinition.style ?? 'normal',
          },
        )
        await face.load()
        if (currentGeneration !== generation) return { current: false, errors: [] }
        document.fonts.add(face)
        loadedFaces.push(face)
      } catch (error) {
        if (currentGeneration !== generation) return { current: false, errors: [] }
        const message = error instanceof Error ? error.message : String(error)
        errors.push({ fontId: id, source: faceDefinition.source, message })
        console.error('[project-fonts] Failed to load font face', {
          id,
          source: faceDefinition.source,
          error,
        })
      }
    }
  }
  return { current: currentGeneration === generation, errors }
}

export function syncProjectFonts(
  fonts: ProjectFontRegistry | null | undefined,
  resolveAssetSrc: (source: string) => string,
): Promise<ProjectFontLoadResult> {
  generation += 1
  removeLoadedFaces()
  readiness = loadFonts(generation, fonts, resolveAssetSrc)
  return readiness
}

export function clearProjectFonts(): void {
  generation += 1
  removeLoadedFaces()
  readiness = Promise.resolve({ current: true, errors: [] })
}

export async function waitForProjectFonts(): Promise<void> {
  await readiness
  if (typeof document !== 'undefined' && document.fonts) await document.fonts.ready
}
