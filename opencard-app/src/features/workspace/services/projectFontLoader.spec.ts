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

  it('registers export-visible font-face rules and reports per-font failures', async () => {
    const load = vi.fn(async (font: string) => {
      if (font.includes('broken')) throw new Error('Invalid font data')
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
        name: 'Brand',
        source: 'assets/Brand.woff2',
      },
      broken: {
        name: 'Broken',
        source: 'assets/Broken.woff2',
      },
    }, source => `asset://${source}`)

    expect(result).toEqual({
      current: true,
      errors: [{ fontId: 'broken', source: 'assets/Broken.woff2', message: 'Invalid font data' }],
    })
    const style = document.head.querySelector('style[data-opencard-project-fonts]')
    expect(style?.textContent).toContain('font-family: "OpenCardProjectFont-brand"')
    expect(style?.textContent).toContain('url("asset://assets/Brand.woff2")')
    expect(load).toHaveBeenCalledWith('16px "OpenCardProjectFont-brand"')
    expect(load).toHaveBeenCalledWith('16px "OpenCardProjectFont-broken"')
  })

  it('atomically replaces and clears the owned project font stylesheet', async () => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { load: vi.fn(async () => [{}]), ready: Promise.resolve() },
    })

    await syncProjectFonts({
      first: { name: 'First', source: 'First.woff2' },
    }, source => `asset://${source}`)
    await syncProjectFonts({
      second: { name: 'Second', source: 'Second.woff2' },
    }, source => `asset://${source}`)

    const styles = document.head.querySelectorAll('style[data-opencard-project-fonts]')
    expect(styles).toHaveLength(1)
    expect(styles[0]?.textContent).not.toContain('OpenCardProjectFont-first')
    expect(styles[0]?.textContent).toContain('OpenCardProjectFont-second')

    clearProjectFonts()
    expect(document.head.querySelector('style[data-opencard-project-fonts]')).toBeNull()
  })
})
