import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearProjectFonts, createProjectFontCss, syncProjectFonts } from './projectFontLoader'

const originalFontSetDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts')
const face = (source: string, weight = { min: 400, max: 400 }) => ({
  source,
  weight,
  stretch: { min: 100, max: 100 },
  style: { kind: 'normal' as const },
})

describe('projectFontLoader', () => {
  afterEach(() => {
    clearProjectFonts()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    if (originalFontSetDescriptor) Object.defineProperty(document, 'fonts', originalFontSetDescriptor)
    else Reflect.deleteProperty(document, 'fonts')
  })

  it('registers every family face with its complete CSS descriptors', async () => {
    const load = vi.fn(async (font: string) => {
      if (font.includes('broken')) throw new Error('Invalid font data')
      return [{}]
    })
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { load, ready: Promise.resolve() },
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const result = await syncProjectFonts([
      { key: 'brand', name: 'Brand', faces: [face('fonts/Brand.woff2', { min: 300, max: 700 })] },
      { key: 'broken', name: 'Broken', faces: [face('fonts/Broken.woff2')] },
    ], source => `asset://${source}`)

    expect(result).toEqual({
      current: true,
      errors: [{ familyKey: 'broken', source: 'fonts/Broken.woff2', message: 'Invalid font data' }],
    })
    const css = document.head.querySelector('style[data-opencard-project-fonts]')?.textContent
    expect(css).toContain('font-family: "OpenCardProjectFontFamily-brand"')
    expect(css).toContain('font-weight: 300 700')
    expect(css).toContain('font-stretch: 100%')
    expect(load).toHaveBeenCalledWith('16px "OpenCardProjectFontFamily-brand"')
  })

  it('creates disjoint actual-coverage rules for an ordered composition', async () => {
    const regular = { key: 'latin', name: 'Latin', faces: [face('fonts/Latin.ttf')] }
    const fallback = { key: 'fallback', name: 'Fallback', faces: [face('fonts/Fallback.ttf')] }
    const generated = await createProjectFontCss(
      [regular, fallback],
      [{
        key: 'body',
        name: 'Body',
        members: [
          { familyKey: 'latin', ranges: [{ start: 65, end: 90 }] },
          { familyKey: 'fallback' },
        ],
      }],
      source => `asset://${source}`,
      async source => source.includes('Latin') ? new Set([65, 66]) : new Set([65, 66, 67, 0x4e2d]),
    )

    const compositionRules = generated.cssText.split('\n')
      .filter(rule => rule.includes('OpenCardProjectFontComposition-body'))
    expect(compositionRules).toHaveLength(2)
    expect(compositionRules[0]).toContain('unicode-range: U+41-42')
    expect(compositionRules[1]).toContain('unicode-range: U+43, U+4E2D')
  })

  it('atomically replaces and clears the owned project font stylesheet', async () => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { load: vi.fn(async () => [{}]), ready: Promise.resolve() },
    })

    await syncProjectFonts([{ key: 'first', name: 'First', faces: [face('fonts/First.woff2')] }], source => source)
    await syncProjectFonts([{ key: 'second', name: 'Second', faces: [face('fonts/Second.woff2')] }], source => source)

    const styles = document.head.querySelectorAll('style[data-opencard-project-fonts]')
    expect(styles).toHaveLength(1)
    expect(styles[0]?.textContent).not.toContain('OpenCardProjectFontFamily-first')
    expect(styles[0]?.textContent).toContain('OpenCardProjectFontFamily-second')

    clearProjectFonts()
    expect(document.head.querySelector('style[data-opencard-project-fonts]')).toBeNull()
  })
})
