import { describe, expect, it, vi } from 'vitest'
import {
  createProjectFontPreviewRuns,
  readProjectFontCharacterSet,
} from './projectFontCoverage'

vi.mock('fontkit', () => ({
  create: () => ({ characterSet: [65, 66, 67] }),
}))

describe('projectFontCoverage', () => {
  it('reads supported Unicode code points from the font', async () => {
    await expect(readProjectFontCharacterSet(new Uint8Array([0]))).resolves.toEqual(new Set([65, 66, 67]))
  })

  it('groups adjacent text by the first registered font that supports every grapheme code point', () => {
    const runs = createProjectFontPreviewRuns('AB中文 C', ['latin', 'cjk'], new Map([
      ['latin', new Set([32, 65, 66, 67])],
      ['cjk', new Set([0x4e2d, 0x6587])],
    ]))

    expect(runs).toEqual([
      { text: 'AB', fontKey: 'latin' },
      { text: '中文', fontKey: 'cjk' },
      { text: ' C', fontKey: 'latin' },
    ])
  })

  it('marks characters outside every registered font as fallback text', () => {
    expect(createProjectFontPreviewRuns('A🙂', ['latin'], new Map([
      ['latin', new Set([65])],
    ]))).toEqual([
      { text: 'A', fontKey: 'latin' },
      { text: '🙂', fontKey: null },
    ])
  })
})
