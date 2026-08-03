import type { PropertyCompletionProvider } from '../../../shared/ui/property-editor/propertyEditor.types'
import type { ProjectIconSeries } from '../model/projectIcons'
import {
  createProjectIconStyle,
  projectIconIdentity,
  type ProjectIconCatalog,
} from './projectIconCatalog'

export function createProjectIconCompletionProvider(
  seriesList: readonly ProjectIconSeries[] | null | undefined,
  catalog: ProjectIconCatalog | null | undefined,
): PropertyCompletionProvider {
  const entriesByIdentity = new Map((catalog?.entries ?? []).map(entry => [
    projectIconIdentity(entry.seriesKey, entry.iconKey),
    entry,
  ]))
  const preparedSeries = (seriesList ?? []).map(series => ({
    name: series.name,
    key: series.key,
    searchKey: series.key.toLocaleLowerCase(),
    searchName: series.name.toLocaleLowerCase(),
    icons: series.icons,
  }))
  const preparedIconsBySeries = new Map<string, Array<{
    key: string
    label: string
    detail: string
    insertText: string
    searchKeys: string[]
    thumbnailStyle?: Record<string, string>
    thumbnailLabel?: string
  }>>()

  function getPreparedIcons(series: typeof preparedSeries[number]) {
    const cached = preparedIconsBySeries.get(series.searchKey)
    if (cached) return cached
    const icons = series.icons.map(icon => {
      const entry = entriesByIdentity.get(projectIconIdentity(series.key, icon.iconKey))
      return {
        key: `project-icon:${series.key}/${icon.iconKey}`,
        label: icon.name,
        detail: icon.iconKey,
        insertText: `[[icon:${series.key}/${icon.iconKey}]]`,
        searchKeys: [icon.iconKey.toLocaleLowerCase(), icon.name.toLocaleLowerCase()],
        ...(entry ? { thumbnailStyle: createProjectIconStyle(entry), thumbnailLabel: icon.name } : {}),
      }
    })
    preparedIconsBySeries.set(series.searchKey, icons)
    return icons
  }

  return ({ value, cursor }) => {
    const closedAtCursor = value.slice(Math.max(0, cursor - 2), cursor) === ']]'
    const contentEnd = closedAtCursor ? cursor - 2 : cursor
    const start = value.lastIndexOf('[[', contentEnd)
    if (start < 0 || value.slice(0, contentEnd).lastIndexOf(']]') > start) return null
    const contentStart = start + 2
    const content = value.slice(contentStart, contentEnd)
    if (!content.startsWith('icon:')) {
      if (!/^[^\[\]\r\n]*$/.test(content)) return null
      const slash = content.indexOf('/')
      if (slash < 0) {
        const query = content.toLocaleLowerCase()
        return {
          replaceStart: contentStart,
          replaceEnd: contentEnd,
          items: preparedSeries
            .filter(series => !query || series.searchKey.startsWith(query) || series.searchName.includes(query))
            .map(series => ({
              key: `icon-series:${series.key}`,
              label: series.name,
              detail: series.key,
              insertText: `icon:${series.key}/`,
              keepOpen: true,
            })),
        }
      }

      const seriesKey = content.slice(0, slash)
      const series = preparedSeries.find(candidate => candidate.searchKey === seriesKey.toLocaleLowerCase())
      if (!series) return null
      const query = content.slice(slash + 1).toLocaleLowerCase()
      const replaceEnd = closedAtCursor ? cursor : (value.slice(cursor, cursor + 2) === ']]' ? cursor + 2 : cursor)
      return {
        replaceStart: start,
        replaceEnd,
        items: getPreparedIcons(series)
          .filter(icon => !query || icon.searchKeys.some(searchKey => searchKey.includes(query)))
          .map(({ searchKeys: _searchKeys, ...icon }) => icon),
      }
    }

    const bodyStart = contentStart + 'icon:'.length
    const body = value.slice(bodyStart, contentEnd)
    if (!/^[a-z0-9._/-]*$/i.test(body)) return null
    const slash = body.indexOf('/')

    if (slash < 0) {
      const query = body.toLocaleLowerCase()
      return {
        replaceStart: bodyStart,
        replaceEnd: cursor,
        items: preparedSeries
          .filter(series => !query || series.searchKey.startsWith(query) || series.searchName.includes(query))
          .map(series => ({
            key: `icon-series:${series.key}`,
            label: series.name,
            detail: series.key,
            insertText: `${series.key}/`,
            keepOpen: true,
          })),
      }
    }

    const seriesKey = body.slice(0, slash)
    const series = preparedSeries.find(item => item.searchKey === seriesKey.toLocaleLowerCase())
    if (!series) return null
    const query = body.slice(slash + 1).toLocaleLowerCase()
    const replaceEnd = closedAtCursor ? cursor : (value.slice(cursor, cursor + 2) === ']]' ? cursor + 2 : cursor)
    return {
      replaceStart: start,
      replaceEnd,
      items: getPreparedIcons(series)
        .filter(icon => !query || icon.searchKeys.some(searchKey => searchKey.includes(query)))
        .map(({ searchKeys: _searchKeys, ...icon }) => icon),
    }
  }
}
