import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectCustomBlockCatalog } from '../model/projectCustomBlocks'
import {
  clearProjectCustomBlockAssets,
  syncProjectCustomBlockAssets,
  type ProjectCustomBlockAssetRuntime,
} from './projectCustomBlockAssetLoader'

function createCatalog(): ProjectCustomBlockCatalog {
  return new Map([['picture', {
    archivePath: 'assets/picture.ocblock',
    files: new Map([
      ['resources/images/a.png', new Uint8Array([1])],
      ['resources/icons/atlas.png', new Uint8Array([2])],
    ]),
    manifest: {
      type: 'opencard-custom-block', schemaVersion: '1', key: 'picture', name: 'Picture', interfaceHash: 'hash',
      root: { type: 'image-block', id: 'root' } as never,
      publicFields: [], resize: { widthLocked: false, heightLocked: false },
      resources: {
        images: [{ key: 'a', source: 'resources/images/a.png' }],
        iconSeries: [{
          name: 'Picture', key: 'ocblock-picture', source: 'resources/icons/atlas.png',
          icons: [{ iconKey: 'icon-1', name: 'One', x: 0, y: 0, width: 8, height: 8 }],
        }],
      },
    },
  }]])
}

function createRuntime(): ProjectCustomBlockAssetRuntime {
  let index = 0
  return {
    createObjectUrl: vi.fn(() => `blob:resource-${++index}`),
    revokeObjectUrl: vi.fn(),
  }
}

afterEach(() => clearProjectCustomBlockAssets(null))

describe('project custom block asset loader', () => {
  it('creates controlled image/icon URLs and releases them', async () => {
    const runtime = createRuntime()
    const result = await syncProjectCustomBlockAssets(createCatalog(), runtime, async () => ({ width: 8, height: 8 }))
    const entry = result.customBlockCatalog.get('picture')!

    expect(entry.resourceUrls?.get('resources/images/a.png')).toBe('blob:resource-1')
    expect(result.iconCatalog.entries[0]).toMatchObject({ seriesKey: 'ocblock-picture', src: 'blob:resource-2' })

    clearProjectCustomBlockAssets(runtime)
    expect(runtime.revokeObjectUrl).toHaveBeenCalledTimes(2)
  })
})
