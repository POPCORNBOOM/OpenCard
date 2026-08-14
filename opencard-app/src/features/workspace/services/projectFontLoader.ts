import type {
  NumericRange,
  ProjectFontComposition,
  ProjectFontFace,
  ProjectFontFamily,
  ProjectFontFaceStyle,
  UnicodeRange,
} from '../model/projectFontRegistry'
import {
  createProjectFontCompositionCssFamily,
  createProjectFontFamilyCssFamily,
  setProjectFonts,
} from '../model/projectFonts'
import {
  characterSetToUnicodeRanges,
  mergeUnicodeRanges,
  subtractUnicodeRanges,
} from './projectFontCoverage'
import { reportAppError } from '../../logging/appErrorCatalog'

let generation = 0
let projectFontStyle: HTMLStyleElement | null = null
let readiness: Promise<ProjectFontLoadResult> = Promise.resolve({ current: true, errors: [] })
const PROJECT_FONT_STYLE_ATTRIBUTE = 'data-opencard-project-fonts'

export type ProjectFontLoadError = {
  familyKey: string
  source: string
  message: string
}

export type ProjectFontLoadResult = {
  current: boolean
  errors: readonly ProjectFontLoadError[]
}

export type ProjectFontCharacterSetLoader = (source: string) => Promise<ReadonlySet<number>>

function removeProjectFontStyle(): void {
  projectFontStyle?.remove()
  projectFontStyle = null
  if (typeof document !== 'undefined') {
    document.querySelectorAll(`style[${PROJECT_FONT_STYLE_ATTRIBUTE}]`).forEach(style => style.remove())
  }
}

function cssRange(value: NumericRange, suffix = ''): string {
  return value.min === value.max ? `${value.min}${suffix}` : `${value.min}${suffix} ${value.max}${suffix}`
}

function cssStyle(value: ProjectFontFaceStyle): string {
  if (value.kind !== 'oblique') return value.kind
  return `oblique ${cssRange(value.angle, 'deg')}`
}

function cssUnicodeRanges(ranges: readonly UnicodeRange[]): string {
  return ranges.map(range => range.start === range.end
    ? `U+${range.start.toString(16).toUpperCase()}`
    : `U+${range.start.toString(16).toUpperCase()}-${range.end.toString(16).toUpperCase()}`)
    .join(', ')
}

function faceDescriptorKey(face: ProjectFontFace): string {
  return JSON.stringify([face.weight, face.stretch, face.style])
}

function createFaceRule(
  cssFamily: string,
  face: ProjectFontFace,
  source: string,
  unicodeRanges?: readonly UnicodeRange[],
): string {
  const descriptors = [
    `font-family: ${JSON.stringify(cssFamily)}`,
    `src: url(${JSON.stringify(source)})`,
    `font-weight: ${cssRange(face.weight)}`,
    `font-stretch: ${cssRange(face.stretch, '%')}`,
    `font-style: ${cssStyle(face.style)}`,
    ...(unicodeRanges?.length ? [`unicode-range: ${cssUnicodeRanges(unicodeRanges)}`] : []),
  ]
  return `@font-face { ${descriptors.join('; ')}; }`
}

export async function createProjectFontCss(
  families: readonly ProjectFontFamily[] | null | undefined,
  compositions: readonly ProjectFontComposition[] | null | undefined,
  resolveAssetSrc: (source: string) => string,
  loadCharacterSet?: ProjectFontCharacterSetLoader,
): Promise<{ cssText: string, errors: ProjectFontLoadError[] }> {
  const rules: string[] = []
  const errors: ProjectFontLoadError[] = []
  const familiesByKey = new Map((families ?? []).map(family => [family.key.toLocaleLowerCase(), family]))
  const characterSets = new Map<string, Promise<ReadonlySet<number>>>()

  for (const family of families ?? []) {
    for (const face of family.faces) {
      rules.push(createFaceRule(
        createProjectFontFamilyCssFamily(family.key),
        face,
        resolveAssetSrc(face.source),
      ))
    }
  }

  if (loadCharacterSet) {
    for (const composition of compositions ?? []) {
      const claimedByDescriptor = new Map<string, UnicodeRange[]>()
      for (const member of composition.members) {
        const family = familiesByKey.get(member.familyKey.toLocaleLowerCase())
        if (!family) continue
        for (const face of family.faces) {
          try {
            let pending = characterSets.get(face.source)
            if (!pending) {
              pending = loadCharacterSet(face.source)
              characterSets.set(face.source, pending)
            }
            const available = characterSetToUnicodeRanges(await pending, member.ranges)
            const descriptorKey = faceDescriptorKey(face)
            const claimed = claimedByDescriptor.get(descriptorKey) ?? []
            const effective = subtractUnicodeRanges(available, claimed)
            if (effective.length === 0) continue
            claimedByDescriptor.set(descriptorKey, mergeUnicodeRanges([...claimed, ...effective]))
            rules.push(createFaceRule(
              createProjectFontCompositionCssFamily(composition.key),
              face,
              resolveAssetSrc(face.source),
              effective,
            ))
          } catch (error) {
            errors.push({
              familyKey: family.key,
              source: face.source,
              message: error instanceof Error ? error.message : String(error),
            })
          }
        }
      }
    }
  }
  return { cssText: rules.join('\n'), errors }
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

async function loadCssFamilies(
  currentGeneration: number,
  families: readonly ProjectFontFamily[],
  compositions: readonly ProjectFontComposition[],
  existingErrors: readonly ProjectFontLoadError[],
): Promise<ProjectFontLoadResult> {
  if (typeof document === 'undefined' || !document.fonts) {
    return { current: currentGeneration === generation, errors: existingErrors }
  }
  const errors = [...existingErrors]
  for (const entry of [
    ...families.map(family => ({ key: family.key, cssFamily: createProjectFontFamilyCssFamily(family.key), source: family.faces[0]?.source ?? '' })),
    ...compositions.map(composition => ({ key: composition.key, cssFamily: createProjectFontCompositionCssFamily(composition.key), source: '' })),
  ]) {
    try {
      const loadedFaces = await document.fonts.load(`16px ${JSON.stringify(entry.cssFamily)}`)
      if (currentGeneration !== generation) return { current: false, errors: [] }
      if (loadedFaces.length === 0) throw new Error('Font face did not load')
    } catch (error) {
      if (currentGeneration !== generation) return { current: false, errors: [] }
      const message = error instanceof Error ? error.message : String(error)
      errors.push({ familyKey: entry.key, source: entry.source, message })
      reportAppError('OC-E3005', { id: entry.key, source: entry.source, error })
    }
  }
  return { current: currentGeneration === generation, errors }
}

export function syncProjectFonts(
  families: readonly ProjectFontFamily[] | null | undefined,
  resolveAssetSrc: (source: string) => string,
  compositions: readonly ProjectFontComposition[] | null | undefined = [],
  loadCharacterSet?: ProjectFontCharacterSetLoader,
): Promise<ProjectFontLoadResult> {
  generation += 1
  const currentGeneration = generation
  const normalizedFamilies = families ?? []
  const normalizedCompositions = compositions ?? []
  setProjectFonts(normalizedFamilies, normalizedCompositions)
  readiness = (async () => {
    const generated = await createProjectFontCss(
      normalizedFamilies,
      normalizedCompositions,
      resolveAssetSrc,
      loadCharacterSet,
    )
    if (currentGeneration !== generation) return { current: false, errors: [] }
    replaceProjectFontStyle(generated.cssText)
    return await loadCssFamilies(currentGeneration, normalizedFamilies, normalizedCompositions, generated.errors)
  })()
  return readiness
}

export function clearProjectFonts(): void {
  generation += 1
  setProjectFonts([])
  removeProjectFontStyle()
  readiness = Promise.resolve({ current: true, errors: [] })
}

export async function waitForProjectFonts(): Promise<void> {
  await readiness
  if (typeof document !== 'undefined' && document.fonts) await document.fonts.ready
}
