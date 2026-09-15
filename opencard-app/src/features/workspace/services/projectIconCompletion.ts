import type { PropertyCompletionItem, PropertyCompletionProvider } from '../../../shared/ui/property-editor/propertyEditor.types'
import type { ProjectIconSeries } from '../model/projectIcons'
import {
  createProjectIconStyle,
  projectIconIdentity,
  type ProjectIconCatalog,
  type ProjectIconDimensionReader,
} from './projectIconCatalog'
import { readProjectIconSize } from './projectIconDimensionResolver'

/**
 * One place project icons can come from: the current project, or a package that ships icons.
 * `packageKey` is `null` for the current project.
 */
export type ProjectIconSource = {
  packageKey: string | null
  label: string
  series: readonly ProjectIconSeries[]
  catalog: ProjectIconCatalog
}

export type ProjectIconCompletionMode =
  /** Rich text: emits the `[[[package@]icon:collection/icon]]` token. */
  | 'rich-text'
  /** A path field: emits the bare `[package@]icon:collection/icon` reference. */
  | 'reference'

export type ProjectIconCompletionOptions = {
  mode?: ProjectIconCompletionMode
  readDimensions?: ProjectIconDimensionReader
}

/** Where the cursor sits inside the reference being edited. */
type TokenState =
  /** Before `icon:` is written: the caller is choosing a collection or a source. */
  | { stage: 'prefix', query: string, bodyStart: number, bodyEnd: number, tokenStart: number, tokenEnd: number }
  /** After `[package@]icon:`: the caller is choosing a collection. */
  | { stage: 'series', packageKey: string | null, query: string, bodyStart: number, bodyEnd: number, tokenStart: number, tokenEnd: number }
  /** After `[package@]icon:collection/`: the caller is choosing an icon. */
  | { stage: 'icon', packageKey: string | null, seriesKey: string, query: string, tokenStart: number, tokenEnd: number }

type PreparedSource = {
  packageKey: string | null
  label: string
  searchKey: string
  searchLabel: string
  series: readonly ProjectIconSeries[]
}

const QUALIFIED_REFERENCE_PATTERN = /^(?:([a-z0-9._-]+)@)?icon:(.*)$/i
const PACKAGE_QUALIFIER_PATTERN = /([a-z0-9._-]+)@$/

function locateRichTextToken(value: string, cursor: number): TokenState | null {
  const closedAtCursor = value.slice(Math.max(0, cursor - 2), cursor) === ']]'
  const contentEnd = closedAtCursor ? cursor - 2 : cursor
  const start = value.lastIndexOf('[[', contentEnd)
  if (start < 0 || value.slice(0, contentEnd).lastIndexOf(']]') > start) return null
  const contentStart = start + 2
  const content = value.slice(contentStart, contentEnd)
  const matched = QUALIFIED_REFERENCE_PATTERN.exec(content)
  if (!matched) {
    return { stage: 'prefix', query: content, bodyStart: contentStart, bodyEnd: contentEnd, tokenStart: start, tokenEnd: contentEnd }
  }
  const rest = matched[2]!
  const packageKey = matched[1] ?? null
  // The body starts where `[package@]icon:` ends, measured from the content start.
  const bodyStart = contentEnd - rest.length
  const slash = rest.indexOf('/')
  if (slash < 0) {
    return { stage: 'series', packageKey, query: rest, bodyStart, bodyEnd: contentEnd, tokenStart: start, tokenEnd: contentEnd }
  }
  return {
    stage: 'icon',
    packageKey,
    seriesKey: rest.slice(0, slash),
    query: rest.slice(slash + 1),
    tokenStart: start,
    tokenEnd: closedAtCursor ? cursor : (value.slice(cursor, cursor + 2) === ']]' ? cursor + 2 : cursor),
  }
}

function locateReferenceToken(value: string, cursor: number): TokenState | null {
  const head = value.slice(0, cursor)
  const iconAt = head.lastIndexOf('icon:')
  if (iconAt < 0) return null
  const qualifier = PACKAGE_QUALIFIER_PATTERN.exec(head.slice(0, iconAt))
  const packageKey = qualifier?.[1] ?? null
  const tokenStart = qualifier ? iconAt - qualifier[1]!.length - 1 : iconAt
  const rest = value.slice(iconAt + 'icon:'.length)
  const bodyStart = iconAt + 'icon:'.length
  const slash = rest.indexOf('/')
  // A path field owns the whole value, so every replacement extends to its end.
  if (slash < 0) {
    return { stage: 'series', packageKey, query: rest, bodyStart, bodyEnd: value.length, tokenStart, tokenEnd: value.length }
  }
  return {
    stage: 'icon',
    packageKey,
    seriesKey: rest.slice(0, slash),
    query: rest.slice(slash + 1),
    tokenStart,
    tokenEnd: value.length,
  }
}

function qualify(packageKey: string | null, reference: string): string {
  return `${packageKey ? `${packageKey}@` : ''}${reference}`
}

export function createProjectIconCompletionProvider(
  sources: readonly ProjectIconSource[],
  options: ProjectIconCompletionOptions = {},
): PropertyCompletionProvider {
  const richText = (options.mode ?? 'rich-text') === 'rich-text'
  const readDimensions = options.readDimensions ?? readProjectIconSize

  const preparedSources: PreparedSource[] = sources.map(source => ({
    packageKey: source.packageKey,
    label: source.label,
    searchKey: (source.packageKey ?? '').toLocaleLowerCase(),
    searchLabel: source.label.toLocaleLowerCase(),
    series: source.series,
  }))
  const catalogByPackage = new Map<string, ProjectIconCatalog>(
    sources.map(source => [source.packageKey ?? '', source.catalog]),
  )
  const preparedIconsByCollection = new Map<string, Array<{
    key: string
    label: string
    detail: string
    insertText: string
    searchKeys: string[]
    thumbnailStyle?: Record<string, string>
    thumbnailLabel?: string
  }>>()

  function sourceFor(packageKey: string | null): PreparedSource | null {
    const searchKey = (packageKey ?? '').toLocaleLowerCase()
    return preparedSources.find(source => source.searchKey === searchKey) ?? null
  }

  function collectionItems(packageKey: string | null, query: string): PropertyCompletionItem[] {
    const source = sourceFor(packageKey)
    if (!source) return []
    const needle = query.toLocaleLowerCase()
    return source.series
      .filter(series => !needle
        || series.key.toLocaleLowerCase().startsWith(needle)
        || series.name.toLocaleLowerCase().includes(needle))
      .map(series => ({
        key: `project-icon-series:${packageKey ?? ''}:${series.key}`,
        label: series.name,
        detail: series.key,
        insertText: `${series.key}/`,
        keepOpen: true,
      }))
  }

  /** Packages that ship icons, offered while the caller has not named a package yet. */
  function sourceItems(query: string): PropertyCompletionItem[] {
    const needle = query.toLocaleLowerCase()
    return preparedSources
      .filter(source => source.packageKey !== null)
      .filter(source => !needle || source.searchKey.startsWith(needle) || source.searchLabel.includes(needle))
      .map(source => ({
        key: `project-icon-source:${source.packageKey}`,
        label: source.label,
        detail: source.packageKey ?? '',
        insertText: qualify(source.packageKey, 'icon:'),
        keepOpen: true,
      }))
  }

  function iconItems(packageKey: string | null, seriesKey: string, query: string): PropertyCompletionItem[] {
    const source = sourceFor(packageKey)
    const catalog = catalogByPackage.get(packageKey ?? '')
    const series = source?.series.find(candidate => candidate.key.toLocaleLowerCase() === seriesKey.toLocaleLowerCase())
    if (!source || !catalog || !series) return []
    // Thumbnails are measured once per collection and reused while the query filters them.
    const cacheKey = `${packageKey ?? ''}\u0000${series.key.toLocaleLowerCase()}`
    let prepared = preparedIconsByCollection.get(cacheKey)
    if (!prepared) {
      prepared = series.icons.map(icon => {
        const entry = catalog.entries.find(candidate => (
          projectIconIdentity(candidate.seriesKey, candidate.iconKey) === projectIconIdentity(series.key, icon.iconKey)
        ))
        const reference = qualify(packageKey, `icon:${series.key}/${icon.iconKey}`)
        return {
          key: `project-icon:${packageKey ?? ''}:${series.key}/${icon.iconKey}`,
          label: icon.name,
          detail: icon.iconKey,
          insertText: richText ? `[[${reference}]]` : reference,
          searchKeys: [icon.iconKey.toLocaleLowerCase(), icon.name.toLocaleLowerCase()],
          ...(entry ? { thumbnailStyle: createProjectIconStyle(entry, readDimensions), thumbnailLabel: icon.name } : {}),
        }
      })
      preparedIconsByCollection.set(cacheKey, prepared)
    }
    const needle = query.toLocaleLowerCase()
    return prepared
      .filter(icon => !needle || icon.searchKeys.some(searchKey => searchKey.includes(needle)))
      .map(({ searchKeys: _searchKeys, ...icon }) => icon)
  }

  return ({ value, cursor }) => {
    const state = richText ? locateRichTextToken(value, cursor) : locateReferenceToken(value, cursor)
    if (!state) return null

    if (state.stage === 'prefix') {
      // Inside `[[` the caller may still be naming a current-project collection, so offer those
      // collections first and the packages that ship icons after them.
      const items: PropertyCompletionItem[] = [
        ...collectionItems(null, state.query).map(item => ({
          ...item,
          key: `project-icon-series::${item.detail}`,
          insertText: `icon:${item.insertText}`,
        })),
        ...sourceItems(state.query),
      ]
      return { replaceStart: state.bodyStart, replaceEnd: state.bodyEnd, items }
    }

    if (state.stage === 'series') {
      const items = state.packageKey === null
        ? [...collectionItems(null, state.query), ...sourceItems(state.query)]
        : collectionItems(state.packageKey, state.query)
      if (!items.length) return null
      return { replaceStart: state.bodyStart, replaceEnd: state.bodyEnd, items }
    }

    const items = iconItems(state.packageKey, state.seriesKey, state.query)
    if (!items.length) return null
    return { replaceStart: state.tokenStart, replaceEnd: state.tokenEnd, items }
  }
}
