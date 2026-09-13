import { describe, expect, it } from 'vitest'
import { isResourceSnapshotDiffPath } from './useOcdocumentDiffSession'

describe('isResourceSnapshotDiffPath', () => {
  it.each(['woff', 'woff2', 'ttf', 'otf', 'ttc', 'otc'])('accepts .%s font snapshots', extension => {
    expect(isResourceSnapshotDiffPath(`.opencard/fonts/Brand.${extension}`)).toBe(true)
  })

  it.each(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])('accepts .%s image snapshots', extension => {
    expect(isResourceSnapshotDiffPath(`assets/cover.${extension}`)).toBe(true)
  })

  it('keeps unsupported binary packages on the unsupported path', () => {
    expect(isResourceSnapshotDiffPath('packages/theme.ociconpack')).toBe(false)
  })
})
