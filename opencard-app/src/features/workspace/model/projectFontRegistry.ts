export const PROJECT_FONT_REGISTRY_FILE_NAME = '.fontreg'

export type ProjectFontDefinition = {
  name: string
  source: string
}

export type ProjectFontRegistry = Readonly<Record<string, ProjectFontDefinition>>

export type ProjectFontRegistryDocument = {
  fonts?: ProjectFontRegistry
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseProjectFonts(value: unknown): ProjectFontRegistry | null {
  if (!isRecord(value)) return null
  const registry: Record<string, ProjectFontDefinition> = {}
  const normalizedKeys = new Set<string>()

  for (const [key, candidate] of Object.entries(value)) {
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(key) || !isRecord(candidate)) return null
    const normalizedKey = key.toLocaleLowerCase()
    if (normalizedKeys.has(normalizedKey)) return null
    normalizedKeys.add(normalizedKey)
    if (Object.keys(candidate).some(field => !['name', 'source'].includes(field))) return null
    if (typeof candidate.name !== 'string' || candidate.name.trim() === '') return null
    if (typeof candidate.source !== 'string') return null

    const source = candidate.source.replace(/\\/g, '/')
    const segments = source.split('/')
    if (!source || source.startsWith('/') || /^[a-z]:\//i.test(source)
      || segments.includes('..') || !/\.(woff2?|ttf|otf)$/i.test(source)) return null
    registry[key] = { name: candidate.name.trim(), source }
  }
  return registry
}

export function parseProjectFontRegistry(value: unknown): ProjectFontRegistryDocument | null {
  if (!isRecord(value)) return null
  if (value.fonts === undefined) return {}
  const fonts = parseProjectFonts(value.fonts)
  if (!fonts) return null
  return Object.keys(fonts).length > 0 ? { fonts } : {}
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
