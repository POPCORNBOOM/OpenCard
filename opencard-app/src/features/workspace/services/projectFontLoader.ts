import type { ProjectFontRegistry } from '../model/projectMetadata'
import { createProjectFontCssFamily } from '../model/projectFonts'
import { reportAppError } from '../../logging/appErrorCatalog'

let generation = 0
let projectFontStyle: HTMLStyleElement | null = null
let readiness: Promise<ProjectFontLoadResult> = Promise.resolve({ current: true, errors: [] })
const PROJECT_FONT_STYLE_ATTRIBUTE = 'data-opencard-project-fonts'

export type ProjectFontLoadError = {
  fontId: string
  source: string
  message: string
}

export type ProjectFontLoadResult = {
  current: boolean
  errors: readonly ProjectFontLoadError[]
}

function removeProjectFontStyle(): void {
  projectFontStyle?.remove()
  projectFontStyle = null
  if (typeof document !== 'undefined') {
    document.querySelectorAll(`style[${PROJECT_FONT_STYLE_ATTRIBUTE}]`).forEach(style => style.remove())
  }
}

function createProjectFontCss(
  fonts: ProjectFontRegistry | null | undefined,
  resolveAssetSrc: (source: string) => string,
): string {
  return Object.entries(fonts ?? {}).flatMap(([id, definition]) =>
    definition.faces.map(face => {
      const family = JSON.stringify(createProjectFontCssFamily(id))
      const source = JSON.stringify(resolveAssetSrc(face.source))
      const weight = face.weight ?? 'normal'
      const style = face.style ?? 'normal'
      return `@font-face { font-family: ${family}; src: url(${source}); font-weight: ${weight}; font-style: ${style}; }`
    })
  ).join('\n')
}

function replaceProjectFontStyle(cssText: string): void {
  if (typeof document === 'undefined' || !document.head || !cssText) {
    removeProjectFontStyle()
    return
  }
  const nextStyle = document.createElement('style')
  nextStyle.setAttribute(PROJECT_FONT_STYLE_ATTRIBUTE, '')
  nextStyle.textContent = cssText
  document.head.appendChild(nextStyle)
  document.querySelectorAll(`style[${PROJECT_FONT_STYLE_ATTRIBUTE}]`).forEach(style => {
    if (style !== nextStyle) style.remove()
  })
  projectFontStyle = nextStyle
}

async function loadFonts(
  currentGeneration: number,
  fonts: ProjectFontRegistry | null | undefined,
): Promise<ProjectFontLoadResult> {
  if (typeof document === 'undefined' || !document.fonts) {
    return { current: currentGeneration === generation, errors: [] }
  }

  const errors: ProjectFontLoadError[] = []

  for (const [id, definition] of Object.entries(fonts ?? {})) {
    for (const faceDefinition of definition.faces) {
      try {
        const loadedFaces = await document.fonts.load(
          `${faceDefinition.style ?? 'normal'} ${faceDefinition.weight ?? 'normal'} 16px ${JSON.stringify(createProjectFontCssFamily(id))}`,
        )
        if (currentGeneration !== generation) return { current: false, errors: [] }
        if (loadedFaces.length === 0) throw new Error('Font face did not load')
      } catch (error) {
        if (currentGeneration !== generation) return { current: false, errors: [] }
        const message = error instanceof Error ? error.message : String(error)
        errors.push({ fontId: id, source: faceDefinition.source, message })
        reportAppError('OC-E3005', {
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
  replaceProjectFontStyle(createProjectFontCss(fonts, resolveAssetSrc))
  readiness = loadFonts(generation, fonts)
  return readiness
}

export function clearProjectFonts(): void {
  generation += 1
  removeProjectFontStyle()
  readiness = Promise.resolve({ current: true, errors: [] })
}

export async function waitForProjectFonts(): Promise<void> {
  await readiness
  if (typeof document !== 'undefined' && document.fonts) await document.fonts.ready
}
