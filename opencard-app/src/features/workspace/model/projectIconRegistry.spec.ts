import { describe, expect, it } from 'vitest'
import {
  parseProjectIconRegistry,
  parseProjectIconRegistryText,
  serializeProjectIconRegistry,
} from './projectIconRegistry'

describe('project icon registry', () => {
  it('normalizes icon series and ignores unknown document fields', () => {
    expect(parseProjectIconRegistry({
      schemaVersion: 1,
      iconSeries: [{
        key: 'status',
        source: 'assets\\icons\\status.png',
        grid: { snapToGrid: true, rows: 2, columns: 3 },
        icons: [{ iconKey: 'warning', name: 'Warning', x: 0, y: 0, width: 16, height: 16 }],
      }],
    })).toEqual({
      iconSeries: [{
        key: 'status',
        source: 'assets/icons/status.png',
        grid: { snapToGrid: true, rows: 2, columns: 3, pixelated: false },
        icons: [{ iconKey: 'warning', name: 'Warning', x: 0, y: 0, width: 16, height: 16 }],
      }],
    })
  })

  it('keeps nested icon records strict', () => {
    expect(parseProjectIconRegistry({
      iconSeries: [{ key: 'status', source: 'status.png', width: 32, icons: [] }],
    })).toBeNull()
  })

  it('uses an empty canonical document and rejects invalid JSON', () => {
    expect(JSON.parse(serializeProjectIconRegistry({ iconSeries: [] }))).toEqual({})
    expect(parseProjectIconRegistryText('{broken')).toBeNull()
  })
})
