import { describe, expect, it } from 'vitest'
import { isBinaryFontDiffPath } from './useOcdocumentDiffSession'

describe('isBinaryFontDiffPath', () => {
  it.each(['woff', 'woff2', 'ttf', 'otf', 'ttc', 'otc'])('accepts .%s font snapshots', extension => {
    expect(isBinaryFontDiffPath(`.opencard/fonts/Brand.${extension}`)).toBe(true)
  })

  it('keeps unrelated binary files on the unsupported path', () => {
    expect(isBinaryFontDiffPath('assets/cover.png')).toBe(false)
    expect(isBinaryFontDiffPath('packages/block.ocblock')).toBe(false)
  })
})
