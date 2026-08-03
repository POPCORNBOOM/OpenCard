import type { ProjectFontRegistry } from './projectFontRegistry'

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

export function createProjectFontReference(id: string): string {
  return `font:${id}`
}

export function createProjectFontCssFamily(id: string): string {
  return `OpenCardProjectFont-${id}`
}

export function toCssFontFamily(reference: string): string {
  return splitFontReferences(reference)
    .map(value => value.startsWith('font:')
      ? JSON.stringify(createProjectFontCssFamily(value.slice('font:'.length)))
      : value)
    .join(', ')
}

export function fromCssFontFamily(value: string): string {
  return splitCssFontFamilies(value).map(candidate => {
    const trimmed = candidate.trim()
    const family = trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"'))
      || (trimmed.startsWith("'") && trimmed.endsWith("'")))
      ? trimmed.slice(1, -1)
      : trimmed
    return family.startsWith('OpenCardProjectFont-')
      ? createProjectFontReference(family.slice('OpenCardProjectFont-'.length))
      : family
  }).filter(Boolean).join('; ')
}

export function buildFontCatalog(fonts: ProjectFontRegistry | null | undefined): readonly FontCatalogEntry[] {
  const projectEntries = Object.entries(fonts ?? {}).map(([id, definition]) => ({
    value: createProjectFontReference(id),
    label: definition.name,
    source: 'project' as const,
    detail: definition.source,
  }))
  return [...projectEntries, ...SYSTEM_FONT_CATALOG]
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
