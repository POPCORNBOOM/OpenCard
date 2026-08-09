import { describe, expect, it } from 'vitest'
import {
  collectProjectIconReferences,
  findProjectIconTokenMatches,
  parseProjectIconToken,
  readProjectIconElement,
  rewriteProjectIconReferences,
} from './projectIconReference'

describe('project icon references', () => {
  it('parses exact tokens and finds embedded tokens without shared regex state', () => {
    expect(parseProjectIconToken('[[icon:status/wide]]')).toEqual({ seriesKey: 'status', iconKey: 'wide' })
    expect(parseProjectIconToken('x [[icon:status/wide]]')).toBeNull()
    expect(findProjectIconTokenMatches('[[icon:a/one]] + [[icon:b/two]]')).toMatchObject([
      { seriesKey: 'a', iconKey: 'one', index: 0 },
      { seriesKey: 'b', iconKey: 'two', index: 17 },
    ])
  })

  it('reads icon elements independent of attribute order', () => {
    const element = document.createElement('span')
    element.setAttribute('data-oc-icon-key', 'wide')
    element.setAttribute('data-oc-icon-series', 'status')
    expect(readProjectIconElement(element)).toEqual({ seriesKey: 'status', iconKey: 'wide' })
  })

  it('collects icon elements and standalone tokens once', () => {
    expect(collectProjectIconReferences(
      '<p><span data-oc-icon-key="wide" data-oc-icon-series="status">[[icon:status/wide]]</span> [[icon:items/sword]]</p>',
    )).toEqual([
      { seriesKey: 'status', iconKey: 'wide' },
      { seriesKey: 'items', iconKey: 'sword' },
    ])
  })

  it('rewrites element and standalone token references together', () => {
    const source = '<p><span data-oc-icon-series="old" data-oc-icon-key="wide">[[icon:old/wide]]</span> [[icon:old/tall]]</p>'
    const result = rewriteProjectIconReferences(source, reference => ({
      seriesKey: 'packaged',
      iconKey: `icon-${reference.iconKey}`,
    }))
    expect(result).toContain('data-oc-icon-series="packaged"')
    expect(result).toContain('data-oc-icon-key="icon-wide"')
    expect(result).toContain('[[icon:packaged/icon-tall]]')
  })
})
