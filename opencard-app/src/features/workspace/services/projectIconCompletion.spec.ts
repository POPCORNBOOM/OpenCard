import { describe, expect, it } from 'vitest'
import type { ProjectIconSeries } from '../model/projectIcons'
import type { ProjectIconCatalog } from './projectIconCatalog'
import { createProjectIconCompletionProvider } from './projectIconCompletion'

const series: ProjectIconSeries = {
  name: 'Status icons', key: 'status', source: 'assets/icons/status.png',
  icons: [{ iconKey: 'warning', name: 'Warning badge', x: 0, y: 0, width: 8, height: 4 }],
}
const catalog: ProjectIconCatalog = {
  series: [{ name: series.name, key: 'status', source: series.source, src: 'asset://status', imageWidth: 16, imageHeight: 8 }],
  entries: [{ ...series.icons[0]!, seriesKey: 'status', source: series.source, src: 'asset://status', imageWidth: 16, imageHeight: 8 }],
  errors: [],
}

describe('project icon completion', () => {
  it('completes a series first and keeps the menu open', async () => {
    const result = await createProjectIconCompletionProvider([series], catalog)({ value: 'x [[icon:st]]', cursor: 11 })
    expect(result?.items[0]).toMatchObject({ label: 'Status icons', insertText: 'status/', keepOpen: true })
  })

  it('searches icons by name and supplies a cropped thumbnail', async () => {
    const value = '[[icon:status/bad]]'
    const result = await createProjectIconCompletionProvider([series], catalog)({ value, cursor: value.length - 2 })
    expect(result?.items[0]).toMatchObject({
      label: 'Warning badge',
      insertText: '[[icon:status/warning]]',
    })
    expect(result?.items[0]?.thumbnailStyle?.width).toBe('2em')
  })

  it('browses a series and then filters only its icons between double brackets', async () => {
    const provider = createProjectIconCompletionProvider([series], catalog)
    const seriesValue = 'Use [[st]] here'
    const seriesResult = await provider({
      value: seriesValue,
      cursor: seriesValue.indexOf(']]'),
    })
    expect(seriesResult).toMatchObject({ replaceStart: 6, replaceEnd: 8 })
    expect(seriesResult?.items[0]).toMatchObject({ insertText: 'status/', keepOpen: true })

    const iconValue = 'Use [[status/badge]] here'
    const result = await provider({ value: iconValue, cursor: iconValue.indexOf(']]') })
    expect(result).toMatchObject({ replaceStart: 4, replaceEnd: iconValue.indexOf(']]') + 2 })
    expect(result?.items[0]).toMatchObject({
      key: 'project-icon:status/warning',
      insertText: '[[icon:status/warning]]',
    })
    const closedResult = await provider({
      value: iconValue,
      cursor: iconValue.indexOf(']]') + 2,
    })
    expect(closedResult).toMatchObject({ replaceStart: 4, replaceEnd: iconValue.indexOf(']]') + 2 })
  })

  it('prepares thumbnails only for the active series and reuses them while filtering', async () => {
    let sourceReads = 0
    const measuredEntry = {
      ...catalog.entries[0]!,
      get src() {
        sourceReads += 1
        return 'asset://status'
      },
    }
    const provider = createProjectIconCompletionProvider([series], {
      ...catalog,
      entries: [measuredEntry],
    })
    expect(sourceReads).toBe(0)
    await provider({ value: '[[st', cursor: 4 })
    expect(sourceReads).toBe(0)
    await provider({ value: '[[status/', cursor: 9 })
    expect(sourceReads).toBe(1)
    await provider({ value: '[[status/war', cursor: 12 })
    expect(sourceReads).toBe(1)
  })
})
