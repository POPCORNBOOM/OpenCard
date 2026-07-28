import type { ProjectFontRegistry } from '../model/projectMetadata'
import { createProjectFontReference } from '../model/projectFonts'

let generation = 0
let loadedFaces: FontFace[] = []
let readiness: Promise<void> = Promise.resolve()

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
): Promise<void> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return

  for (const [id, definition] of Object.entries(fonts ?? {})) {
    for (const faceDefinition of definition.faces) {
      try {
        const face = new FontFace(
          createProjectFontReference(id),
          `url(${JSON.stringify(resolveAssetSrc(faceDefinition.source))})`,
          {
            weight: faceDefinition.weight ?? 'normal',
            style: faceDefinition.style ?? 'normal',
          },
        )
        await face.load()
        if (currentGeneration !== generation) return
        document.fonts.add(face)
        loadedFaces.push(face)
      } catch (error) {
        console.error('[project-fonts] Failed to load font face', {
          id,
          source: faceDefinition.source,
          error,
        })
      }
    }
  }
}

export function syncProjectFonts(
  fonts: ProjectFontRegistry | null | undefined,
  resolveAssetSrc: (source: string) => string,
): Promise<void> {
  generation += 1
  removeLoadedFaces()
  readiness = loadFonts(generation, fonts, resolveAssetSrc)
  return readiness
}

export function clearProjectFonts(): void {
  generation += 1
  removeLoadedFaces()
  readiness = Promise.resolve()
}

export async function waitForProjectFonts(): Promise<void> {
  await readiness
  if (typeof document !== 'undefined' && document.fonts) await document.fonts.ready
}
