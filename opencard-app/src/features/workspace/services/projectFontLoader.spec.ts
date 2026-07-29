import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearProjectFonts, syncProjectFonts } from './projectFontLoader'

const originalFontSetDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts')

describe('projectFontLoader', () => {
  afterEach(() => {
    clearProjectFonts()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    if (originalFontSetDescriptor) Object.defineProperty(document, 'fonts', originalFontSetDescriptor)
    else Reflect.deleteProperty(document, 'fonts')
  })

  it('registers export-visible font-face rules and reports per-face failures', async () => {
    const load = vi.fn(async (font: string) => {
      if (font.includes('700')) throw new Error('Invalid font data')
      return [{}]
    })
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        load,
        ready: Promise.resolve(),
      },
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const result = await syncProjectFonts({
      brand: {
        family: 'Brand',
        faces: [
          { source: 'assets/Brand.woff2' },
          { source: 'assets/Broken.woff2', weight: '700' },
        ],
      },
    }, source => `asset://${source}`)

    expect(result).toEqual({
      current: true,
      errors: [{ fontId: 'brand', source: 'assets/Broken.woff2', message: 'Invalid font data' }],
    })
    const style = document.head.querySelector('style[data-opencard-project-fonts]')
    expect(style?.textContent).toContain('font-family: "OpenCardProjectFont-brand"')
    expect(style?.textContent).toContain('url("asset://assets/Brand.woff2")')
    expect(style?.textContent).toContain('font-weight: 700')
    expect(load).toHaveBeenCalledWith('normal normal 16px "OpenCardProjectFont-brand"')
    expect(load).toHaveBeenCalledWith('normal 700 16px "OpenCardProjectFont-brand"')
  })

  it('atomically replaces and clears the owned project font stylesheet', async () => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { load: vi.fn(async () => [{}]), ready: Promise.resolve() },
    })

    await syncProjectFonts({
      first: { family: 'First', faces: [{ source: 'First.woff2' }] },
    }, source => `asset://${source}`)
    await syncProjectFonts({
      second: { family: 'Second', faces: [{ source: 'Second.woff2' }] },
    }, source => `asset://${source}`)

    const styles = document.head.querySelectorAll('style[data-opencard-project-fonts]')
    expect(styles).toHaveLength(1)
    expect(styles[0]?.textContent).not.toContain('OpenCardProjectFont-first')
    expect(styles[0]?.textContent).toContain('OpenCardProjectFont-second')

    clearProjectFonts()
    expect(document.head.querySelector('style[data-opencard-project-fonts]')).toBeNull()
  })
})
