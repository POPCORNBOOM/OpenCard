export { PROJECT_FONT_REGISTRY_FILE_NAME } from './projectStructure'

export const projectFontKeyPattern = /^[a-z0-9][a-z0-9._-]*$/
export const projectFontSourcePattern = /^fonts\/.+\.(?:woff2?|ttf|otf)$/i

export type NumericRange = {
  min: number
  max: number
}

export type ProjectFontFaceStyle =
  | { kind: 'normal' }
  | { kind: 'italic' }
  | { kind: 'oblique', angle: NumericRange }

export type ProjectFontFace = {
  source: string
  weight: NumericRange
  stretch: NumericRange
  style: ProjectFontFaceStyle
}

export type ProjectFontFamily = {
  key: string
  name: string
  faces: readonly ProjectFontFace[]
}

export type UnicodeRange = {
  start: number
  end: number
}

export type ProjectFontCompositionMember = {
  familyKey: string
  ranges?: readonly UnicodeRange[]
}

export type ProjectFontComposition = {
  key: string
  name: string
  members: readonly ProjectFontCompositionMember[]
}

export type ProjectFontRegistryDocument = {
  families?: readonly ProjectFontFamily[]
  compositions?: readonly ProjectFontComposition[]
}

export type ProjectFontRegistryEntry =
  | { kind: 'family', name: string, family: ProjectFontFamily }
  | { kind: 'composition', name: string, composition: ProjectFontComposition }

export type ProjectFontRegistry = Readonly<Record<string, ProjectFontRegistryEntry>>

const DEFAULT_WEIGHT: NumericRange = { min: 400, max: 400 }
const DEFAULT_STRETCH: NumericRange = { min: 100, max: 100 }
const MAX_UNICODE_CODE_POINT = 0x10ffff
const SURROGATE_START = 0xd800
const SURROGATE_END = 0xdfff

export function projectFontFacesOverlap(
  left: Pick<ProjectFontFace, 'weight' | 'stretch' | 'style'>,
  right: Pick<ProjectFontFace, 'weight' | 'stretch' | 'style'>,
): boolean {
  if (!numericRangesOverlap(left.weight, right.weight)
    || !numericRangesOverlap(left.stretch, right.stretch)
    || left.style.kind !== right.style.kind) return false
  return left.style.kind !== 'oblique' || right.style.kind !== 'oblique'
    || numericRangesOverlap(left.style.angle, right.style.angle)
}

export function findOverlappingProjectFontFaces(
  faces: readonly Pick<ProjectFontFace, 'weight' | 'stretch' | 'style'>[],
): readonly (readonly [number, number])[] {
  const conflicts: Array<readonly [number, number]> = []
  for (let left = 0; left < faces.length; left += 1) {
    for (let right = left + 1; right < faces.length; right += 1) {
      if (projectFontFacesOverlap(faces[left]!, faces[right]!)) conflicts.push([left, right])
    }
  }
  return conflicts
}

function numericRangesOverlap(left: NumericRange, right: NumericRange): boolean {
  return left.min <= right.max && right.min <= left.max
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeKey(value: unknown): string | null {
  return typeof value === 'string' && projectFontKeyPattern.test(value) ? value : null
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return value.trim()
}

function normalizeSource(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const source = value.trim().replace(/\\/g, '/')
  const segments = source.split('/')
  return projectFontSourcePattern.test(source)
    && segments.every(segment => Boolean(segment)
      && segment !== '.'
      && segment !== '..'
      && !/[<>:"|?*\u0000-\u001f\u007f]/.test(segment))
    ? source
    : null
}

function normalizeNumericRange(
  value: unknown,
  fallback: NumericRange,
  minimum: number,
  maximum: number,
): NumericRange | null {
  if (value === undefined) return { ...fallback }
  if (!isRecord(value) || typeof value.min !== 'number' || typeof value.max !== 'number') return null
  if (!Number.isFinite(value.min) || !Number.isFinite(value.max)
    || value.min < minimum || value.max > maximum || value.min > value.max) return null
  return { min: value.min, max: value.max }
}

function normalizeFaceStyle(value: unknown): ProjectFontFaceStyle | null {
  if (value === undefined) return { kind: 'normal' }
  if (!isRecord(value) || typeof value.kind !== 'string') return null
  if (value.kind === 'normal' || value.kind === 'italic') return { kind: value.kind }
  if (value.kind !== 'oblique') return null
  const angle = normalizeNumericRange(value.angle, { min: 14, max: 14 }, -90, 90)
  return angle ? { kind: 'oblique', angle } : null
}

function normalizeFace(value: unknown): ProjectFontFace | null {
  if (!isRecord(value)) return null
  const source = normalizeSource(value.source)
  const weight = normalizeNumericRange(value.weight, DEFAULT_WEIGHT, 1, 1000)
  const stretch = normalizeNumericRange(value.stretch, DEFAULT_STRETCH, 0.01, 1000)
  const style = normalizeFaceStyle(value.style)
  return source && weight && stretch && style ? { source, weight, stretch, style } : null
}

function normalizeFamily(value: unknown): ProjectFontFamily | null {
  if (!isRecord(value)) return null
  const key = normalizeKey(value.key)
  const name = normalizeName(value.name)
  if (!key || !name) return null
  const faces = value.faces === undefined
    ? []
    : Array.isArray(value.faces)
      ? value.faces.map(normalizeFace).filter((face): face is ProjectFontFace => Boolean(face))
      : null
  return faces ? { key, name, faces } : null
}

export function normalizeUnicodeRanges(value: unknown): UnicodeRange[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const ranges: UnicodeRange[] = []
  for (const candidate of value) {
    if (!isRecord(candidate)
      || !Number.isInteger(candidate.start)
      || !Number.isInteger(candidate.end)
      || (candidate.start as number) < 0
      || (candidate.end as number) > MAX_UNICODE_CODE_POINT
      || (candidate.start as number) > (candidate.end as number)) return null
    const start = candidate.start as number
    const end = candidate.end as number
    if (start < SURROGATE_START) ranges.push({ start, end: Math.min(end, SURROGATE_START - 1) })
    if (end > SURROGATE_END) ranges.push({ start: Math.max(start, SURROGATE_END + 1), end })
  }
  ranges.sort((left, right) => left.start - right.start || left.end - right.end)
  const merged: UnicodeRange[] = []
  for (const range of ranges) {
    const previous = merged[merged.length - 1]
    if (previous && range.start <= previous.end + 1) previous.end = Math.max(previous.end, range.end)
    else merged.push({ ...range })
  }
  return merged.length ? merged : null
}

function normalizeCompositionMember(value: unknown): ProjectFontCompositionMember | null {
  if (!isRecord(value)) return null
  const familyKey = normalizeKey(value.familyKey)
  if (!familyKey) return null
  if (value.ranges === undefined) return { familyKey }
  const ranges = normalizeUnicodeRanges(value.ranges)
  return ranges ? { familyKey, ranges } : null
}

function normalizeComposition(value: unknown): ProjectFontComposition | null {
  if (!isRecord(value)) return null
  const key = normalizeKey(value.key)
  const name = normalizeName(value.name)
  if (!key || !name) return null
  const members = value.members === undefined
    ? []
    : Array.isArray(value.members)
      ? value.members.map(normalizeCompositionMember)
        .filter((member): member is ProjectFontCompositionMember => Boolean(member))
      : null
  return members ? { key, name, members } : null
}

export function buildProjectFontRegistry(document: ProjectFontRegistryDocument): ProjectFontRegistry {
  return Object.fromEntries([
    ...(document.families ?? []).map(family => [family.key, {
      kind: 'family' as const,
      name: family.name,
      family,
    }] as const),
    ...(document.compositions ?? []).map(composition => [composition.key, {
      kind: 'composition' as const,
      name: composition.name,
      composition,
    }] as const),
  ])
}

export function parseProjectFontRegistry(value: unknown): ProjectFontRegistryDocument | null {
  if (!isRecord(value)) return null
  if (value.families !== undefined && !Array.isArray(value.families)) return null
  if (value.compositions !== undefined && !Array.isArray(value.compositions)) return null
  const families = (value.families ?? []).map(normalizeFamily)
    .filter((family): family is ProjectFontFamily => Boolean(family))
  const compositions = (value.compositions ?? []).map(normalizeComposition)
    .filter((composition): composition is ProjectFontComposition => Boolean(composition))
  const keys = new Set<string>()
  const uniqueFamilies = families.filter(family => {
    const key = family.key.toLocaleLowerCase()
    if (keys.has(key)) return false
    keys.add(key)
    return true
  })
  const uniqueCompositions = compositions.filter(composition => {
    const key = composition.key.toLocaleLowerCase()
    if (keys.has(key)) return false
    keys.add(key)
    return true
  })
  return {
    ...(uniqueFamilies.length ? { families: uniqueFamilies } : {}),
    ...(uniqueCompositions.length ? { compositions: uniqueCompositions } : {}),
  }
}

export function parseProjectFontRegistryText(content: string): ProjectFontRegistryDocument | null {
  try {
    return parseProjectFontRegistry(JSON.parse(content))
  } catch {
    return null
  }
}

export function serializeProjectFontRegistry(document: ProjectFontRegistryDocument): string {
  const normalized = parseProjectFontRegistry(document)
  if (!normalized) throw new Error('Invalid project font registry')
  return JSON.stringify(normalized, null, 2)
}
