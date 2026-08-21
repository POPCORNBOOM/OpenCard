import { describe, expect, it, vi } from 'vitest'
import { buildProjectFontRegistry, type ProjectFontRegistryDocument } from '../model/projectFontRegistry'
import { EMPTY_PROJECT_ICON_CATALOG } from './projectIconCatalog'
import {
  createProjectCustomBlockFontSession,
  type ProjectCustomBlockFontRuntime,
} from './projectCustomBlockFontLoader'
import { createProjectResourceNamespace, type ProjectResourceEnvironment } from './projectResourceEnvironment'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}))

vi.mock('./projectFontCoverage', async importOriginal => ({
  ...await importOriginal<typeof import('./projectFontCoverage')>(),
  readProjectFontCharacterSet: vi.fn(async () => new Set([0x41, 0x42, 0x4e00])),
}))

function createEnvironment(withComposition = false): ProjectResourceEnvironment {
  const fontDocument: ProjectFontRegistryDocument = {
    families: [{
      key: 'body',
      name: 'Body',
      files: { normal: { upright: 'fonts/a.woff2' } },
    }],
    ...(withComposition ? {
      compositions: [{
        key: 'display',
        name: 'Display',
        members: [
          { fontKey: 'body', ranges: [{ start: 0x41, end: 0x41 }] },
          { fontKey: 'body' },
        ],
      }],
    } : {}),
  }
  return {
    kind: 'package',
    namespace: createProjectResourceNamespace('package', 'alice/square'),
    rootPath: '/project/.opencard/blocks/alice/square/resources',
    fontDocument,
    fonts: buildProjectFontRegistry(fontDocument),
    iconDocument: {},
    iconCatalog: EMPTY_PROJECT_ICON_CATALOG,
    issues: [],
  }
}

function createRuntime() {
  const face = { load: vi.fn(async () => face) } as unknown as FontFace
  const runtime: ProjectCustomBlockFontRuntime = {
    createFontFace: vi.fn(() => face),
    addFont: vi.fn(),
    deleteFont: vi.fn(),
  }
  return { runtime, face }
}

describe('project custom block font loader', () => {
  it('loads installed package fonts from the resource environment and releases them', async () => {
    const { runtime, face } = createRuntime()
    const session = await createProjectCustomBlockFontSession([createEnvironment()], runtime)

    expect(runtime.createFontFace).toHaveBeenCalledWith(
      'OpenCardResource-package-alice-square-body',
      'url("asset:///project/.opencard/blocks/alice/square/resources/.opencard/fonts/a.woff2")',
      { weight: '400', style: 'normal' },
    )
    expect(face.load).toHaveBeenCalled()
    expect(runtime.addFont).toHaveBeenCalledWith(face)

    session.release()
    session.release()
    expect(runtime.deleteFont).toHaveBeenCalledTimes(1)
    expect(runtime.deleteFont).toHaveBeenCalledWith(face)
  })

  it('isolates sessions and reports a package-scoped load failure', async () => {
    const firstRuntime = createRuntime()
    const first = await createProjectCustomBlockFontSession([createEnvironment()], firstRuntime.runtime)
    const failedRuntime = createRuntime()
    vi.mocked(failedRuntime.face.load).mockRejectedValueOnce(new Error('invalid font'))
    const failed = await createProjectCustomBlockFontSession([createEnvironment()], failedRuntime.runtime)

    expect(firstRuntime.runtime.deleteFont).not.toHaveBeenCalled()
    expect(failed.errors).toEqual([expect.objectContaining({
      packageId: 'alice-square',
      fontKey: 'body',
      source: 'fonts/a.woff2',
      reason: 'load-failed',
    })])
    expect(failedRuntime.runtime.deleteFont).toHaveBeenCalledWith(failedRuntime.face)
    first.release()
    expect(firstRuntime.runtime.deleteFont).toHaveBeenCalledWith(firstRuntime.face)
  })

  it('loads compositions per semantic slot and strict character fallback', async () => {
    const { runtime } = createRuntime()
    const session = await createProjectCustomBlockFontSession(
      [createEnvironment(true)],
      runtime,
      async () => new Uint8Array([1, 2, 3]),
    )

    expect(session.errors).toEqual([])
    expect(runtime.createFontFace).toHaveBeenCalledWith(
      'OpenCardResource-package-alice-square-display',
      expect.stringContaining('/project/.opencard/blocks/alice/square/resources/.opencard/fonts/a.woff2'),
      expect.objectContaining({ unicodeRange: 'U+41' }),
    )
    expect(runtime.createFontFace).toHaveBeenCalledWith(
      'OpenCardResource-package-alice-square-display',
      expect.stringContaining('/project/.opencard/blocks/alice/square/resources/.opencard/fonts/a.woff2'),
      expect.objectContaining({ unicodeRange: 'U+42, U+4E00' }),
    )
  })
})
