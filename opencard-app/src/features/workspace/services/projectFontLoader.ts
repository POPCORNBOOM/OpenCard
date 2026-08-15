import type {
  ProjectFontComposition,
  ProjectFont,
  UnicodeRange,
} from '../model/projectFontRegistry'
import { projectFontFileEntries, projectFontWeightValues } from '../model/projectFontRegistry'
import {
  createProjectFontCompositionCssFamily,
  createProjectFontCssFamily,
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
  fontKey: string
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

function cssUnicodeRanges(ranges: readonly UnicodeRange[]): string {
  return ranges.map(range => range.start === range.end
    ? `U+${range.start.toString(16).toUpperCase()}`
    : `U+${range.start.toString(16).toUpperCase()}-${range.end.toString(16).toUpperCase()}`)
    .join(', ')
}

function slotDescriptorKey(weight: string, style: string): string {
  return `${weight}:${style}`
}

function createFaceRule(
  cssFamily: string,
  source: string,
  weight: keyof typeof projectFontWeightValues,
  style: 'upright' | 'italic',
  unicodeRanges?: readonly UnicodeRange[],
): string {
  const descriptors = [
    `font-family: ${JSON.stringify(cssFamily)}`,
    `src: url(${JSON.stringify(source)})`,
    `font-weight: ${projectFontWeightValues[weight]}`,
    `font-style: ${style === 'upright' ? 'normal' : 'italic'}`,
    ...(unicodeRanges?.length ? [`unicode-range: ${cssUnicodeRanges(unicodeRanges)}`] : []),
  ]
  return `@font-face { ${descriptors.join('; ')}; }`
}

export async function createProjectFontCss(
  fonts: readonly ProjectFont[] | null | undefined,
  compositions: readonly ProjectFontComposition[] | null | undefined,
  resolveAssetSrc: (source: string) => string,
  loadCharacterSet?: ProjectFontCharacterSetLoader,
): Promise<{ cssText: string, errors: ProjectFontLoadError[] }> {
  const rules: string[] = []
  const errors: ProjectFontLoadError[] = []
  const fontsByKey = new Map((fonts ?? []).map(font => [font.key.toLocaleLowerCase(), font]))
  const characterSets = new Map<string, Promise<ReadonlySet<number>>>()

  for (const font of fonts ?? []) {
    for (const slot of projectFontFileEntries(font)) {
      rules.push(createFaceRule(
        createProjectFontCssFamily(font.key),
        resolveAssetSrc(slot.source),
        slot.weight,
        slot.style,
      ))
    }
  }

  if (loadCharacterSet) {
    for (const composition of compositions ?? []) {
      const claimedByDescriptor = new Map<string, UnicodeRange[]>()
      for (const member of composition.members) {
        const font = fontsByKey.get(member.fontKey.toLocaleLowerCase())
        if (!font) continue
        for (const slot of projectFontFileEntries(font)) {
          try {
            let pending = characterSets.get(slot.source)
            if (!pending) {
              pending = loadCharacterSet(slot.source)
              characterSets.set(slot.source, pending)
            }
            const available = characterSetToUnicodeRanges(await pending, member.ranges)
            const descriptorKey = slotDescriptorKey(slot.weight, slot.style)
            const claimed = claimedByDescriptor.get(descriptorKey) ?? []
            const effective = subtractUnicodeRanges(available, claimed)
            if (effective.length === 0) continue
            claimedByDescriptor.set(descriptorKey, mergeUnicodeRanges([...claimed, ...effective]))
            rules.push(createFaceRule(
              createProjectFontCompositionCssFamily(composition.key),
              resolveAssetSrc(slot.source),
              slot.weight,
              slot.style,
              effective,
            ))
          } catch (error) {
            errors.push({
              fontKey: font.key,
              source: slot.source,
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
  fonts: readonly ProjectFont[],
  compositions: readonly ProjectFontComposition[],
  existingErrors: readonly ProjectFontLoadError[],
): Promise<ProjectFontLoadResult> {
  if (typeof document === 'undefined' || !document.fonts) {
    return { current: currentGeneration === generation, errors: existingErrors }
  }
  const errors = [...existingErrors]
  for (const entry of [
    ...fonts.map(font => ({ key: font.key, cssFamily: createProjectFontCssFamily(font.key), source: projectFontFileEntries(font)[0]?.source ?? '' })),
    ...compositions.map(composition => ({ key: composition.key, cssFamily: createProjectFontCompositionCssFamily(composition.key), source: '' })),
  ]) {
    try {
      const loadedFaces = await document.fonts.load(`16px ${JSON.stringify(entry.cssFamily)}`)
      if (currentGeneration !== generation) return { current: false, errors: [] }
      if (loadedFaces.length === 0) throw new Error('Font face did not load')
    } catch (error) {
      if (currentGeneration !== generation) return { current: false, errors: [] }
      const message = error instanceof Error ? error.message : String(error)
      errors.push({ fontKey: entry.key, source: entry.source, message })
      reportAppError('OC-E3005', { id: entry.key, source: entry.source, error })
    }
  }
  return { current: currentGeneration === generation, errors }
}

export function syncProjectFonts(
  fonts: readonly ProjectFont[] | null | undefined,
  resolveAssetSrc: (source: string) => string,
  compositions: readonly ProjectFontComposition[] | null | undefined = [],
  loadCharacterSet?: ProjectFontCharacterSetLoader,
): Promise<ProjectFontLoadResult> {
  generation += 1
  const currentGeneration = generation
  const normalizedFonts = fonts ?? []
  const normalizedCompositions = compositions ?? []
  setProjectFonts(normalizedFonts, normalizedCompositions)
  readiness = (async () => {
    const generated = await createProjectFontCss(
      normalizedFonts,
      normalizedCompositions,
      resolveAssetSrc,
      loadCharacterSet,
    )
    if (currentGeneration !== generation) return { current: false, errors: [] }
    replaceProjectFontStyle(generated.cssText)
    return await loadCssFamilies(currentGeneration, normalizedFonts, normalizedCompositions, generated.errors)
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
