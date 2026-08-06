import type { ProjectIcon, ProjectIconSeries } from '../model/projectIcons'

export type ProjectIconCatalogEntry = ProjectIcon & {
  seriesKey: string
  source: string
  src: string
  imageWidth: number
  imageHeight: number
}

export type ProjectIconSeriesRuntime = {
  name: string
  key: string
  source: string
  src: string
  imageWidth: number
  imageHeight: number
}

export type ProjectIconLoadError = {
  seriesKey: string
  source: string
  reason: 'load-failed' | 'icon-out-of-bounds'
  iconKey?: string
}

export type ProjectIconCatalog = {
  series: readonly ProjectIconSeriesRuntime[]
  entries: readonly ProjectIconCatalogEntry[]
  errors: readonly ProjectIconLoadError[]
}

export type ProjectImageDimensions = { width: number; height: number }
export type ProjectImageDimensionLoader = (src: string) => Promise<ProjectImageDimensions>

export const EMPTY_PROJECT_ICON_CATALOG: ProjectIconCatalog = { series: [], entries: [], errors: [] }

export function projectIconIdentity(seriesKey: string, iconKey: string): string {
  return `${seriesKey.toLocaleLowerCase()}\u0000${iconKey.toLocaleLowerCase()}`
}

export async function loadProjectImageDimensions(src: string): Promise<ProjectImageDimensions> {
  return await new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const complete = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      if (typeof image.decode === 'function') void image.decode().then(complete, reject)
      else complete()
    }
    image.onerror = () => reject(new Error('Unable to load project icon image'))
    image.src = src
  })
}

export async function buildProjectIconCatalog(
  seriesList: readonly ProjectIconSeries[] | null | undefined,
  resolveAssetSrc: (source: string) => string,
  loadDimensions: ProjectImageDimensionLoader = loadProjectImageDimensions,
): Promise<ProjectIconCatalog> {
  const entries: ProjectIconCatalogEntry[] = []
  const runtimeSeries: ProjectIconSeriesRuntime[] = []
  const errors: ProjectIconLoadError[] = []

  for (const series of seriesList ?? []) {
    const src = resolveAssetSrc(series.source)
    let dimensions: ProjectImageDimensions
    try {
      dimensions = await loadDimensions(src)
      if (!Number.isInteger(dimensions.width) || dimensions.width <= 0
        || !Number.isInteger(dimensions.height) || dimensions.height <= 0) throw new Error('Invalid dimensions')
    } catch {
      errors.push({ seriesKey: series.key, source: series.source, reason: 'load-failed' })
      continue
    }

    runtimeSeries.push({
      name: series.name,
      key: series.key,
      source: series.source,
      src,
      imageWidth: dimensions.width,
      imageHeight: dimensions.height,
    })

    for (const icon of series.icons) {
      if (icon.x + icon.width > dimensions.width || icon.y + icon.height > dimensions.height) {
        errors.push({
          seriesKey: series.key,
          source: series.source,
          reason: 'icon-out-of-bounds',
          iconKey: icon.iconKey,
        })
        continue
      }
      entries.push({
        ...icon,
        seriesKey: series.key,
        source: series.source,
        src,
        imageWidth: dimensions.width,
        imageHeight: dimensions.height,
      })
    }
  }
  return { series: runtimeSeries, entries, errors }
}

export function findProjectIconSeries(
  catalog: ProjectIconCatalog | null | undefined,
  seriesKey: string,
): ProjectIconSeriesRuntime | null {
  return catalog?.series.find(series => series.key.toLocaleLowerCase() === seriesKey.toLocaleLowerCase()) ?? null
}

export function findProjectIcon(
  catalog: ProjectIconCatalog | null | undefined,
  seriesKey: string,
  iconKey: string,
): ProjectIconCatalogEntry | null {
  const identity = projectIconIdentity(seriesKey, iconKey)
  return catalog?.entries.find(entry => projectIconIdentity(entry.seriesKey, entry.iconKey) === identity) ?? null
}

function isQuarterTurn(rotation: number | undefined): boolean {
  return rotation === 90 || rotation === 270
}

function displayDimensions(entry: ProjectIconCatalogEntry): { width: number; height: number } {
  const atlasDimensions = isQuarterTurn(entry.atlasRotation)
    ? { width: entry.height, height: entry.width }
    : { width: entry.width, height: entry.height }
  return isQuarterTurn(entry.rotation)
    ? { width: atlasDimensions.height, height: atlasDimensions.width }
    : atlasDimensions
}

function effectiveRotation(entry: ProjectIconCatalogEntry): number {
  return ((entry.rotation ?? 0) - (entry.atlasRotation ?? 0) + 360) % 360
}

function createProjectIconRenderStyle(
  entry: ProjectIconCatalogEntry,
  unit: number,
): Record<string, string> {
  return {
    backgroundImage: 'none',
    backgroundSize: `${entry.imageWidth / unit}em ${entry.imageHeight / unit}em`,
    backgroundPosition: `${-entry.x / unit}em ${-entry.y / unit}em`,
    imageRendering: entry.pixelated === true ? 'pixelated' : 'auto',
    '--oc-project-icon-background-image': `url(${JSON.stringify(entry.src)})`,
    '--oc-project-icon-background-size': `${entry.imageWidth / unit}em ${entry.imageHeight / unit}em`,
    '--oc-project-icon-background-position': `${-entry.x / unit}em ${-entry.y / unit}em`,
    '--oc-project-icon-source-width': `${entry.width / unit}em`,
    '--oc-project-icon-source-height': `${entry.height / unit}em`,
    '--oc-project-icon-image-rendering': entry.pixelated === true ? 'pixelated' : 'auto',
    '--oc-project-icon-transform': `rotate(${effectiveRotation(entry)}deg)`,
  }
}

export function createProjectIconStyle(entry: ProjectIconCatalogEntry): Record<string, string> {
  const dimensions = displayDimensions(entry)
  const unit = dimensions.height
  return {
    width: `${dimensions.width / unit}em`,
    height: '1em',
    ...createProjectIconRenderStyle(entry, unit),
  }
}

export function createProjectIconPreviewStyle(entry: ProjectIconCatalogEntry): Record<string, string> {
  const dimensions = displayDimensions(entry)
  const unit = Math.max(dimensions.width, dimensions.height)
  return {
    width: `${dimensions.width / unit}em`,
    height: `${dimensions.height / unit}em`,
    ...createProjectIconRenderStyle(entry, unit),
  }
}

export function renderProjectIconsInRichText(source: string, catalog: ProjectIconCatalog): string {
  const documentNode = new DOMParser().parseFromString(source, 'text/html')
  for (const element of Array.from(documentNode.body.querySelectorAll<HTMLElement>(
    'span[data-oc-icon-series][data-oc-icon-key]',
  ))) {
    const seriesKey = element.getAttribute('data-oc-icon-series') ?? ''
    const iconKey = element.getAttribute('data-oc-icon-key') ?? ''
    const entry = findProjectIcon(catalog, seriesKey, iconKey)
    if (!entry) {
      element.replaceWith(documentNode.createTextNode(`[[icon:${seriesKey}/${iconKey}]]`))
      continue
    }
    element.textContent = ''
    element.className = 'project-inline-icon'
    element.setAttribute('role', 'img')
    element.setAttribute('aria-label', entry.name)
    Object.assign(element.style, createProjectIconStyle(entry))
  }
  return documentNode.body.innerHTML
}
