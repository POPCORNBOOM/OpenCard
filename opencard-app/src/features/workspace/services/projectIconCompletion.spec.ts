import { describe, expect, it } from 'vitest'
import type { ProjectIconSeries } from '../model/projectIcons'
import type { ProjectIconCatalog } from './projectIconCatalog'
import { createProjectIconCompletionProvider, type ProjectIconSource } from './projectIconCompletion'

const projectSeries: ProjectIconSeries = {
  name: 'Status icons', key: 'status',
  icons: [{ iconKey: 'warning', name: 'Warning badge', source: 'assets/icons/warning.svg', tint: 'theme' }],
}
const projectCatalog: ProjectIconCatalog = {
  series: [{ name: projectSeries.name, key: 'status' }],
  entries: [{ ...projectSeries.icons[0]!, seriesKey: 'status', src: 'asset://status' }],
  errors: [],
}
const packageSeries: ProjectIconSeries = {
  name: 'Theme marks', key: 'mark',
  icons: [{ iconKey: 'sword', name: 'Sword', source: 'assets/icons/sword.svg', tint: 'original' }],
}
const packageCatalog: ProjectIconCatalog = {
  series: [{ name: packageSeries.name, key: 'mark' }],
  entries: [{ ...packageSeries.icons[0]!, seriesKey: 'mark', src: 'asset://theme/mark' }],
  errors: [],
}

const projectSource: ProjectIconSource = {
  packageKey: null, label: 'This project', series: [projectSeries], catalog: projectCatalog,
}
const packageSource: ProjectIconSource = {
  packageKey: 'theme', label: 'Theme Pack', series: [packageSeries], catalog: packageCatalog,
}
const sources = [projectSource, packageSource]
/** Sizes as the resolver reports them once the icon has been painted. */
const readSize = () => ({ width: 16, height: 8 })

describe('project icon completion', () => {
  it('completes a collection after icon: and keeps the menu open', async () => {
    const result = await createProjectIconCompletionProvider(sources)({ value: 'x [[icon:st]]', cursor: 11 })
    expect(result).toMatchObject({ replaceStart: 9, replaceEnd: 11 })
    expect(result?.items[0]).toMatchObject({
      label: 'Status icons', detail: 'status', insertText: 'status/', keepOpen: true,
    })
  })

  it('searches icons and supplies a measured thumbnail', async () => {
    const value = '[[icon:status/bad]]'
    const result = await createProjectIconCompletionProvider(sources, { readDimensions: readSize })(
      { value, cursor: value.length - 2 },
    )
    expect(result?.items[0]).toMatchObject({
      label: 'Warning badge',
      detail: 'warning',
      insertText: '[[icon:status/warning]]',
    })
    expect(result?.items[0]?.thumbnailStyle?.width).toBe('2em')
  })

  it('browses a collection between double brackets and then writes the canonical token', async () => {
    const provider = createProjectIconCompletionProvider(sources)

    const seriesValue = 'Use [[st]] here'
    const seriesResult = await provider({ value: seriesValue, cursor: seriesValue.indexOf(']]') })
    expect(seriesResult).toMatchObject({ replaceStart: 6, replaceEnd: 8 })
    expect(seriesResult?.items[0]).toMatchObject({ insertText: 'icon:status/', keepOpen: true })

    const iconValue = 'Use [[icon:status/]] here'
    const iconResult = await provider({ value: iconValue, cursor: iconValue.indexOf(']]') })
    expect(iconResult).toMatchObject({ replaceStart: 4, replaceEnd: iconValue.indexOf(']]') + 2 })
    expect(iconResult?.items[0]).toMatchObject({ insertText: '[[icon:status/warning]]' })
  })

  it('offers the packages that ship icons and writes the package qualifier', async () => {
    const provider = createProjectIconCompletionProvider(sources)

    const empty = await provider({ value: '[[', cursor: 2 })
    expect(empty?.items).toContainEqual(expect.objectContaining({
      key: 'project-icon-source:theme',
      label: 'Theme Pack',
      insertText: 'theme@icon:',
      keepOpen: true,
    }))

    const packagePrefix = '[[theme@icon:'
    const seriesResult = await provider({ value: packagePrefix, cursor: packagePrefix.length })
    expect(seriesResult?.items[0]).toMatchObject({ label: 'Theme marks', insertText: 'mark/', keepOpen: true })

    const packageIcon = '[[theme@icon:mark/'
    const iconResult = await provider({ value: packageIcon, cursor: packageIcon.length })
    expect(iconResult?.items[0]).toMatchObject({
      key: 'project-icon:theme:mark/sword',
      insertText: '[[theme@icon:mark/sword]]',
    })
  })

  it('writes the bare reference for a path field and leaves plain paths alone', async () => {
    const provider = createProjectIconCompletionProvider(sources, { mode: 'reference' })

    const seriesValue = 'icon:st'
    const seriesResult = await provider({ value: seriesValue, cursor: seriesValue.length })
    expect(seriesResult).toMatchObject({ replaceStart: 5, replaceEnd: seriesValue.length })
    expect(seriesResult?.items[0]).toMatchObject({ label: 'Status icons', insertText: 'status/' })

    const iconValue = 'icon:status/'
    const iconResult = await provider({ value: iconValue, cursor: iconValue.length })
    expect(iconResult).toMatchObject({ replaceStart: 0, replaceEnd: iconValue.length })
    expect(iconResult?.items[0]).toMatchObject({ insertText: 'icon:status/warning' })

    const packageValue = 'theme@icon:mark/'
    const packageResult = await provider({ value: packageValue, cursor: packageValue.length })
    expect(packageResult).toMatchObject({ replaceStart: 0, replaceEnd: packageValue.length })
    expect(packageResult?.items[0]).toMatchObject({ insertText: 'theme@icon:mark/sword' })

    expect(await provider({ value: 'assets/portrait.png', cursor: 20 })).toBeNull()
  })

  it('prepares thumbnails only for the active collection and reuses them while filtering', async () => {
    let sourceReads = 0
    const measuredEntry = {
      ...projectCatalog.entries[0]!,
      get src() {
        sourceReads += 1
        return 'asset://status'
      },
    }
    const provider = createProjectIconCompletionProvider([
      { ...projectSource, catalog: { ...projectCatalog, entries: [measuredEntry] } },
    ])
    expect(sourceReads).toBe(0)
    await provider({ value: '[[st', cursor: 4 })
    expect(sourceReads).toBe(0)
    await provider({ value: '[[icon:status/', cursor: 14 })
    expect(sourceReads).toBe(1)
    await provider({ value: '[[icon:status/war', cursor: 17 })
    expect(sourceReads).toBe(1)
  })
})
