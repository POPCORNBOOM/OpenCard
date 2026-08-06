import type { ProjectIconPackLocalization, ProjectIconPackManifest } from '../services/projectIconPack'

export const PROJECT_ICON_PACK_CATALOG_SCHEMA_VERSION = 1 as const
export const PROJECT_ICON_PACK_PACKAGE_EXTENSION = 'ociconpack'
export const PROJECT_ICON_PACK_PACKAGE_SUFFIX = `.${PROJECT_ICON_PACK_PACKAGE_EXTENSION}`

export type ProjectIconPackSource = 'builtin' | 'user'
export type ProjectIconPackCatalogKey = `${ProjectIconPackSource}:${string}`

export interface ProjectIconPackCatalogEntry {
  key: ProjectIconPackCatalogKey
  id: string
  name: string
  i18n?: ProjectIconPackLocalization
  packKey: string
  source: ProjectIconPackSource
  path: string
  iconCount: number
}

export interface ProjectIconPackCatalogWarning {
  path: string
  reason: string
}

export interface ProjectIconPackCatalogSnapshot {
  packs: ProjectIconPackCatalogEntry[]
  warnings: ProjectIconPackCatalogWarning[]
}

export interface ProjectIconPackIndex {
  schemaVersion: typeof PROJECT_ICON_PACK_CATALOG_SCHEMA_VERSION
  packs: string[]
}

export function createProjectIconPackCatalogEntry(
  manifest: ProjectIconPackManifest,
  path: string,
  source: ProjectIconPackSource,
  id: string,
): ProjectIconPackCatalogEntry {
  return {
    key: `${source}:${id}`,
    id,
    name: manifest.name,
    ...(manifest.i18n ? { i18n: manifest.i18n } : {}),
    packKey: manifest.key,
    source,
    path,
    iconCount: manifest.icons.length,
  }
}

export function resolveProjectIconPackName(
  pack: Pick<ProjectIconPackCatalogEntry, 'name' | 'i18n'>,
  locale: string,
): string {
  const localized = pack.i18n?.name
  const candidates = [
    locale,
    locale.toLocaleLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US',
    'en-US',
  ]
  for (const candidate of candidates) {
    const value = localized?.[candidate]
    if (value) return value
  }
  return Object.values(localized ?? {})[0] ?? pack.name
}
