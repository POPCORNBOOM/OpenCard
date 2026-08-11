import { describe, expect, it, vi } from 'vitest'
import { createBlock, type CardDocument } from '../../../entities/card/model'
import {
  exportProjectCustomBlock,
  fetchProjectCustomBlockImageBytes,
} from './exportProjectCustomBlock'
import { readProjectCustomBlockPackageFromBytes } from './projectCustomBlock'

function createDocument(): CardDocument {
  return {
    type: 'card-document', id: 'document', version: '1', width: '100', height: '100',
    instances: [],
    faces: {
      front: {
        type: 'card-face', id: 'front', background: '#fff',
        children: [{
          block: createBlock('text-block', { id: 'root', content: 'Portable' }),
          location: { id: 'root-location', type: 'simple-container-location', anchor: 'lt' },
        }],
      },
      back: { type: 'card-face', id: 'back', background: '#fff', children: [] },
    },
  }
}

describe('exportProjectCustomBlock', () => {
  it('owns save-path selection, writes a self-validated archive, and returns the final path', async () => {
    const writeBinaryFile = vi.fn(async (_path: string, _bytes: Uint8Array) => undefined)
    const result = await exportProjectCustomBlock({
      document: createDocument(), rootBlockId: 'root', name: 'Portable', key: 'portable',
      exposedFieldKeys: [], resize: { widthLocked: false, heightLocked: false }, projectRootPath: 'D:/Cards',
      fs: {
        pickSavePath: vi.fn(async () => 'D:/Cards/assets/portable.ocblock'),
        readBinaryFile: vi.fn(),
        writeBinaryFile,
      },
    })

    expect(result).toMatchObject({ status: 'exported', outputPath: 'D:/Cards/assets/portable.ocblock' })
    const archive = writeBinaryFile.mock.calls[0]![1]
    await expect(readProjectCustomBlockPackageFromBytes(archive)).resolves.toMatchObject({
      manifest: { customBlockKey: 'portable' },
      block: { content: 'Portable' },
    })
  })

  it('does not write when the save-path picker is cancelled', async () => {
    const writeBinaryFile = vi.fn(async (_path: string, _bytes: Uint8Array) => undefined)
    const result = await exportProjectCustomBlock({
      document: createDocument(), rootBlockId: 'root', name: 'Portable', key: 'portable',
      exposedFieldKeys: [], resize: { widthLocked: false, heightLocked: false }, projectRootPath: 'D:/Cards',
      fs: {
        pickSavePath: vi.fn(async () => null),
        readBinaryFile: vi.fn(),
        writeBinaryFile,
      },
    })
    expect(result).toEqual({ status: 'cancelled' })
    expect(writeBinaryFile).not.toHaveBeenCalled()
  })
})

describe('fetchProjectCustomBlockImageBytes', () => {
  it('accepts bounded image responses and rejects non-image responses', async () => {
    const imageFetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'image/png', 'content-length': '3' },
    })) as unknown as typeof fetch
    await expect(fetchProjectCustomBlockImageBytes('https://example.com/icon.png', imageFetch))
      .resolves.toEqual(new Uint8Array([1, 2, 3]))

    const textFetch = vi.fn(async () => new Response('not an image', {
      headers: { 'content-type': 'text/plain' },
    })) as unknown as typeof fetch
    await expect(fetchProjectCustomBlockImageBytes('https://example.com/icon.png', textFetch))
      .rejects.toThrow('not an image')
  })

  it('cancels a streaming response as soon as it crosses the size limit', async () => {
    const cancel = vi.fn(async () => undefined)
    const read = vi.fn()
      .mockResolvedValueOnce({ done: false, value: { byteLength: 20 * 1024 * 1024 } })
      .mockResolvedValueOnce({ done: false, value: { byteLength: 13 * 1024 * 1024 } })
    const oversizedFetch = vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      body: { getReader: () => ({ read, cancel }) },
    })) as unknown as typeof fetch

    await expect(fetchProjectCustomBlockImageBytes('https://example.com/large.png', oversizedFetch))
      .rejects.toThrow('size limit')
    expect(cancel).toHaveBeenCalledOnce()
  })
})
