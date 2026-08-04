import type { ProjectFont, ProjectFontRegistry, ProjectFontSet } from './projectFontRegistry'

export const DEFAULT_PROJECT_FONT_DIRECTORY = 'assets/fonts'
export const projectFontIdPattern = /^[a-z0-9][a-z0-9._-]*$/

export function normalizeProjectFontDirectory(value: string): string | null {
  const directory = value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  const segments = directory.split('/')
  if (!directory || /^[a-z]:\//i.test(directory) || directory.startsWith('//')
    || segments.some(segment => segment === '.' || segment === '..' || /[\u0000-\u001f\u007f]/.test(segment))) {
    return null
  }
  return directory
}

export type FontCatalogEntry = {
  value: string
  label: string
  source: 'system' | 'project'
  detail?: string
}

export const SYSTEM_FONT_CATALOG: readonly FontCatalogEntry[] = [
  { value: 'Arial', label: 'Arial', source: 'system' },
  { value: 'Georgia', label: 'Georgia', source: 'system' },
  { value: 'Impact', label: 'Impact', source: 'system' },
  { value: 'Times New Roman', label: 'Times New Roman', source: 'system' },
  { value: 'Microsoft YaHei', label: '微软雅黑', source: 'system' },
  { value: 'SimSun', label: '宋体', source: 'system' },
]

let projectFontsByKey = new Map<string, ProjectFont>()
let projectFontSetsByKey = new Map<string, ProjectFontSet>()

export function setProjectFonts(
  fonts: readonly ProjectFont[] | null | undefined,
  fontSets: readonly ProjectFontSet[] | null | undefined = [],
): void {
  projectFontsByKey = new Map((fonts ?? []).map(font => [font.key.toLocaleLowerCase(), font]))
  projectFontSetsByKey = new Map((fontSets ?? []).map(fontSet => [fontSet.key.toLocaleLowerCase(), fontSet]))
}

export type ProjectFontResolutionIssue = {
  kind: 'missing' | 'cycle'
  key: string
  path: readonly string[]
}

export type ProjectFontResolution = {
  fontKeys: readonly string[]
  cssFontFamily: string
  issues: readonly ProjectFontResolutionIssue[]
}

export type ProjectFontResolutionContext = {
  fonts: readonly ProjectFont[]
  fontSets: readonly ProjectFontSet[]
}

export type ProjectFontRegistryIssue =
  | { kind: 'empty-set'; fontSetKey: string; path: readonly string[] }
  | { kind: 'missing' | 'cycle'; fontSetKey: string; key: string; path: readonly string[] }

export function findProjectFontRegistryIssues(context: ProjectFontResolutionContext): ProjectFontRegistryIssue[] {
  const issues: ProjectFontRegistryIssue[] = []
  const seen = new Set<string>()
  for (const fontSet of context.fontSets) {
    if (fontSet.fontKeys.length === 0) {
      issues.push({ kind: 'empty-set', fontSetKey: fontSet.key, path: [fontSet.key] })
      continue
    }
    for (const issue of resolveProjectFontExpression(`font:${fontSet.key}`, context).issues) {
      const identity = `${fontSet.key}:${issue.kind}:${issue.key}:${issue.path.join('>')}`.toLocaleLowerCase()
      if (seen.has(identity)) continue
      seen.add(identity)
      issues.push({ ...issue, fontSetKey: fontSet.key })
    }
  }
  return issues
}

export function createProjectFontReference(id: string): string {
  return `font:${id}`
}

export function createProjectFontCssFamily(id: string): string {
  return `OpenCardProjectFont-${id}`
}

export function createProjectFontSetCssFamily(id: string): string {
  return `OpenCardProjectFontSet-${id}`
}

export function toCssFontFamily(reference: string): string {
  return resolveProjectFontExpression(reference).cssFontFamily
}

export function resolveProjectFontExpression(
  reference: string,
  context?: ProjectFontResolutionContext,
): ProjectFontResolution {
  const fontsByKey = context
    ? new Map(context.fonts.map(font => [font.key.toLocaleLowerCase(), font]))
    : projectFontsByKey
  const fontSetsByKey = context
    ? new Map(context.fontSets.map(fontSet => [fontSet.key.toLocaleLowerCase(), fontSet]))
    : projectFontSetsByKey
  const fontKeys: string[] = []
  const cssFamilies: string[] = []
  const issues: ProjectFontResolutionIssue[] = []
  const seenFonts = new Set<string>()
  const seenSystemFamilies = new Set<string>()

  function resolveKey(key: string, path: readonly string[]): void {
    const identity = key.toLocaleLowerCase()
    const font = fontsByKey.get(identity)
    if (font) {
      if (seenFonts.has(identity)) return
      seenFonts.add(identity)
      fontKeys.push(font.key)
      cssFamilies.push(JSON.stringify(createProjectFontCssFamily(font.key)))
      return
    }
    const fontSet = fontSetsByKey.get(identity)
    if (!fontSet) {
      issues.push({ kind: 'missing', key, path })
      return
    }
    if (path.some(candidate => candidate.toLocaleLowerCase() === identity)) {
      issues.push({ kind: 'cycle', key: fontSet.key, path: [...path, fontSet.key] })
      return
    }
    for (const member of fontSet.fontKeys) resolveKey(member, [...path, fontSet.key])
  }

  for (const value of splitFontReferences(reference)) {
    if (value.startsWith('font:')) {
      const key = value.slice('font:'.length)
      if (fontSetsByKey.has(key.toLocaleLowerCase())) {
        cssFamilies.push(JSON.stringify(createProjectFontSetCssFamily(key)))
      }
      resolveKey(key, [])
      continue
    }
    const identity = value.toLocaleLowerCase()
    if (seenSystemFamilies.has(identity)) continue
    seenSystemFamilies.add(identity)
    cssFamilies.push(value)
  }
  return { fontKeys, cssFontFamily: cssFamilies.join(', '), issues }
}

export function fromCssFontFamily(value: string): string {
  const candidates = splitCssFontFamilies(value)
  const references: string[] = []
  const seenProjectFonts = new Set<string>()
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index] ?? ''
    const trimmed = candidate.trim()
    const family = trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"'))
      || (trimmed.startsWith("'") && trimmed.endsWith("'")))
      ? trimmed.slice(1, -1)
      : trimmed
    if (family.startsWith('OpenCardProjectFontSet-')) {
      const key = family.slice('OpenCardProjectFontSet-'.length)
      references.push(createProjectFontReference(key))
      const resolved = resolveProjectFontExpression(createProjectFontReference(key))
      for (const fontKey of resolved.fontKeys) {
        const identity = fontKey.toLocaleLowerCase()
        if (seenProjectFonts.has(identity)) continue
        const nextFamily = unquoteCssFamily(candidates[index + 1] ?? '')
        if (nextFamily !== createProjectFontCssFamily(fontKey)) break
        seenProjectFonts.add(identity)
        index += 1
      }
    } else if (family.startsWith('OpenCardProjectFont-')) {
      const key = family.slice('OpenCardProjectFont-'.length)
      seenProjectFonts.add(key.toLocaleLowerCase())
      references.push(createProjectFontReference(key))
    } else if (family) {
      references.push(family)
    }
  }
  return references.join('; ')
}

export function buildFontCatalog(fonts: ProjectFontRegistry | null | undefined): readonly FontCatalogEntry[] {
  const projectEntries = Object.entries(fonts ?? {}).map(([id, definition]) => ({
    value: createProjectFontReference(id),
    label: definition.name,
    source: 'project' as const,
    detail: definition.source,
  }))
  return [...SYSTEM_FONT_CATALOG, ...projectEntries]
}

export function splitFontReferences(value: string): string[] {
  return value.split(';').map(reference => reference.trim()).filter(Boolean)
}

function splitCssFontFamilies(value: string): string[] {
  const families: string[] = []
  let start = 0
  let quote = ''
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? ''
    if (quote) {
      if (character === quote && value[index - 1] !== '\\') quote = ''
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (character === ',') {
      families.push(value.slice(start, index))
      start = index + 1
    }
  }
  families.push(value.slice(start))
  return families
}

function unquoteCssFamily(value: string): string {
  const trimmed = value.trim()
  return trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'")))
    ? trimmed.slice(1, -1)
    : trimmed
}
