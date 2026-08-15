import type {
  ProjectFontComposition,
  ProjectFont,
  ProjectFontRegistry,
  UnicodeRange,
} from './projectFontRegistry'
import { projectFontSources } from './projectFontRegistry'

export const DEFAULT_PROJECT_FONT_DIRECTORY = 'fonts'
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

let projectFamiliesByKey = new Map<string, ProjectFont>()
let projectCompositionsByKey = new Map<string, ProjectFontComposition>()

export function setProjectFonts(
  families: readonly ProjectFont[] | null | undefined,
  compositions: readonly ProjectFontComposition[] | null | undefined = [],
): void {
  projectFamiliesByKey = new Map((families ?? []).map(font => [font.key.toLocaleLowerCase(), font]))
  projectCompositionsByKey = new Map((compositions ?? []).map(composition => (
    [composition.key.toLocaleLowerCase(), composition]
  )))
}

export type ProjectFontResolutionIssue = {
  kind: 'missing'
  key: string
  path: readonly string[]
}

export type ProjectFontResolution = {
  familyKeys: readonly string[]
  cssFontFamily: string
  issues: readonly ProjectFontResolutionIssue[]
}

export type ProjectFontResolutionContext = {
  families: readonly ProjectFont[]
  compositions: readonly ProjectFontComposition[]
}

export type ProjectFontRegistryIssue =
  | { kind: 'empty-font', fontKey: string }
  | { kind: 'empty-composition', compositionKey: string }
  | { kind: 'missing-font', compositionKey: string, fontKey: string }

export function findProjectFontRegistryIssues(context: ProjectFontResolutionContext): ProjectFontRegistryIssue[] {
  const fontKeys = new Set(context.families.map(font => font.key.toLocaleLowerCase()))
  const issues: ProjectFontRegistryIssue[] = context.families
      .filter(font => projectFontSources(font).length === 0)
      .map(font => ({ kind: 'empty-font', fontKey: font.key }))
  issues.push(...context.compositions.flatMap<ProjectFontRegistryIssue>(composition => composition.members.length === 0
      ? [{ kind: 'empty-composition' as const, compositionKey: composition.key }]
      : composition.members
        .filter(member => !fontKeys.has(member.fontKey.toLocaleLowerCase()))
        .map(member => ({
          kind: 'missing-font' as const,
          compositionKey: composition.key,
          fontKey: member.fontKey,
        }))))
  return issues
}

export function createProjectFontReference(key: string): string {
  return `font:${key}`
}

export function createProjectFontCssFamily(key: string): string {
  return `OpenCardProjectFont-${key}`
}

export function createProjectFontCompositionCssFamily(key: string): string {
  return `OpenCardProjectFontComposition-${key}`
}

export function toCssFontFamily(reference: string): string {
  return resolveProjectFontExpression(reference).cssFontFamily
}

export function resolveProjectFontExpression(
  reference: string,
  context?: ProjectFontResolutionContext,
): ProjectFontResolution {
  const fontsByKey = context
    ? new Map(context.families.map(font => [font.key.toLocaleLowerCase(), font]))
    : projectFamiliesByKey
  const compositionsByKey = context
    ? new Map(context.compositions.map(composition => [composition.key.toLocaleLowerCase(), composition]))
    : projectCompositionsByKey
  const familyKeys: string[] = []
  const cssFamilies: string[] = []
  const issues: ProjectFontResolutionIssue[] = []
  const seenFamilies = new Set<string>()
  const seenCssFamilies = new Set<string>()

  for (const value of splitFontReferences(reference)) {
    if (!value.startsWith('font:')) {
      const identity = value.toLocaleLowerCase()
      if (!seenCssFamilies.has(identity)) {
        seenCssFamilies.add(identity)
        cssFamilies.push(value)
      }
      continue
    }
    const key = value.slice('font:'.length)
    const identity = key.toLocaleLowerCase()
    const font = fontsByKey.get(identity)
    if (font) {
      if (!seenFamilies.has(identity)) {
        seenFamilies.add(identity)
        familyKeys.push(font.key)
      }
      cssFamilies.push(JSON.stringify(createProjectFontCssFamily(font.key)))
      continue
    }
    const composition = compositionsByKey.get(identity)
    if (!composition) {
      issues.push({ kind: 'missing', key, path: [] })
      continue
    }
    cssFamilies.push(JSON.stringify(createProjectFontCompositionCssFamily(composition.key)))
    for (const member of composition.members) {
      const memberIdentity = member.fontKey.toLocaleLowerCase()
      const memberFont = fontsByKey.get(memberIdentity)
      if (!memberFont) {
        issues.push({ kind: 'missing', key: member.fontKey, path: [composition.key] })
      } else if (!seenFamilies.has(memberIdentity)) {
        seenFamilies.add(memberIdentity)
        familyKeys.push(memberFont.key)
      }
    }
  }
  return { familyKeys, cssFontFamily: cssFamilies.join(', '), issues }
}

export function fromCssFontFamily(value: string): string {
  const references: string[] = []
  for (const candidate of splitCssFontFamilies(value)) {
    const family = unquoteCssFamily(candidate)
    if (family.startsWith('OpenCardProjectFont-')) {
      references.push(createProjectFontReference(family.slice('OpenCardProjectFont-'.length)))
    } else if (family.startsWith('OpenCardProjectFontComposition-')) {
      references.push(createProjectFontReference(family.slice('OpenCardProjectFontComposition-'.length)))
    } else if (family) references.push(family)
  }
  return references.join('; ')
}

export function buildFontCatalog(fonts: ProjectFontRegistry | null | undefined): readonly FontCatalogEntry[] {
  const projectEntries = Object.entries(fonts ?? {}).map(([key, definition]) => ({
    value: createProjectFontReference(key),
    label: definition.name,
    source: 'project' as const,
    detail: definition.kind === 'family'
      ? projectFontSources(definition.family).join('; ')
      : definition.composition.members.map(member => member.fontKey).join(' → '),
  }))
  return [...SYSTEM_FONT_CATALOG, ...projectEntries]
}

export function unicodeRangeContains(ranges: readonly UnicodeRange[] | undefined, codePoint: number): boolean {
  return ranges === undefined || ranges.some(range => codePoint >= range.start && codePoint <= range.end)
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
