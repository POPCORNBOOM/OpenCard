import { describe, expect, it, vi } from 'vitest'
import type { CachedNetworkResource, NetworkResourceCacheProject } from '../services/networkResourceCacheService'
import { NetworkResourceManager } from './networkResourceManager'

const PROJECT = 'D:/Projects/OpenCard'
const URL = 'https://example.com/image.png'

function resource(path: string, refreshedAt = '2026-08-29T12:00:00.000Z'): CachedNetworkResource {
  return { url: URL, path, refreshedAt }
}

function createManager(cache: NetworkResourceCacheProject) {
  return new NetworkResourceManager({
    cacheService: { forProject: vi.fn(async () => cache) },
  })
}

describe('NetworkResourceManager', () => {
  it('deduplicates missing-resource acquisition and publishes the completed cache entry', async () => {
    const refresh = vi.fn(async () => resource('/cache/image.png'))
    const cache: NetworkResourceCacheProject = {
      getCached: vi.fn(async () => null),
      refresh,
      listUrls: vi.fn(async () => [URL]),
    }
    const scope = createManager(cache).forProject(PROJECT, () => true)

    expect(scope.get(URL)).toBeNull()
    expect(scope.get(URL)).toBeNull()
    await scope.waitForIdle()

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(scope.get(URL)?.path).toBe('/cache/image.png')
  })

  it('loads an existing cache entry once and leaves refresh policy to the caller', async () => {
    const old = resource('/cache/image.png', '2026-08-27T12:00:00.000Z')
    const refresh = vi.fn(async () => resource('/cache/image.png', '2026-08-29T12:00:00.000Z'))
    const cache: NetworkResourceCacheProject = {
      getCached: vi.fn(async () => old),
      refresh,
      listUrls: vi.fn(async () => [URL]),
    }
    const scope = createManager(cache).forProject(PROJECT, () => true)
    expect(scope.get(URL)).toBeNull()
    await vi.waitFor(() => expect(scope.get(URL)?.refreshedAt).toBe(old.refreshedAt))

    expect(refresh).not.toHaveBeenCalled()
    await expect(scope.refresh(URL)).resolves.toMatchObject({ refreshedAt: '2026-08-29T12:00:00.000Z' })
    await scope.waitForIdle()
    expect(scope.get(URL)?.refreshedAt).toBe('2026-08-29T12:00:00.000Z')
  })

  it('keeps an old cache entry when an explicit refresh fails', async () => {
    const old = resource('/cache/image.png', '2026-08-27T12:00:00.000Z')
    const refresh = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(resource('/cache/image.png'))
    const cache: NetworkResourceCacheProject = {
      getCached: vi.fn(async () => old),
      refresh,
      listUrls: vi.fn(async () => [URL]),
    }
    const scope = createManager(cache).forProject(PROJECT, () => true)
    await vi.waitFor(() => expect(scope.get(URL)?.path).toBe(old.path))
    await expect(scope.refresh(URL)).rejects.toThrow('offline')
    expect(scope.get(URL)?.path).toBe(old.path)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refreshes all cached URLs allowed by the project facade without failing fast', async () => {
    const secondUrl = 'https://blocked.example.com/image.png'
    const cache: NetworkResourceCacheProject = {
      getCached: vi.fn(async () => null),
      refresh: vi.fn(async url => resource(`/cache/${encodeURIComponent(url)}.png`)),
      listUrls: vi.fn(async () => [URL, secondUrl]),
    }
    const scope = createManager(cache).forProject(PROJECT, url => !url.includes('blocked'))
    await expect(scope.refreshAll()).resolves.toEqual({ total: 1, succeeded: 1, failures: [] })
    expect(cache.refresh).toHaveBeenCalledWith(URL, expect.any(Function))
  })
})
