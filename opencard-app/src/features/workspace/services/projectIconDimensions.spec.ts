import { describe, expect, it } from 'vitest'
import { readProjectIconDimensions } from './projectIconDimensions'

describe('readProjectIconDimensions', () => {
  it('reads a square vector from width and height', () => {
    expect(readProjectIconDimensions('icons/warn.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M0 0" /></svg>',
    )).toEqual({ width: 24, height: 24 })
  })

  it('reads a wide vector from width and height', () => {
    expect(readProjectIconDimensions('icons/banner.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><g /></svg>',
    )).toEqual({ width: 120, height: 40 })
  })

  it('falls back to the viewBox when the vector states no canvas size', () => {
    expect(readProjectIconDimensions('icons/logo.svg',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 12"><path d="M0 0" /></svg>',
    )).toEqual({ width: 24, height: 12 })
  })

  it('reads the root element only, never a nested shape', () => {
    expect(readProjectIconDimensions('icons/nested.svg',
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4" /><g viewBox="0 0 8 8" /></svg>',
    )).toBeNull()
  })

  it('accepts single-quoted attributes and px units', () => {
    expect(readProjectIconDimensions('icons/quoted.svg',
      "<svg viewBox='0 0 32 16' width='32px' height='16px'></svg>",
    )).toEqual({ width: 32, height: 16 })
  })

  it('refuses a relative size, which cannot name a natural one', () => {
    expect(readProjectIconDimensions('icons/relative.svg', '<svg width="100%" height="1em"></svg>')).toBeNull()
  })

  it('returns null for markup that is not a vector and for a non-vector file', () => {
    expect(readProjectIconDimensions('icons/broken.svg', '<html><body></body></html>')).toBeNull()
    expect(readProjectIconDimensions('icons/photo.png', '<svg width="8" height="8"></svg>')).toBeNull()
  })
})
