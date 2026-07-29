import type { ProjectFontDefinition, ProjectFontRegistry } from './projectMetadata'

export type FontCatalogEntry = {
  value: string
  label: string
  source: 'system' | 'project'
  detail?: string
}

export type ProjectFontRegistration = {
  id: string
  definition: ProjectFontDefinition
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
  return `project:${id}`
}

export function createProjectFontCssFamily(id: string): string {
  return `OpenCardProjectFont-${id}`
}

export function toCssFontFamily(reference: string): string {
  return reference.startsWith('project:')
    ? JSON.stringify(createProjectFontCssFamily(reference.slice('project:'.length)))
    : reference
}

export function fromCssFontFamily(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2 && ((trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
    const family = trimmed.slice(1, -1)
    return family.startsWith('OpenCardProjectFont-')
      ? createProjectFontReference(family.slice('OpenCardProjectFont-'.length))
      : family
  }
  return trimmed.startsWith('OpenCardProjectFont-')
    ? createProjectFontReference(trimmed.slice('OpenCardProjectFont-'.length))
    : trimmed
}

export function buildFontCatalog(fonts: ProjectFontRegistry | null | undefined): readonly FontCatalogEntry[] {
  const projectEntries = Object.entries(fonts ?? {}).map(([id, definition]) => ({
    value: createProjectFontReference(id),
    label: definition.family,
    source: 'project' as const,
    detail: definition.faces.map(face => face.source).join(', '),
  }))
  return [...projectEntries, ...SYSTEM_FONT_CATALOG]
}

function getSourceStem(source: string): string {
  const fileName = source.replace(/\\/g, '/').split('/').pop() ?? source
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
}

function inferFontWeight(stem: string): string {
  const normalized = stem.toLocaleLowerCase().replace(/[\s_-]+/g, '')
  if (normalized.includes('thin')) return '100'
  if (normalized.includes('extralight') || normalized.includes('ultralight')) return '200'
  if (normalized.includes('light')) return '300'
  if (normalized.includes('medium')) return '500'
  if (normalized.includes('semibold') || normalized.includes('demibold')) return '600'
  if (normalized.includes('extrabold') || normalized.includes('ultrabold')) return '800'
  if (normalized.includes('black') || normalized.includes('heavy')) return '900'
  if (normalized.includes('bold')) return '700'
  return '400'
}

function inferFontFamily(stem: string): string {
  const withoutVariant = stem.replace(
    /(?:[\s_-]*(?:thin|extra[\s_-]*light|ultra[\s_-]*light|light|regular|normal|medium|semi[\s_-]*bold|demi[\s_-]*bold|extra[\s_-]*bold|ultra[\s_-]*bold|bold|black|heavy|italic|oblique))+$/i,
    '',
  )
  const readable = (withoutVariant || stem)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[\s_-]+/g, ' ')
    .trim()
  return readable || 'Project Font'
}

function createAvailableFontId(family: string, fonts: ProjectFontRegistry | null | undefined): string {
  const base = family
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '') || 'font'
  let candidate = base
  let suffix = 2
  while (fonts?.[candidate]) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  return candidate
}

export function createProjectFontRegistration(
  source: string,
  fonts: ProjectFontRegistry | null | undefined,
): ProjectFontRegistration {
  const normalizedSource = source.replace(/\\/g, '/')
  const stem = getSourceStem(normalizedSource)
  const family = inferFontFamily(stem)
  const style = /oblique/i.test(stem)
    ? 'oblique' as const
    : /italic/i.test(stem)
      ? 'italic' as const
      : 'normal' as const
  return {
    id: createAvailableFontId(family, fonts),
    definition: {
      family,
      faces: [{
        source: normalizedSource,
        weight: inferFontWeight(stem),
        style,
      }],
    },
  }
}
