import { describe, expect, it } from 'vitest'
import {
  createAvailableProjectIconSeriesKey,
  DEFAULT_PROJECT_ICON_DIRECTORY,
  DEFAULT_PROJECT_ICON_GRID_SETTINGS,
  formatProjectIconToken,
  findProjectIconKeyConflicts,
  generateProjectIconGrid,
  moveProjectIcon,
  normalizeProjectIconDirectory,
  parseProjectIconSeries,
  parseProjectIconToken,
  type ProjectIconSeries,
} from './projectIcons'

const series: ProjectIconSeries = {
  name: 'Status icons',
  key: 'status',
  source: 'assets/icons/status.png',
  icons: [{ iconKey: 'existing', name: 'Existing', x: 0, y: 0, width: 8, height: 8 }],
}

describe('projectIcons', () => {
  it('defaults newly registered icon sets to a 2 by 2 grid', () => {
    expect(DEFAULT_PROJECT_ICON_GRID_SETTINGS).toEqual({ snapToGrid: false, rows: 2, columns: 2, pixelated: false })
    expect(DEFAULT_PROJECT_ICON_DIRECTORY).toBe('assets/icons')
    expect(normalizeProjectIconDirectory(' resources\\icons/ ')).toBe('resources/icons')
    expect(normalizeProjectIconDirectory('../icons')).toBeNull()
  })

  it('creates a case-insensitively unique series key from a filename', () => {
    expect(createAvailableProjectIconSeriesKey('Status.PNG', [series])).toBe('status-2')
  })

  it('parses independent display names and ignores unknown persisted fields', () => {
    expect(parseProjectIconSeries([series])).toEqual([series])
    expect(parseProjectIconSeries([{ ...series, width: 32 }])).toEqual([series])
    expect(parseProjectIconSeries([{ ...series, name: '  状态图标  ' }])?.[0]?.name).toBe('状态图标')
    expect(parseProjectIconSeries([{ key: series.key, source: series.source, icons: [] }])).toBeNull()
  })

  it('parses persistent grid settings and rejects invalid dimensions', () => {
    const withGrid = {
      ...series,
      grid: { snapToGrid: true, rows: 3, columns: 4 },
    }
    expect(parseProjectIconSeries([withGrid])).toEqual([{ ...withGrid, grid: { ...withGrid.grid, pixelated: false } }])
    expect(parseProjectIconSeries([{ ...withGrid, grid: { ...withGrid.grid, rows: 0 } }])).toBeNull()
  })

  it('keeps duplicate keys and empty display names as structurally readable data', () => {
    expect(parseProjectIconSeries([{ ...series, source: '../status.png' }])).toBeNull()
    expect(parseProjectIconSeries([series, { ...series, key: 'status' }])).not.toBeNull()
    expect(parseProjectIconSeries([{ ...series, icons: [
      { ...series.icons[0]!, name: '' },
      { ...series.icons[0]!, iconKey: 'existing' },
    ] }])).not.toBeNull()
    expect(parseProjectIconSeries([{ ...series, icons: [{ ...series.icons[0]!, width: 0 }] }])).toBeNull()
  })

  it('finds every case-insensitive key conflict in one projection', () => {
    expect(findProjectIconKeyConflicts([
      { ...series, icons: [...series.icons, { ...series.icons[0]!, iconKey: 'EXISTING' }] },
      { ...series, key: 'STATUS', icons: [] },
    ])).toEqual([
      { kind: 'series', seriesIndex: 0, key: 'status' },
      { kind: 'series', seriesIndex: 1, key: 'STATUS' },
      { kind: 'icon', seriesIndex: 0, iconIndex: 0, key: 'existing' },
      { kind: 'icon', seriesIndex: 0, iconIndex: 1, key: 'EXISTING' },
    ])
  })

  it('reads each icon key once when checking a 400-icon set', () => {
    let keyReads = 0
    const icons = Array.from({ length: 400 }, (_, index) => new Proxy({
      iconKey: `icon-${index}`,
      name: '',
      x: index,
      y: 0,
      width: 1,
      height: 1,
    }, {
      get(target, property, receiver) {
        if (property === 'iconKey') keyReads += 1
        return Reflect.get(target, property, receiver)
      },
    }))

    expect(findProjectIconKeyConflicts([{ ...series, icons }])).toEqual([])
    expect(keyReads).toBe(400)
  })

  it('splits non-divisible images in row-major order without gaps', () => {
    const generated = generateProjectIconGrid({
      series: { ...series, icons: [] },
      imageWidth: 5,
      imageHeight: 3,
      rows: 2,
      columns: 2,
      mode: 'replace',
      createName: ({ index }) => `Icon ${index}`,
    })!
    expect(generated.icons).toEqual([
      { iconKey: 'r1-c1', name: 'Icon 1', x: 0, y: 0, width: 2, height: 1 },
      { iconKey: 'r1-c2', name: 'Icon 2', x: 2, y: 0, width: 3, height: 1 },
      { iconKey: 'r2-c1', name: 'Icon 3', x: 0, y: 1, width: 2, height: 2 },
      { iconKey: 'r2-c2', name: 'Icon 4', x: 2, y: 1, width: 3, height: 2 },
    ])
  })

  it('appends every generated record and resolves key collisions', () => {
    const withCollision = { ...series, icons: [{ ...series.icons[0]!, iconKey: 'r1-c1' }] }
    const generated = generateProjectIconGrid({
      series: withCollision,
      imageWidth: 8,
      imageHeight: 8,
      rows: 1,
      columns: 1,
      mode: 'append',
    })!
    expect(generated.icons.map(icon => icon.iconKey)).toEqual(['r1-c1', 'r1-c1-2'])
  })

  it('applies one pixelated setting to every generated icon', () => {
    const generated = generateProjectIconGrid({
      series: { ...series, icons: [] }, imageWidth: 8, imageHeight: 8,
      rows: 2, columns: 2, mode: 'replace', pixelated: true,
    })!
    expect(generated.icons.every(icon => icon.pixelated)).toBe(true)
  })

  it('moves records without changing their identity', () => {
    const generated = generateProjectIconGrid({
      series: { ...series, icons: [] }, imageWidth: 8, imageHeight: 4, rows: 1, columns: 2, mode: 'replace',
    })!
    expect(moveProjectIcon(generated, 0, 1).icons.map(icon => icon.iconKey)).toEqual(['r1-c2', 'r1-c1'])
  })

  it('formats and parses canonical icon tokens', () => {
    expect(formatProjectIconToken('status', 'warning')).toBe('[[icon:status/warning]]')
    expect(parseProjectIconToken('[[icon:status/warning]]')).toEqual({ seriesKey: 'status', iconKey: 'warning' })
    expect(parseProjectIconToken('[[icon:STATUS/warning]]')).toBeNull()
  })
})
