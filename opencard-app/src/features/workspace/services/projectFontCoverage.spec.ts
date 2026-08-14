import { describe, expect, it, vi } from 'vitest'
import {
  characterSetToUnicodeRanges,
  createProjectFontPreviewRuns,
  mergeUnicodeRanges,
  readProjectFontCharacterSet,
  subtractUnicodeRanges,
} from './projectFontCoverage'

vi.mock('fontkit', () => ({
  create: () => ({ characterSet: [65, 66, 67] }),
}))

describe('projectFontCoverage', () => {
  it('reads supported Unicode code points from the font', async () => {
    await expect(readProjectFontCharacterSet(new Uint8Array([0]))).resolves.toEqual(new Set([65, 66, 67]))
  })

  it('groups adjacent text by the first registered font that supports every grapheme code point', () => {
    const runs = createProjectFontPreviewRuns('AB中文 C', [
      { familyKey: 'latin', ranges: [{ start: 0, end: 0x7f }] },
      { familyKey: 'cjk' },
    ], new Map([
      ['latin', new Set([32, 65, 66, 67])],
      ['cjk', new Set([0x4e2d, 0x6587])],
    ]))

    expect(runs).toEqual([
      { text: 'AB', familyKey: 'latin' },
      { text: '中文', familyKey: 'cjk' },
      { text: ' C', familyKey: 'latin' },
    ])
  })

  it('marks characters outside every registered font as fallback text', () => {
    expect(createProjectFontPreviewRuns('A🙂', [{ familyKey: 'latin' }], new Map([
      ['latin', new Set([65])],
    ]))).toEqual([
      { text: 'A', familyKey: 'latin' },
      { text: '🙂', familyKey: null },
    ])
  })

  it('builds, merges, and subtracts compact Unicode ranges', () => {
    expect(characterSetToUnicodeRanges(new Set([65, 66, 68, 0xd800]), [{ start: 66, end: 68 }]))
      .toEqual([{ start: 66, end: 66 }, { start: 68, end: 68 }])
    expect(mergeUnicodeRanges([{ start: 10, end: 12 }, { start: 1, end: 4 }, { start: 4, end: 9 }]))
      .toEqual([{ start: 1, end: 12 }])
    expect(subtractUnicodeRanges([{ start: 1, end: 10 }], [{ start: 3, end: 5 }, { start: 8, end: 12 }]))
      .toEqual([{ start: 1, end: 2 }, { start: 6, end: 7 }])
  })
})
