import { describe, expect, it } from 'vitest'
import { aggregateNetworkResourceProgress } from './networkResourceProgress'

describe('aggregateNetworkResourceProgress', () => {
  it('weights known downloads by bytes and reports unknown-size bytes separately', () => {
    expect(aggregateNetworkResourceProgress([
      { receivedBytes: 25, totalBytes: 100 },
      { receivedBytes: 50, totalBytes: 100 },
      { receivedBytes: 30, totalBytes: null },
    ])).toEqual({ progress: 0.375, receivedBytes: 105, hasUnknownSize: true })
  })

  it('returns no task when no downloads are active', () => {
    expect(aggregateNetworkResourceProgress([])).toBeNull()
  })
})
