import { describe, expect, it, vi } from 'vitest'
import { createTextBlock } from '../../../entities/card/model'
import type { ProjectCustomBlockCatalogEntry } from '../model/projectCustomBlocks'
import { ProjectCustomBlockResourceCache } from './projectCustomBlockCache'

function entry(key: string): ProjectCustomBlockCatalogEntry {
  return {
    manifest: {
      type: 'opencard-custom-block',

      customBlockKey: key,
      name: key,
      publicFieldKeys: [],
      resize: { widthLocked: false, heightLocked: false },
    },
    block: createTextBlock({ id: `${key}-root` }),
    archivePath: `${key}.ocblock`,
    files: new Map(),
  }
}

describe('ProjectCustomBlockResourceCache', () => {
  it('shares concurrent loads and releases the value on invalidation', async () => {
    const release = vi.fn()
    const loader = vi.fn(async () => ({ entry: entry('badge'), byteSize: 8, release }))
    const cache = new ProjectCustomBlockResourceCache(32)

    const [first, second] = await Promise.all([cache.load('BADGE', loader), cache.load('badge', loader)])
    expect(first).toBe(second)
    expect(loader).toHaveBeenCalledOnce()
    expect(cache.state('badge')).toBe('ready')
    cache.invalidate('badge')
    expect(release).toHaveBeenCalledOnce()
    expect(cache.state('badge')).toBe('unloaded')
  })

  it('evicts least-recently-used unpinned packages and permits active overflow', async () => {
    const releases = new Map<string, ReturnType<typeof vi.fn>>()
    const cache = new ProjectCustomBlockResourceCache(10)
    const load = (key: string, byteSize: number) => cache.load(key, async () => {
      const release = vi.fn()
      releases.set(key, release)
      return { entry: entry(key), byteSize, release }
    })

    await load('first', 6)
    cache.setPinnedKeys(['first'])
    await load('second', 6)
    expect(cache.state('first')).toBe('ready')
    expect(cache.state('second')).toBe('unloaded')
    expect(releases.get('second')).toHaveBeenCalledOnce()

    cache.setPinnedKeys([])
    await load('third', 8)
    expect(cache.state('first')).toBe('unloaded')
    expect(cache.state('third')).toBe('ready')
  })

  it('keeps a failed state without retaining resource bytes and allows retry', async () => {
    const cache = new ProjectCustomBlockResourceCache(10)
    await expect(cache.load('broken', async () => { throw new Error('broken') })).rejects.toThrow('broken')
    expect(cache.state('broken')).toBe('error')
    expect(cache.sizeBytes).toBe(0)
    await expect(cache.load('broken', async () => ({ entry: entry('broken'), byteSize: 1, release: vi.fn() })))
      .resolves.toMatchObject({ manifest: { customBlockKey: 'broken' } })
  })
})
