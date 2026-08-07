import type { CustomBlockRuntimeCatalog } from '../../card-rendering/expandCustomBlocks'
import type { ProjectCustomBlockCatalog } from '../model/projectCustomBlocks'
import {
  buildProjectIconCatalog,
  EMPTY_PROJECT_ICON_CATALOG,
  type ProjectIconCatalog,
  type ProjectImageDimensionLoader,
} from './projectIconCatalog'

export type ProjectCustomBlockAssetRuntime = {
  createObjectUrl: (blob: Blob) => string
  revokeObjectUrl: (url: string) => void
}

export type ProjectCustomBlockRuntimeAssets = {
  customBlockCatalog: CustomBlockRuntimeCatalog
  iconCatalog: ProjectIconCatalog
}

let activeUrls: string[] = []

function defaultRuntime(): ProjectCustomBlockAssetRuntime | null {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null
  return {
    createObjectUrl: blob => URL.createObjectURL(blob),
    revokeObjectUrl: url => URL.revokeObjectURL(url),
  }
}

function mimeForPath(path: string): string {
  if (/\.png$/i.test(path)) return 'image/png'
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg'
  if (/\.webp$/i.test(path)) return 'image/webp'
  if (/\.gif$/i.test(path)) return 'image/gif'
  return 'application/octet-stream'
}

export function clearProjectCustomBlockAssets(runtime = defaultRuntime()): void {
  if (runtime) activeUrls.forEach(url => runtime.revokeObjectUrl(url))
  activeUrls = []
}

export async function syncProjectCustomBlockAssets(
  catalog: ProjectCustomBlockCatalog,
  runtime = defaultRuntime(),
  loadDimensions?: ProjectImageDimensionLoader,
): Promise<ProjectCustomBlockRuntimeAssets> {
  clearProjectCustomBlockAssets(runtime)
  if (!runtime) return { customBlockCatalog: catalog, iconCatalog: EMPTY_PROJECT_ICON_CATALOG }
  const nextUrls: string[] = []
  const runtimeCatalog = new Map<string, CustomBlockRuntimeCatalog extends ReadonlyMap<string, infer T> ? T : never>()
  const iconCatalogs: ProjectIconCatalog[] = []
  try {
    for (const [key, entry] of catalog) {
      const resourceUrls = new Map<string, string>()
      const indexedPaths = [
        ...(entry.manifest.resources?.images ?? []).map(resource => resource.source),
        ...(entry.manifest.resources?.iconSeries ?? []).map(series => series.source),
      ]
      for (const path of indexedPaths) {
        if (resourceUrls.has(path)) continue
        const bytes = entry.files.get(path)
        if (!bytes) throw new Error(`Custom block resource is missing: ${path}`)
        const url = runtime.createObjectUrl(new Blob([bytes.slice().buffer], { type: mimeForPath(path) }))
        nextUrls.push(url)
        resourceUrls.set(path, url)
      }
      runtimeCatalog.set(key, { ...entry, resourceUrls })
      const iconSeries = entry.manifest.resources?.iconSeries ?? []
      if (iconSeries.length > 0) {
        iconCatalogs.push(await buildProjectIconCatalog(
          iconSeries,
          source => resourceUrls.get(source) ?? '',
          loadDimensions,
        ))
      }
    }
    activeUrls = nextUrls
    return {
      customBlockCatalog: runtimeCatalog,
      iconCatalog: {
        series: iconCatalogs.flatMap(catalog => catalog.series),
        entries: iconCatalogs.flatMap(catalog => catalog.entries),
        errors: iconCatalogs.flatMap(catalog => catalog.errors),
      },
    }
  } catch (error) {
    nextUrls.forEach(url => runtime.revokeObjectUrl(url))
    throw error
  }
}
