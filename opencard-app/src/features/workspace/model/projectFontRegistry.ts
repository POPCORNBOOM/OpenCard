export const PROJECT_FONT_REGISTRY_FILE_NAME = '.ocfonts'

export const projectFontKeyPattern = /^[a-z0-9][a-z0-9._-]*$/
export const projectFontSourcePattern = /\.(?:woff2?|ttf|otf)$/i

export type ProjectFont = {
  key: string
  name: string
  source: string
}

export type ProjectFontSet = {
  key: string
  name: string
  fontKeys: string[]
}

export type ProjectFontDefinition = {
  name: string
  source: string
}

export type ProjectFontRegistry = Readonly<Record<string, ProjectFontDefinition>>

export type ProjectFontRegistryDocument = {
  fonts?: readonly ProjectFont[]
  fontSets?: readonly ProjectFontSet[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeSource(value: string): string | null {
  const source = value.trim().replace(/\\/g, '/')
  const segments = source.split('/')
  if (!source || source.startsWith('/') || /^[a-z]:\//i.test(source)
    || segments.includes('..') || !projectFontSourcePattern.test(source)) return null
  return source
}

export function parseProjectFonts(value: unknown): ProjectFont[] | null {
  if (!Array.isArray(value)) return null
  const fonts: ProjectFont[] = []
  const keys = new Set<string>()
  for (const candidate of value) {
    if (!isRecord(candidate)
      || Object.keys(candidate).some(field => !['key', 'name', 'source'].includes(field))
      || typeof candidate.key !== 'string'
      || !projectFontKeyPattern.test(candidate.key)
      || keys.has(candidate.key.toLocaleLowerCase())
      || typeof candidate.name !== 'string'
      || candidate.name.trim() === ''
      || typeof candidate.source !== 'string') return null
    const source = normalizeSource(candidate.source)
    if (!source) return null
    keys.add(candidate.key.toLocaleLowerCase())
    fonts.push({ key: candidate.key, name: candidate.name.trim(), source })
  }
  return fonts
}

export function parseProjectFontSets(value: unknown): ProjectFontSet[] | null {
  if (!Array.isArray(value)) return null
  const fontSets: ProjectFontSet[] = []
  const keys = new Set<string>()
  for (const candidate of value) {
    if (!isRecord(candidate)
      || Object.keys(candidate).some(field => !['key', 'name', 'fontKeys'].includes(field))
      || typeof candidate.key !== 'string'
      || !projectFontKeyPattern.test(candidate.key)
      || keys.has(candidate.key.toLocaleLowerCase())
      || typeof candidate.name !== 'string'
      || candidate.name.trim() === ''
      || !Array.isArray(candidate.fontKeys)
      || candidate.fontKeys.some(key => typeof key !== 'string' || !projectFontKeyPattern.test(key))) return null
    keys.add(candidate.key.toLocaleLowerCase())
    fontSets.push({
      key: candidate.key,
      name: candidate.name.trim(),
      fontKeys: [...candidate.fontKeys],
    })
  }
  return fontSets
}

export function flattenProjectFonts(fonts: readonly ProjectFont[] | null | undefined): ProjectFontRegistry {
  return Object.fromEntries((fonts ?? []).map(font => [font.key, { name: font.name, source: font.source }]))
}

export function buildProjectFontRegistry(
  fonts: readonly ProjectFont[] | null | undefined,
  fontSets: readonly ProjectFontSet[] | null | undefined,
): ProjectFontRegistry {
  return Object.fromEntries([
    ...(fonts ?? []).map(font => [font.key, { name: font.name, source: font.source }] as const),
    ...(fontSets ?? []).map(fontSet => [fontSet.key, {
      name: fontSet.name,
      source: fontSet.fontKeys.map(key => `font:${key}`).join('; '),
    }] as const),
  ])
}

export function parseProjectFontRegistry(value: unknown): ProjectFontRegistryDocument | null {
  if (!isRecord(value)) return null
  const fonts = value.fonts === undefined ? [] : parseProjectFonts(value.fonts)
  const fontSets = value.fontSets === undefined ? [] : parseProjectFontSets(value.fontSets)
  if (!fonts || !fontSets) return null
  const keys = new Set<string>()
  for (const entry of [...fonts, ...fontSets]) {
    const key = entry.key.toLocaleLowerCase()
    if (keys.has(key)) return null
    keys.add(key)
  }
  return {
    ...(fonts.length ? { fonts } : {}),
    ...(fontSets.length ? { fontSets } : {}),
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
