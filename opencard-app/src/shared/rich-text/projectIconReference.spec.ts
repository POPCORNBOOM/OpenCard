import { describe, expect, it } from 'vitest'
import {
  collectProjectIconReferences,
  readProjectIconElement,
  rewriteProjectIconReferences,
} from './projectIconReference'

describe('project icon references', () => {
  it('reads icon elements independent of attribute order', () => {
    const element = document.createElement('span')
    element.setAttribute('data-oc-icon-path', 'status/wide')
    expect(readProjectIconElement(element)).toEqual({ seriesKey: 'status', iconKey: 'wide' })
  })

  it('collects only explicit rich-text icon elements', () => {
    expect(collectProjectIconReferences(
      '<p><span data-oc-icon-path="status/wide"></span> [[icon:items/sword]]</p>',
    )).toEqual([
      { seriesKey: 'status', iconKey: 'wide' },
    ])
  })

  it('rewrites only explicit rich-text icon elements', () => {
    const source = '<p><span data-oc-icon-path="old/wide"></span> [[icon:old/tall]]</p>'
    const result = rewriteProjectIconReferences(source, reference => ({
      seriesKey: 'packaged',
      iconKey: `icon-${reference.iconKey}`,
    }))
    expect(result).toContain('data-oc-icon-path="packaged/icon-wide"')
    expect(result).toContain('[[icon:old/tall]]')
  })
})
