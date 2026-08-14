import { createAvailableKey } from '../../../shared/model/keySlug'
export const projectIconKeyPattern = /^[a-z0-9][a-z0-9._-]*$/
export const projectIconSourcePattern = /\.(?:png|jpe?g|webp)$/i
export const DEFAULT_PROJECT_ICON_DIRECTORY = 'icons'
export const PROJECT_ICON_ROTATIONS = [0, 90, 180, 270] as const
export const PROJECT_ICON_ATLAS_ROTATIONS = [0, 90, 180, 270] as const

export type ProjectIconRotation = typeof PROJECT_ICON_ROTATIONS[number]
export type ProjectIconAtlasRotation = typeof PROJECT_ICON_ATLAS_ROTATIONS[number]

export type ProjectIcon = {
  iconKey: string
  name: string
  x: number
  y: number
  width: number
  height: number
  pixelated?: boolean
  rotation?: ProjectIconRotation
  atlasRotation?: ProjectIconAtlasRotation
}

export type ProjectIconGridSettings = {
  snapToGrid: boolean
  rows: number
  columns: number
  pixelated: boolean
}

export const DEFAULT_PROJECT_ICON_GRID_SETTINGS: Readonly<ProjectIconGridSettings> = {
  snapToGrid: false,
  rows: 2,
  columns: 2,
  pixelated: false,
}

export function normalizeProjectIconDirectory(value: string): string | null {
  const directory = value.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  const segments = directory.split('/')
  if (!directory || /^[a-z]:\//i.test(directory) || directory.startsWith('//')
    || segments.some(segment => segment === '.' || segment === '..' || /[\u0000-\u001f\u007f]/.test(segment))) {
    return null
  }
  return directory
}

export type ProjectIconSeries = {
  name: string
  key: string
  source: string
  grid?: ProjectIconGridSettings
  icons: readonly ProjectIcon[]
}

export type ProjectIconKeyConflict =
  | { kind: 'series'; seriesIndex: number; key: string }
  | { kind: 'icon'; seriesIndex: number; iconIndex: number; key: string }

export type ProjectIconGridMode = 'append' | 'replace'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isProjectIconRotation(value: unknown): value is ProjectIconRotation {
  return PROJECT_ICON_ROTATIONS.includes(value as ProjectIconRotation)
}

function isProjectIconAtlasRotation(value: unknown): value is ProjectIconAtlasRotation {
  return PROJECT_ICON_ATLAS_ROTATIONS.includes(value as ProjectIconAtlasRotation)
}

export function normalizeProjectIconSource(value: string): string | null {
  const source = value.trim().replace(/\\/g, '/')
  const segments = source.split('/')
  if (!source || source.startsWith('/') || /^[a-z]:\//i.test(source)
    || segments.includes('..') || !projectIconSourcePattern.test(source)) return null
  return source
}

export function parseProjectIconSeries(value: unknown): ProjectIconSeries[] | null {
  if (!Array.isArray(value)) return null
  const result: ProjectIconSeries[] = []

  for (const candidate of value) {
    if (!isRecord(candidate)) return null
    if (typeof candidate.name !== 'string' || candidate.name.trim() === '') return null
    if (typeof candidate.key !== 'string' || !projectIconKeyPattern.test(candidate.key)) return null
    if (typeof candidate.source !== 'string') return null
    const source = normalizeProjectIconSource(candidate.source)
    if (!source || !Array.isArray(candidate.icons)) return null
    let grid: ProjectIconGridSettings | undefined
    if (candidate.grid !== undefined) {
      if (!isRecord(candidate.grid)
        || typeof candidate.grid.snapToGrid !== 'boolean'
        || (candidate.grid.pixelated !== undefined && typeof candidate.grid.pixelated !== 'boolean')
        || !isPositiveInteger(candidate.grid.rows)
        || !isPositiveInteger(candidate.grid.columns)) return null
      grid = {
        snapToGrid: candidate.grid.snapToGrid,
        rows: candidate.grid.rows,
        columns: candidate.grid.columns,
        pixelated: candidate.grid.pixelated ?? false,
      }
    }

    const icons: ProjectIcon[] = []
    for (const icon of candidate.icons) {
      if (!isRecord(icon)) return null
      if (typeof icon.iconKey !== 'string' || !projectIconKeyPattern.test(icon.iconKey)) return null
      if (typeof icon.name !== 'string') return null
      if (!isNonNegativeInteger(icon.x) || !isNonNegativeInteger(icon.y)
        || !isPositiveInteger(icon.width) || !isPositiveInteger(icon.height)
        || (icon.pixelated !== undefined && typeof icon.pixelated !== 'boolean')
        || (icon.rotation !== undefined && !isProjectIconRotation(icon.rotation))
        || (icon.atlasRotation !== undefined && !isProjectIconAtlasRotation(icon.atlasRotation))) return null
      icons.push({
        iconKey: icon.iconKey,
        name: icon.name,
        x: icon.x,
        y: icon.y,
        width: icon.width,
        height: icon.height,
        ...(icon.pixelated !== undefined ? { pixelated: icon.pixelated } : {}),
        ...(icon.rotation !== undefined ? { rotation: icon.rotation } : {}),
        ...(icon.atlasRotation !== undefined ? { atlasRotation: icon.atlasRotation } : {}),
      })
    }
    result.push({ name: candidate.name.trim(), key: candidate.key, source, ...(grid ? { grid } : {}), icons })
  }
  return result
}

function collectDuplicateLocations<T>(
  entries: readonly T[],
  keyOf: (entry: T) => string,
): number[] {
  const locationsByKey = new Map<string, number[]>()
  for (const [index, entry] of entries.entries()) {
    const identity = keyOf(entry).toLocaleLowerCase()
    const locations = locationsByKey.get(identity)
    if (locations) locations.push(index)
    else locationsByKey.set(identity, [index])
  }
  return [...locationsByKey.values()].filter(locations => locations.length > 1).flat()
}

export function findProjectIconKeyConflicts(
  seriesList: readonly ProjectIconSeries[] | null | undefined,
): ProjectIconKeyConflict[] {
  const series = seriesList ?? []
  const conflicts: ProjectIconKeyConflict[] = collectDuplicateLocations(series, item => item.key)
    .map(seriesIndex => ({ kind: 'series', seriesIndex, key: series[seriesIndex]!.key }))

  for (const [seriesIndex, item] of series.entries()) {
    conflicts.push(...collectDuplicateLocations(item.icons, icon => icon.iconKey).map(iconIndex => ({
      kind: 'icon' as const,
      seriesIndex,
      iconIndex,
      key: item.icons[iconIndex]!.iconKey,
    })))
  }
  return conflicts
}

export function createAvailableProjectIconKey(
  base: string,
  icons: readonly ProjectIcon[],
): string {
  return createAvailableKey(base, icons.map(icon => icon.iconKey), 'icon')
}

export function createAvailableProjectIconSeriesKey(
  base: string,
  seriesList: readonly ProjectIconSeries[],
): string {
  return createAvailableKey(
    base.replace(/\.(?:png|jpe?g|webp)$/i, ''),
    seriesList.map(series => series.key),
    'icons',
  )
}

export function generateProjectIconGrid(options: {
  series: ProjectIconSeries
  imageWidth: number
  imageHeight: number
  rows: number
  columns: number
  mode: ProjectIconGridMode
  pixelated?: boolean
  createName?: (position: { index: number; row: number; column: number }) => string
}): ProjectIconSeries | null {
  const { series, imageWidth, imageHeight, rows, columns, mode, pixelated, createName } = options
  if (![imageWidth, imageHeight, rows, columns].every(isPositiveInteger)) return null
  const icons = mode === 'append' ? [...series.icons] : []
  for (let row = 0; row < rows; row += 1) {
    const y = Math.floor(row * imageHeight / rows)
    const bottom = Math.floor((row + 1) * imageHeight / rows)
    for (let column = 0; column < columns; column += 1) {
      const x = Math.floor(column * imageWidth / columns)
      const right = Math.floor((column + 1) * imageWidth / columns)
      icons.push({
        iconKey: createAvailableProjectIconKey(`r${row + 1}-c${column + 1}`, icons),
        name: createName?.({ index: icons.length + 1, row: row + 1, column: column + 1 })
          ?? `Icon ${icons.length + 1}`,
        x,
        y,
        width: right - x,
        height: bottom - y,
        ...(pixelated !== undefined ? { pixelated } : {}),
      })
    }
  }
  return { ...series, icons }
}

export function appendProjectIconCrop(options: {
  series: ProjectIconSeries
  imageWidth: number
  imageHeight: number
  rows: number
  columns: number
  name: string
  pixelated?: boolean
}): ProjectIconSeries | null {
  const { series, imageWidth, imageHeight, rows, columns, name, pixelated } = options
  if (![imageWidth, imageHeight, rows, columns].every(isPositiveInteger) || name.trim() === '') return null
  const icon: ProjectIcon = {
    name: name.trim(),
    iconKey: createAvailableProjectIconKey(name, series.icons),
    x: 0,
    y: 0,
    width: Math.max(1, Math.floor(imageWidth / columns)),
    height: Math.max(1, Math.floor(imageHeight / rows)),
    ...(pixelated !== undefined ? { pixelated } : {}),
  }
  return { ...series, icons: [...series.icons, icon] }
}

export function duplicateProjectIcon(
  series: ProjectIconSeries,
  index: number,
): ProjectIconSeries {
  const source = series.icons[index]
  if (!source) return series
  const duplicate: ProjectIcon = {
    ...source,
    iconKey: createAvailableProjectIconKey(source.iconKey, series.icons),
  }
  const icons = [...series.icons]
  icons.splice(index + 1, 0, duplicate)
  return { ...series, icons }
}

export function moveProjectIcon(
  series: ProjectIconSeries,
  fromIndex: number,
  toIndex: number,
): ProjectIconSeries {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)
    || fromIndex < 0 || fromIndex >= series.icons.length
    || toIndex < 0 || toIndex >= series.icons.length || fromIndex === toIndex) return series
  const icons = [...series.icons]
  const [moved] = icons.splice(fromIndex, 1)
  icons.splice(toIndex, 0, moved!)
  return { ...series, icons }
}
