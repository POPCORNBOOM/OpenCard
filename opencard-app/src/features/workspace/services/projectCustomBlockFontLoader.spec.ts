import { describe, expect, it, vi } from 'vitest'
import type { ProjectCustomBlockCatalog } from '../model/projectCustomBlocks'
import {
  createProjectCustomBlockFontSession,
  type ProjectCustomBlockFontRuntime,
} from './projectCustomBlockFontLoader'

function createCatalog(): ProjectCustomBlockCatalog {
  return new Map([['square', {
    archivePath: 'assets/square.ocblock',
    files: new Map([['resources/fonts/a.woff2', new Uint8Array([1, 2, 3])]]),
    manifest: {
      type: 'opencard-custom-block', schemaVersion: '1', key: 'square', name: 'Square', interfaceHash: 'hash',
      root: { type: 'text-block', id: 'root' } as never,
      publicFields: [], resize: { widthLocked: false, heightLocked: false },
      resources: { fonts: [{ key: 'body', name: 'Body', source: 'resources/fonts/a.woff2' }] },
    },
  }]])
}

function createRuntime() {
  const face = { load: vi.fn(async () => face) } as unknown as FontFace
  const runtime: ProjectCustomBlockFontRuntime = {
    createObjectUrl: vi.fn(() => 'blob:font'),
    revokeObjectUrl: vi.fn(),
    createFontFace: vi.fn(() => face),
    addFont: vi.fn(),
    deleteFont: vi.fn(),
  }
  return { runtime, face }
}

describe('project custom block font loader', () => {
  it('loads hidden FontFace resources and releases them on clear', async () => {
    const { runtime, face } = createRuntime()
    const session = await createProjectCustomBlockFontSession(createCatalog(), runtime)

    expect(runtime.createObjectUrl).toHaveBeenCalledWith(expect.objectContaining({ type: 'font/woff2' }))
    expect(runtime.createFontFace).toHaveBeenCalledWith('OpenCardCustomBlock-square-body', 'url("blob:font")')
    expect(face.load).toHaveBeenCalled()
    expect(runtime.addFont).toHaveBeenCalledWith(face)

    session.release()
    session.release()
    expect(runtime.deleteFont).toHaveBeenCalledWith(face)
    expect(runtime.revokeObjectUrl).toHaveBeenCalledWith('blob:font')
  })

  it('isolates generations and degrades when one font cannot be decoded', async () => {
    const firstRuntime = createRuntime()
    const first = await createProjectCustomBlockFontSession(createCatalog(), firstRuntime.runtime)
    const failedRuntime = createRuntime()
    vi.mocked(failedRuntime.face.load).mockRejectedValueOnce(new Error('invalid font'))
    const failed = await createProjectCustomBlockFontSession(createCatalog(), failedRuntime.runtime)

    expect(firstRuntime.runtime.revokeObjectUrl).not.toHaveBeenCalled()
    expect(failed.errors).toEqual([expect.objectContaining({
      packageKey: 'square', fontKey: 'body', reason: 'load-failed',
    })])
    expect(failedRuntime.runtime.revokeObjectUrl).toHaveBeenCalledWith('blob:font')
    first.release()
    expect(firstRuntime.runtime.revokeObjectUrl).toHaveBeenCalledWith('blob:font')
  })
})
