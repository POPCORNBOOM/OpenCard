import { describe, expect, it, vi } from 'vitest'
import type { ProjectCustomBlockCatalog } from '../model/projectCustomBlocks'
import { createBlock } from '../../../entities/card/model'
import {
  createProjectCustomBlockAssetSession,
  type ProjectCustomBlockAssetRuntime,
} from './projectCustomBlockAssetLoader'

function createCatalog(): ProjectCustomBlockCatalog {
  return new Map([['picture', {
    archivePath: 'assets/picture.ocblock',
    files: new Map([
      ['resources/images/A.PNG', new Uint8Array([1])],
      ['resources/icons/ATLAS.PNG', new Uint8Array([2])],
    ]),
    manifest: {
      type: 'opencard-custom-block', customBlockKey: 'picture', name: 'Picture',
      publicFieldKeys: [], resize: { widthLocked: false, heightLocked: false },
      resources: {
        images: [{ key: 'a', source: 'resources/images/a.png' }],
        iconSeries: [{
          name: 'Picture', key: 'icons', source: 'resources/icons/atlas.png',
          icons: [{ iconKey: 'icon-1', name: 'One', x: 0, y: 0, width: 8, height: 8 }],
        }],
      },
    },
    block: createBlock('image-block', { id: 'root', image: 'resource:image:a' }),
  }]])
}

function createRuntime(): ProjectCustomBlockAssetRuntime {
  let index = 0
  return {
    createObjectUrl: vi.fn(() => `blob:resource-${++index}`),
    revokeObjectUrl: vi.fn(),
  }
}

describe('project custom block asset loader', () => {
  it('creates controlled image/icon URLs and releases them', async () => {
    const runtime = createRuntime()
    const result = await createProjectCustomBlockAssetSession(
      createCatalog(), runtime, async () => ({ width: 8, height: 8 }),
    )
    const entry = result.customBlockCatalog.get('picture')!

    expect(entry.resourceUrls?.get('resources/images/a.png')).toBe('blob:resource-1')
    expect(result.iconCatalog.entries[0]).toMatchObject({ seriesKey: 'icons', src: 'blob:resource-2' })

    result.release()
    result.release()
    expect(runtime.revokeObjectUrl).toHaveBeenCalledTimes(2)
  })

  it('keeps independent generations isolated until their owner releases them', async () => {
    const runtime = createRuntime()
    const first = await createProjectCustomBlockAssetSession(
      createCatalog(), runtime, async () => ({ width: 8, height: 8 }),
    )
    const second = await createProjectCustomBlockAssetSession(
      createCatalog(), runtime, async () => ({ width: 8, height: 8 }),
    )

    expect(runtime.revokeObjectUrl).not.toHaveBeenCalled()
    second.release()
    expect(runtime.revokeObjectUrl).toHaveBeenCalledWith('blob:resource-3')
    expect(runtime.revokeObjectUrl).toHaveBeenCalledWith('blob:resource-4')
    first.release()
    expect(runtime.revokeObjectUrl).toHaveBeenCalledTimes(4)
  })
})
