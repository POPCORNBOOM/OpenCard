import { describe, expect, it, vi } from 'vitest'
import { createBlock, type CardDocument } from '../../../entities/card/model'
import { exportProjectCustomBlock } from './exportProjectCustomBlock'
import { readProjectCustomBlockPackageFromBytes } from './projectCustomBlock'

function createDocument(): CardDocument {
  return {
    type: 'card-document', id: 'document', name: 'Document', version: '1', width: '100', height: '100',
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

function createFs(savePath: string | null) {
  const writeBinaryFile = vi.fn(async (_path: string, _bytes: Uint8Array) => undefined)
  return {
    writeBinaryFile,
    fs: {
      pickSavePath: vi.fn(async () => savePath),
      readBinaryFile: vi.fn(async () => new Uint8Array()),
      readDirectoryEntries: vi.fn(async () => []),
      fileExists: vi.fn(async () => false),
      writeBinaryFile,
    },
  }
}

describe('exportProjectCustomBlock', () => {
  it('owns save-path selection and writes a self-contained current-format archive', async () => {
    const { fs, writeBinaryFile } = createFs('D:/Cards/assets/portable.ocblock')
    const result = await exportProjectCustomBlock({
      document: createDocument(),
      rootBlockId: 'root',
      name: 'Portable',
      publisherKey: 'alice',
      blockKey: 'portable',
      exposedFieldKeys: [],
      resize: { widthLocked: false, heightLocked: false },
      projectRootPath: 'D:/Cards',
      fs,
    })

    expect(result).toMatchObject({
      status: 'exported',
      outputPath: 'D:/Cards/assets/portable.ocblock',
      manifest: { packageId: 'alice/portable', version: '0.1.0' },
    })
    const archive = writeBinaryFile.mock.calls[0]![1]
    await expect(readProjectCustomBlockPackageFromBytes(archive)).resolves.toMatchObject({
      manifest: { packageId: 'alice/portable', version: '0.1.0' },
      block: { content: 'Portable' },
      issues: [],
    })
  })

  it('does not write when the save-path picker is cancelled', async () => {
    const { fs, writeBinaryFile } = createFs(null)
    const result = await exportProjectCustomBlock({
      document: createDocument(),
      rootBlockId: 'root',
      name: 'Portable',
      publisherKey: 'alice',
      blockKey: 'portable',
      exposedFieldKeys: [],
      resize: { widthLocked: false, heightLocked: false },
      projectRootPath: 'D:/Cards',
      fs,
    })
    expect(result).toEqual({ status: 'cancelled' })
    expect(writeBinaryFile).not.toHaveBeenCalled()
  })
})
