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

  it('returns per-face failures while keeping successful project fonts available', async () => {
    const addedFaces: Array<{ family: string }> = []
    class MockFontFace {
      constructor(
        readonly family: string,
        readonly source: string,
      ) {}

      async load() {
        if (this.source.includes('Broken')) throw new Error('Invalid font data')
        return this
      }
    }
    vi.stubGlobal('FontFace', MockFontFace)
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        add: (face: { family: string }) => addedFaces.push(face),
        delete: vi.fn(),
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
    expect(addedFaces.map(face => face.family)).toEqual(['OpenCardProjectFont-brand'])
  })
})
