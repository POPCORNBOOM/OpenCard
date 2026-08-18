import { describe, expect, it, vi } from 'vitest'
import type { UserCustomBlockCatalogEntry } from '../model/userCustomBlockCatalog'
import type { UserCustomBlockCatalogService } from '../services/userCustomBlockCatalogService'
import { createUserCustomBlockCatalogStore } from './userCustomBlockCatalogStore'

const badge: UserCustomBlockCatalogEntry = {
  key: 'user:badge',
  id: 'badge',
  customBlockKey: 'badge',
  name: 'Badge',
  path: '/app/custom-blocks/badge.ocblock',
}

function createService() {
  return {
    loadCatalog: vi.fn(async () => ({ blocks: [badge], warnings: [] })),
    pickUserCustomBlock: vi.fn(async () => '/incoming/badge.ocblock'),
    importUserCustomBlock: vi.fn(async () => badge.path),
  } as unknown as UserCustomBlockCatalogService
}

describe('UserCustomBlockCatalogStore', () => {
  it('shares concurrent catalog loads and finds entries by catalog Key', async () => {
    const service = createService()
    const store = createUserCustomBlockCatalogStore(service)

    await Promise.all([store.load(), store.load()])

    expect(service.loadCatalog).toHaveBeenCalledOnce()
    expect(store.findBlock('user:badge')).toEqual(badge)
  })

  it('refreshes after import and clears a previous load error on retry', async () => {
    const service = createService()
    vi.mocked(service.loadCatalog)
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValue({ blocks: [badge], warnings: [] })
    const store = createUserCustomBlockCatalogStore(service)

    await expect(store.load()).rejects.toThrow('unavailable')
    expect(store.error.value).toBeInstanceOf(Error)

    await expect(store.importUserCustomBlock('/incoming/badge.ocblock')).resolves.toEqual(badge)
    expect(store.error.value).toBeNull()
    expect(store.blocks.value).toEqual([badge])
  })
})
