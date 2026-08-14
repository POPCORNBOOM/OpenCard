import { parseProjectIconSeries, type ProjectIconSeries } from './projectIcons'
export { PROJECT_ICON_REGISTRY_FILE_NAME } from './projectStructure'

export type ProjectIconRegistryDocument = {
  iconSeries?: readonly ProjectIconSeries[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function parseProjectIconRegistry(value: unknown): ProjectIconRegistryDocument | null {
  if (!isRecord(value)) return null
  if (value.iconSeries === undefined) return {}
  const iconSeries = parseProjectIconSeries(value.iconSeries)
  if (!iconSeries) return null
  return iconSeries.length > 0 ? { iconSeries } : {}
}

export function parseProjectIconRegistryText(content: string): ProjectIconRegistryDocument | null {
  try {
    return parseProjectIconRegistry(JSON.parse(content))
  } catch {
    return null
  }
}

export function serializeProjectIconRegistry(document: ProjectIconRegistryDocument): string {
  const normalized = parseProjectIconRegistry(document)
  if (!normalized) throw new Error('Invalid project icon registry')
  return JSON.stringify(normalized, null, 2)
}
