import { describe, expect, it, vi } from 'vitest'
import type { ProjectCustomBlockCatalog } from '../model/projectCustomBlocks'
import { createBlock } from '../../../entities/card/model'
import {
  createProjectCustomBlockFontSession,
  type ProjectCustomBlockFontRuntime,
} from './projectCustomBlockFontLoader'

vi.mock('./projectFontCoverage', async importOriginal => ({
  ...await importOriginal<typeof import('./projectFontCoverage')>(),
  readProjectFontCharacterSet: vi.fn(async () => new Set([0x41, 0x42, 0x4e00])),
}))

function createCatalog(): ProjectCustomBlockCatalog {
  return new Map([['square', {
    archivePath: 'assets/square.ocblock',
    files: new Map([['resources/fonts/a.woff2', new Uint8Array([1, 2, 3])]]),
    manifest: {
      type: 'opencard-custom-block', customBlockKey: 'square', name: 'Square',
      publicFieldKeys: [], resize: { widthLocked: false, heightLocked: false },
      resources: { fonts: [{
        kind: 'font', key: 'body', name: 'Body',
        files: { normal: { upright: 'resources/fonts/a.woff2' } },
      }] },
    },
    block: createBlock('text-block', { id: 'root', fontFamily: 'resource:font:body' }),
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
    expect(runtime.createFontFace).toHaveBeenCalledWith('OpenCardCustomBlock-square-body', 'url("blob:font")', {
      weight: '400', style: 'normal',
    })
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

  it('loads compositions per semantic slot and strict character fallback', async () => {
    const catalog = createCatalog()
    const entry = catalog.get('square')!
    entry.manifest.resources = { fonts: [
      ...entry.manifest.resources!.fonts!,
      {
        kind: 'composition', key: 'display', name: 'Display',
        members: [
          { fontKey: 'body', ranges: [{ start: 0x41, end: 0x41 }] },
          { fontKey: 'body' },
        ],
      },
    ] }
    const { runtime } = createRuntime()
    const session = await createProjectCustomBlockFontSession(catalog, runtime)

    expect(session.errors).toEqual([])
    expect(runtime.createFontFace).toHaveBeenCalledWith(
      'OpenCardCustomBlock-square-display',
      'url("blob:font")',
      expect.objectContaining({ unicodeRange: 'U+41' }),
    )
    expect(runtime.createFontFace).toHaveBeenCalledWith(
      'OpenCardCustomBlock-square-display',
      'url("blob:font")',
      expect.objectContaining({ unicodeRange: 'U+42, U+4E00' }),
    )
  })
})
