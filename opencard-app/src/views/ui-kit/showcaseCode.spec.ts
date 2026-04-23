import { describe, expect, it } from 'vitest'
import { UI_KIT_SECTIONS } from './catalog'
import { getShowcaseCode } from './showcaseCode'

describe('showcaseCode', () => {
  it('extracts matrix snippets for every ui-kit example id', () => {
    for (const section of UI_KIT_SECTIONS) {
      for (const example of section.examples) {
        const code = getShowcaseCode(example.id)

        expect(code.default).not.toContain('code unavailable')
        expect(code.variants).not.toContain('code unavailable')
        expect(code.states).not.toContain('code unavailable')
        expect(code.layout).not.toContain('code unavailable')
      }
    }
  })

  it('includes referenced setup constants for simple bound props', () => {
    const axisCode = getShowcaseCode('base-oc-axis-layout')

    expect(axisCode.default).toContain("const axisHorizontalRegions = [")
    expect(axisCode.layout).toContain("const axisLayoutRegions = [")
    expect(axisCode.layout).not.toContain('const alignOptions')

    const overlayCode = getShowcaseCode('base-oc-overlay')
    expect(overlayCode.layout).toContain("const overlayLayoutRegions = [")
  })
})
