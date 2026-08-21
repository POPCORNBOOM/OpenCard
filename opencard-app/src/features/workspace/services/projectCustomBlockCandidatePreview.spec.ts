import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBlock } from '../../../entities/card/model'
import type { ProjectResourceEnvironment } from './projectResourceEnvironment'
import type { ProjectCustomBlockCandidate } from './exportProjectCustomBlock'

const mocks = vi.hoisted(() => ({
  createArchive: vi.fn(() => new Uint8Array([1, 2, 3])),
  install: vi.fn(),
  loadRuntime: vi.fn(),
  createFontSession: vi.fn(),
  loadEnvironment: vi.fn(),
  prepareRender: vi.fn(),
}))

vi.mock('./projectCustomBlock', () => ({
  createProjectCustomBlockArchive: mocks.createArchive,
  installProjectCustomBlockPackageFromBytes: mocks.install,
}))
vi.mock('./projectCustomBlockAssetLoader', () => ({
  loadInstalledProjectCustomBlockRuntime: mocks.loadRuntime,
}))
vi.mock('./projectCustomBlockFontLoader', () => ({
  createProjectCustomBlockFontSession: mocks.createFontSession,
}))
vi.mock('./projectResourceEnvironment', () => ({
  loadProjectResourceEnvironment: mocks.loadEnvironment,
}))
vi.mock('../../card-rendering/renderPipeline', () => ({
  prepareCardRender: mocks.prepareRender,
}))

import { createProjectCustomBlockCandidatePreview } from './projectCustomBlockCandidatePreview'

const packageEnvironment = {
  kind: 'package', namespace: 'package-alice-preview', rootPath: '/tmp/resources',
  fontDocument: {}, fonts: {}, iconDocument: {}, iconCatalog: { series: new Map(), errors: [] }, issues: [],
} as unknown as ProjectResourceEnvironment
const hostEnvironment = {
  ...packageEnvironment,
  kind: 'project', namespace: 'project-preview', rootPath: '/tmp',
} as ProjectResourceEnvironment

function candidate(): ProjectCustomBlockCandidate {
  const block = createBlock('text-block', { id: 'root', content: 'Package default' })
  block.additionalFieldDefinition = { content: { fieldType: 'string' } }
  return {
    manifest: {
      type: 'opencard-custom-block', packageId: 'alice/preview', version: '0.1.0', name: 'Preview',
      publicFieldKeys: ['name', 'notes', 'content'], resize: { widthLocked: false, heightLocked: false },
    },
    block,
    resourceAnalysis: { candidates: [], defaultSelectedIds: new Set(), issues: [] },
    resources: { files: new Map(), issues: [], selectedCandidates: [] },
  }
}

describe('createProjectCustomBlockCandidatePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.install.mockResolvedValue({
      installationPath: '.opencard/blocks/alice/preview', replaced: false,
      manifest: candidate().manifest, issues: [],
    })
    mocks.loadRuntime.mockResolvedValue({
      entry: { manifest: candidate().manifest },
      runtimeEntry: { manifest: candidate().manifest, block: candidate().block, environment: packageEnvironment, dependencies: new Map() },
      environments: [packageEnvironment], issues: [],
    })
    mocks.createFontSession.mockResolvedValue({ errors: [], release: vi.fn() })
    mocks.loadEnvironment.mockResolvedValue(hostEnvironment)
    mocks.prepareRender.mockReturnValue({
      document: { faces: { front: { id: 'front' }, back: { id: 'back' } } },
      resources: {}, issues: [],
    })
  })

  it('installs the exact candidate in an isolated blank host and uses the formal render pipeline', async () => {
    const deleted: string[] = []
    const fs = {
      createDirectory: vi.fn(), writeFile: vi.fn(), writeBinaryFile: vi.fn(), readFile: vi.fn(), readBinaryFile: vi.fn(),
      readDirectoryEntries: vi.fn(), renameFile: vi.fn(),
      fileExists: vi.fn(async () => true),
      deleteFile: vi.fn(async (path: string) => { deleted.push(path) }),
    }
    const source = candidate()
    const preview = await createProjectCustomBlockCandidatePreview({
      candidate: source,
      overrides: { content: 'Host override' },
      sourceProjectRootPath: '/project',
      fs,
      createId: () => 'stable',
    })

    expect(mocks.createArchive).toHaveBeenCalledWith(source.manifest, source.block, source.resources.files)
    expect(mocks.install).toHaveBeenCalledWith(expect.objectContaining({
      projectRootPath: '/project/.opencard/.custom-block-preview/stable',
      bytes: new Uint8Array([1, 2, 3]),
    }))
    expect(mocks.loadRuntime).toHaveBeenCalledWith(expect.objectContaining({
      installationPath: '/project/.opencard/.custom-block-preview/stable/.opencard/blocks/alice/preview',
    }))
    const renderRequest = mocks.prepareRender.mock.calls[0]![0]
    expect(renderRequest.environment).toMatchObject({ project: null, dictionary: null })
    expect(renderRequest.document.faces.front.children[0].block).toMatchObject({
      type: 'custom-block', packageId: 'alice/preview', content: 'Host override',
    })
    expect(renderRequest.document.faces.front.children[0].block).not.toHaveProperty('width')

    await preview.release()
    await preview.release()
    expect(deleted).toEqual(['/project/.opencard/.custom-block-preview/stable'])
  })

  it('cleans the isolated host when formal package loading fails', async () => {
    mocks.loadRuntime.mockRejectedValueOnce(new Error('broken package'))
    const deleteFile = vi.fn(async () => undefined)
    const fs = {
      createDirectory: vi.fn(), writeFile: vi.fn(), writeBinaryFile: vi.fn(), readFile: vi.fn(), readBinaryFile: vi.fn(),
      readDirectoryEntries: vi.fn(), renameFile: vi.fn(), fileExists: vi.fn(async () => true), deleteFile,
    }
    await expect(createProjectCustomBlockCandidatePreview({
      candidate: candidate(), overrides: {}, sourceProjectRootPath: '/project', fs, createId: () => 'failure',
    })).rejects.toThrow('broken package')
    expect(deleteFile).toHaveBeenCalledWith('/project/.opencard/.custom-block-preview/failure')
  })
})
