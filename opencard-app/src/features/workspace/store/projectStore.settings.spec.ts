import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  schedule: vi.fn(),
  openProject: vi.fn(),
  fileExists: vi.fn(),
  readDirectoryEntries: vi.fn(),
  writeFile: vi.fn(),
  readBinaryFile: vi.fn(),
  writeBinaryFile: vi.fn(),
  createDirectory: vi.fn(),
  copyFile: vi.fn(),
  renameFile: vi.fn(),
  readFile: vi.fn(),
  trashFile: vi.fn(),
  revealInFileManager: vi.fn(),
  startWatching: vi.fn(),
  stopWatching: vi.fn(),
  discoverInstalledProjectCustomBlocks: vi.fn(),
  installProjectCustomBlockPackage: vi.fn(),
  uninstallProjectCustomBlockPackage: vi.fn(),
  loadInstalledProjectCustomBlockRuntime: vi.fn(),
  createProjectCustomBlockFontSession: vi.fn(),
  fontSessionRelease: vi.fn(),
  eventListener: null as null | ((event: { payload: { kind: string, paths: string[] } }) => void),
  initializeProjectStructure: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: vi.fn(), isTauri: () => false }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (_event: string, listener: typeof mocks.eventListener) => {
    mocks.eventListener = listener
    return vi.fn()
  }),
}))
vi.mock('../../../utils/taskScheduler', () => ({
  taskScheduler: {
    cancel: mocks.cancel,
    schedule: mocks.schedule,
  },
}))
vi.mock('../services/fileSystemService', () => ({
  fileSystemService: {
    openProject: mocks.openProject,
    fileExists: mocks.fileExists,
    readDirectoryEntries: mocks.readDirectoryEntries,
    writeFile: mocks.writeFile,
    readBinaryFile: mocks.readBinaryFile,
    writeBinaryFile: mocks.writeBinaryFile,
    createDirectory: mocks.createDirectory,
    copyFile: mocks.copyFile,
    renameFile: mocks.renameFile,
    readFile: mocks.readFile,
    trashFile: mocks.trashFile,
    revealInFileManager: mocks.revealInFileManager,
    startWatching: mocks.startWatching,
    stopWatching: mocks.stopWatching,
  },
}))
vi.mock('../services/projectStructureService', () => ({
  initializeProjectStructure: mocks.initializeProjectStructure,
}))
vi.mock('../services/projectIconCatalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/projectIconCatalog')>()
  return {
    ...actual,
    buildProjectIconCatalog: vi.fn(async () => ({ series: [], entries: [], errors: [] })),
  }
})
vi.mock('../services/projectCustomBlock', () => ({
  discoverInstalledProjectCustomBlocks: mocks.discoverInstalledProjectCustomBlocks,
  installProjectCustomBlockPackage: mocks.installProjectCustomBlockPackage,
  uninstallProjectCustomBlockPackage: mocks.uninstallProjectCustomBlockPackage,
}))
vi.mock('../services/projectCustomBlockAssetLoader', () => ({
  loadInstalledProjectCustomBlockRuntime: mocks.loadInstalledProjectCustomBlockRuntime,
}))
vi.mock('../services/projectCustomBlockFontLoader', () => ({
  createProjectCustomBlockFontSession: mocks.createProjectCustomBlockFontSession,
}))

import { useProjectStore } from './projectStore'
import { useAppSettingsStore } from '../../settings/store/appSettingsStore'

describe('projectStore settings actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.eventListener = null
    mocks.openProject.mockResolvedValue(null)
    mocks.fileExists.mockResolvedValue(false)
    mocks.readDirectoryEntries.mockResolvedValue([])
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([1, 2, 3]))
    mocks.writeBinaryFile.mockResolvedValue(undefined)
    mocks.createDirectory.mockResolvedValue(undefined)
    mocks.copyFile.mockResolvedValue(undefined)
    mocks.renameFile.mockResolvedValue(undefined)
    mocks.readFile.mockResolvedValue('{}')
    mocks.trashFile.mockResolvedValue(undefined)
    mocks.startWatching.mockResolvedValue(undefined)
    mocks.stopWatching.mockResolvedValue(undefined)
    mocks.discoverInstalledProjectCustomBlocks.mockResolvedValue(new Map())
    mocks.installProjectCustomBlockPackage.mockResolvedValue({
      manifest: packageResultForTest().manifest, installationPath: '.opencard/blocks/alice/square',
      resourceRootPath: '.opencard/blocks/alice/square/resources', replaced: false, issues: [],
    })
    mocks.uninstallProjectCustomBlockPackage.mockResolvedValue(true)
    mocks.loadInstalledProjectCustomBlockRuntime.mockResolvedValue(runtimeResultForTest())
    mocks.createProjectCustomBlockFontSession.mockResolvedValue({ errors: [], release: mocks.fontSessionRelease })
    mocks.initializeProjectStructure.mockResolvedValue(undefined)
    useAppSettingsStore().updateProjectCreation({ workspaceStates: {} })
  })

  it('resets workspace state through the store and rewrites project metadata', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    store.setDirectoryExpanded('D:/project/src', true)

    await store.resetProjectWorkspaceState()

    expect(mocks.cancel).toHaveBeenCalledWith('project-metadata')
    expect(store.expandedDirectories.value.size).toBe(0)
    expect(store.registeredDirectories.value).toEqual(new Map([['', 2]]))
    expect(mocks.writeFile).not.toHaveBeenCalled()

    await store.setProjectPath('')
  })

  it('opens an ordinary folder without creating project internals', async () => {
    const store = useProjectStore()

    await store.setProjectPath('D:/ordinary-folder')

    expect(store.projectPath.value).toBe('D:/ordinary-folder')
    expect(mocks.initializeProjectStructure).not.toHaveBeenCalled()
    await store.setProjectPath('')
  })

  it('creates and indexes managed project resources only when requested', async () => {
    mocks.readDirectoryEntries.mockImplementation(async (_path: string, _depth: number, relativePath: string) => {
      if (relativePath === '.opencard/fonts') {
        return [{ name: '.opencard/fonts/Brand.otf', isDirectory: false, isFile: true, isSymlink: false }]
      }
      return []
    })
    const store = useProjectStore()
    await store.setProjectPath('D:/ordinary-folder')

    await store.ensureProjectManagementStructure()

    expect(mocks.initializeProjectStructure).toHaveBeenCalledOnce()
    expect(store.registeredDirectories.value).toMatchObject(new Map([
      ['', 2],
      ['.opencard/fonts', 1],
      ['.opencard/icons', 1],
      ['.opencard/blocks', 1],
    ]))
    expect(store.indexedEntries.value.map(entry => entry.name)).toContain('.opencard/fonts/Brand.otf')
    await store.setProjectPath('')
  })

  it('recovers when a persisted expanded directory was deleted between sessions', async () => {
    useAppSettingsStore().updateProjectCreation({
      workspaceStates: {
        'D:/project': { expandedDirectories: ['deleted-fonts'] },
      },
    })
    mocks.readDirectoryEntries.mockImplementation(async (path: string) => {
      if (path.endsWith('/deleted-fonts')) throw new Error('The system cannot find the path specified')
      return [{ name: 'main.ocdocument', isDirectory: false, isFile: true, isSymlink: false }]
    })
    mocks.fileExists.mockImplementation(async (path: string) => !path.endsWith('/deleted-fonts'))

    const store = useProjectStore()
    await store.setProjectPath('D:/project')

    expect(store.indexedEntries.value.map(entry => entry.name)).toContain('main.ocdocument')
    expect(store.expandedDirectories.value.has('deleted-fonts')).toBe(false)
    expect(store.registeredDirectories.value.has('deleted-fonts')).toBe(false)

    await store.setProjectPath('')
  })

  it('merges edited project information with the current workspace state', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    store.setDirectoryExpanded('D:/project/assets', true)

    const saved = await store.saveProjectConfiguration('.opencard/.ocproject', JSON.stringify({
      name: 'Renamed',
      description: 'Demo cards',
      version: '1.0.0',
    }))

    expect(JSON.parse(saved)).toMatchObject({
      name: 'Renamed',
      description: 'Demo cards',
      version: '1.0.0',
    })
    expect(mocks.writeFile).toHaveBeenLastCalledWith('D:/project/.opencard/.ocproject', saved)

    await store.setProjectPath('')
  })

  it('rejects duplicate project icon keys at the icon-registry save boundary', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    const icon = { iconKey: 'same', name: '', x: 0, y: 0, width: 8, height: 8 }

    await expect(store.saveProjectIconRegistry('.opencard/.ocicons', JSON.stringify({
      iconSeries: [{
        key: 'status',
        source: 'assets/icons/status.png',
        icons: [icon, { ...icon, x: 8 }],
      }],
    }))).rejects.toThrow('Invalid .ocicons content')
    expect(mocks.writeFile).not.toHaveBeenCalled()
    await store.setProjectPath('')
  })

  it('loads font and icon registries independently from the profile', async () => {
    mocks.fileExists.mockImplementation(async (path: string) => (
      path.endsWith('.opencard/.ocproject') || path.endsWith('.opencard/.ocfonts') || path.endsWith('.opencard/.ocicons')
    ))
    mocks.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('.opencard/.ocfonts')) {
        return JSON.stringify({
          families: [{
            key: 'brand',
            name: 'Brand',
            files: { normal: { upright: 'fonts/Brand.woff2' } },
          }],
          compositions: [{ key: 'body', name: 'Body', members: [{ fontKey: 'brand' }] }],
        })
      }
      if (path.endsWith('.opencard/.ocicons')) {
        return JSON.stringify({ iconSeries: [] })
      }
      return JSON.stringify({ name: 'Demo', fonts: { ignored: true }, iconSeries: [{ ignored: true }] })
    })

    const store = useProjectStore()
    expect(store.fontRegistryReady.value).toBe(false)
    expect(store.iconRegistryReady.value).toBe(false)
    await store.setProjectPath('D:/project')

    expect(store.resolvedProject.value?.name).toBe('Demo')
    expect(store.projectFonts.value).toEqual({
      brand: {
        kind: 'family',
        name: 'Brand',
        family: {
          key: 'brand',
          name: 'Brand',
          files: { normal: { upright: 'fonts/Brand.woff2' } },
        },
      },
      body: {
        kind: 'composition',
        name: 'Body',
        composition: { key: 'body', name: 'Body', members: [{ fontKey: 'brand' }] },
      },
    })
    expect(store.projectFontFamilies.value).toEqual([{
      key: 'brand',
      name: 'Brand',
      files: { normal: { upright: 'fonts/Brand.woff2' } },
    }])
    expect(store.projectFontCompositions.value)
      .toEqual([{ key: 'body', name: 'Body', members: [{ fontKey: 'brand' }] }])
    expect(store.projectIconSeries.value).toEqual([])
    expect(store.fontRegistryReady.value).toBe(true)
    expect(store.iconRegistryReady.value).toBe(true)

    await store.setProjectPath('')
    expect(store.fontRegistryReady.value).toBe(false)
    expect(store.iconRegistryReady.value).toBe(false)
  })

  it('preserves project-profile editor state when saving expanded directories', async () => {
    const settingsStore = useAppSettingsStore()
    settingsStore.updateProjectCreation({
      workspaceStates: {
        'D:/project': {
          expandedDirectories: [],
          projectProfile: { collapsedSections: ['fonts'] },
        },
      },
    })
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    store.setDirectoryExpanded('D:/project/assets', true)

    const scheduledSave = mocks.schedule.mock.calls[mocks.schedule.mock.calls.length - 1]?.[2]
    await scheduledSave?.()

    expect(settingsStore.settings.value.projectCreation.workspaceStates['D:/project']).toEqual({
      expandedDirectories: ['assets'],
      projectProfile: { collapsedSections: ['fonts'] },
    })
    await store.setProjectPath('')
  })

  it('loads and saves the dictionary independently from the project profile', async () => {
    let dictionaryContent = JSON.stringify({
      active: 'en_US',
      base: { title: '默认' },
      languages: { en_US: { title: 'English' } },
    })
    mocks.fileExists.mockImplementation(async (path: string) => (
      path.endsWith('.opencard/.ocproject') || path.endsWith('.opencard/.oclocale')
    ))
    mocks.readFile.mockImplementation(async (path: string) => (
      path.endsWith('.opencard/.oclocale') ? dictionaryContent : '{"name":"Demo"}'
    ))
    mocks.writeFile.mockImplementation(async (path: string, content: string) => {
      if (path.endsWith('.opencard/.oclocale')) dictionaryContent = content
    })

    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    expect(store.resolvedProject.value?.name).toBe('Demo')
    expect(store.resolvedDictionary.value).toEqual({ title: 'English' })

    const saved = await store.saveProjectDictionary('.opencard/.oclocale', JSON.stringify({
      base: { title: 'Changed' },
    }))
    expect(JSON.parse(saved)).toEqual({ base: { title: 'Changed' } })
    expect(store.resolvedDictionary.value).toEqual({ title: 'Changed' })
    expect(store.resolvedProject.value?.name).toBe('Demo')

    await store.setProjectPath('')
  })

  it('keeps the project file visible in the workspace index', async () => {
    mocks.readDirectoryEntries.mockResolvedValue([{
      name: '.opencard/.ocproject',
      isDirectory: false,
      isFile: true,
      isSymlink: false,
    }])
    const store = useProjectStore()

    await store.setProjectPath('D:/project')

    expect(store.indexedEntries.value.map((entry) => entry.name)).toContain('.opencard/.ocproject')
    expect(mocks.readDirectoryEntries).toHaveBeenCalledWith('D:/project', 2, '')
    expect(mocks.readDirectoryEntries.mock.calls.every(([, depth]) => Number.isFinite(depth))).toBe(true)
    await store.setProjectPath('')
  })

  it('prefetches one level below an expanded directory', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')

    store.setDirectoryExpanded('D:/project/assets', true)
    await store.readDirectoryEntries('D:/project/assets')

    expect(mocks.readDirectoryEntries).toHaveBeenCalledWith('D:/project/assets', 2, 'assets')
    await store.setProjectPath('')
  })

  it('detects a recent project by its project file', async () => {
    mocks.fileExists.mockImplementation(async (path: string) => path === 'D:/moved')
    const store = useProjectStore()

    await expect(store.isProjectAvailable('D:\\moved\\')).resolves.toBe(true)
    await expect(store.isProjectAvailable('D:/missing')).resolves.toBe(false)
  })

  it('chooses a project directory without opening it', async () => {
    mocks.openProject.mockResolvedValue('D:\\moved-project\\')
    const store = useProjectStore()
    await store.setProjectPath('D:/current-project')

    await expect(store.chooseProjectDirectory()).resolves.toBe('D:/moved-project')
    expect(store.projectPath.value).toBe('D:/current-project')

    await store.setProjectPath('')
  })

  it('keeps numeric suffixes before a file extension', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    mocks.fileExists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)

    await expect(store.createEntryWithAvailableName(
      'D:/project',
      'Untitled.ocdocument',
      'file',
      '{}',
    )).resolves.toBe('D:/project/Untitled 2.ocdocument')
    expect(mocks.writeFile).toHaveBeenCalledWith('D:/project/Untitled 2.ocdocument', '{}')

    await store.setProjectPath('')
  })

  it('distinguishes project font files from external files and keeps imports under .opencard', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')

    expect(store.getRelativeProjectPathIfInside('D:/project/assets/fonts/Brand.woff2'))
      .toBe('assets/fonts/Brand.woff2')
    expect(store.getRelativeProjectPathIfInside('D:/other/Brand.woff2')).toBeNull()

    await expect(store.importProjectFontFiles(
      'D:/Downloads/Brand.woff2',
    )).resolves.toEqual({ sources: ['fonts/Brand.woff2'], copied: true })
    expect(mocks.createDirectory).toHaveBeenCalledWith('D:/project/.opencard/fonts')
    expect(mocks.copyFile).toHaveBeenCalledWith(
      'D:/Downloads/Brand.woff2',
      'D:/project/.opencard/fonts/Brand.woff2',
    )

    await store.setProjectPath('')
  })

  it('plans numbered import copies and can use the existing project file', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    mocks.fileExists.mockImplementation(async (path: string) => (
      path.endsWith('/Brand.woff2') || /\/Brand \((?:[2-9]|10)\)\.woff2$/.test(path)
    ))

    await expect(store.getProjectFontImportConflict(
      'D:/Downloads/Brand.woff2',
    )).resolves.toEqual({
      existingSource: 'fonts/Brand.woff2',
      availableCopySource: 'fonts/Brand (11).woff2',
    })

    await expect(store.importProjectFontFiles(
      'D:/Downloads/Brand.woff2',
      'use-existing',
    )).resolves.toEqual({ sources: ['fonts/Brand.woff2'], copied: false })
    expect(mocks.copyFile).not.toHaveBeenCalled()

    await expect(store.importProjectFontFiles(
      'D:/Downloads/Brand.woff2',
      'rename-copy',
    )).resolves.toEqual({ sources: ['fonts/Brand (11).woff2'], copied: true })
    expect(mocks.copyFile).toHaveBeenCalledWith(
      'D:/Downloads/Brand.woff2',
      'D:/project/.opencard/fonts/Brand (11).woff2',
    )

    await store.setProjectPath('')
  })

  it('reuses a managed font file with identical imported bytes', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    mocks.readDirectoryEntries.mockResolvedValue([{
      name: 'Existing.woff2',
      isDirectory: false,
      isFile: true,
      isSymlink: false,
    }])
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([1, 2, 3]))

    await expect(store.importProjectFontFiles('D:/Downloads/DifferentName.woff2'))
      .resolves.toEqual({ sources: ['fonts/Existing.woff2'], copied: false })
    expect(mocks.copyFile).not.toHaveBeenCalled()
    await store.setProjectPath('')
  })

  it('discovers installed manifests without loading block definitions or resources', async () => {
    const descriptor = manifestDescriptorForTest()
    mocks.discoverInstalledProjectCustomBlocks.mockResolvedValue(new Map([['alice/square', descriptor]]))
    const store = useProjectStore()
    await store.setProjectPath('D:/project')

    expect(store.projectCustomBlockManifestCatalog.value.get('alice/square')).toEqual(descriptor)
    expect(mocks.loadInstalledProjectCustomBlockRuntime).not.toHaveBeenCalled()
    await store.setProjectPath('')
  })

  it('deduplicates concurrent on-demand package loads and owns a releasable runtime session', async () => {
    const descriptor = manifestDescriptorForTest()
    mocks.discoverInstalledProjectCustomBlocks.mockResolvedValue(new Map([['alice/square', descriptor]]))
    const store = useProjectStore()
    await store.setProjectPath('D:/project')

    const [first, second] = await Promise.all([
      store.ensureProjectCustomBlockLoaded('alice/square'),
      store.ensureProjectCustomBlockLoaded('ALICE/SQUARE'),
    ])
    expect(first?.manifest.packageId).toBe('alice/square')
    expect(second).toBe(first)
    expect(mocks.loadInstalledProjectCustomBlockRuntime).toHaveBeenCalledOnce()
    expect(store.projectCustomBlockManifestCatalog.value.get('alice/square')?.loadState).toBe('ready')
    expect(store.renderEnvironment.value.customBlockCatalog?.has('alice/square')).toBe(true)

    await store.setProjectPath('')
    expect(mocks.fontSessionRelease).toHaveBeenCalledOnce()
  })

  it('installs directly into the Package ID directory and never writes a legacy registry', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    mocks.writeFile.mockClear()
    mocks.discoverInstalledProjectCustomBlocks.mockResolvedValue(new Map([
      ['alice/square', manifestDescriptorForTest()],
    ]))

    await expect(store.installProjectCustomBlockFile('D:/Downloads/square.ocblock')).resolves.toEqual({
      packageId: 'alice/square',
      installationPath: '.opencard/blocks/alice/square',
      resourceRootPath: '.opencard/blocks/alice/square/resources',
      replaced: false,
    })
    expect(mocks.installProjectCustomBlockPackage).toHaveBeenCalledWith(expect.objectContaining({
      projectRootPath: 'D:/project', sourcePath: 'D:/Downloads/square.ocblock',
    }))
    expect(mocks.writeFile.mock.calls.some(([path]) => String(path).endsWith('.ocblocks'))).toBe(false)
    await store.setProjectPath('')
  })

  it('uninstalls the whole package and releases its runtime session', async () => {
    const descriptor = manifestDescriptorForTest()
    mocks.discoverInstalledProjectCustomBlocks.mockResolvedValue(new Map([['alice/square', descriptor]]))
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    await store.ensureProjectCustomBlockLoaded('alice/square')
    mocks.discoverInstalledProjectCustomBlocks.mockResolvedValue(new Map())

    await expect(store.uninstallProjectCustomBlock('alice/square')).resolves.toBe(true)
    expect(mocks.uninstallProjectCustomBlockPackage).toHaveBeenCalledWith(expect.objectContaining({
      projectRootPath: 'D:/project', packageId: 'alice/square',
    }))
    expect(mocks.fontSessionRelease).toHaveBeenCalledOnce()
    expect(store.renderEnvironment.value.customBlockCatalog?.has('alice/square')).toBe(false)
    expect(store.projectCustomBlockManifestCatalog.value.has('alice/square')).toBe(false)
    await store.setProjectPath('')
  })

  it('does not let an older directory discovery overwrite a newer catalog', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    let resolveOld: (value: Map<string, ReturnType<typeof manifestDescriptorForTest>>) => void = () => undefined
    const oldDiscovery = new Promise<Map<string, ReturnType<typeof manifestDescriptorForTest>>>(resolve => { resolveOld = resolve })
    mocks.discoverInstalledProjectCustomBlocks.mockClear()
    mocks.discoverInstalledProjectCustomBlocks
      .mockImplementationOnce(async () => await oldDiscovery)
      .mockResolvedValueOnce(new Map([['alice/new', manifestDescriptorForTest('alice/new')]]))

    const oldReload = store.reloadProjectCustomBlocks()
    await vi.waitFor(() => expect(mocks.discoverInstalledProjectCustomBlocks).toHaveBeenCalledOnce())
    const newReload = store.reloadProjectCustomBlocks()
    resolveOld(new Map([['alice/old', manifestDescriptorForTest('alice/old')]]))

    await Promise.all([oldReload, newReload])
    expect([...store.projectCustomBlockManifestCatalog.value.keys()]).toEqual(['alice/new'])
    await store.setProjectPath('')
  })

  it('invalidates loaded sessions when the installed package root changes', async () => {
    vi.useFakeTimers()
    try {
      const descriptor = manifestDescriptorForTest()
      mocks.discoverInstalledProjectCustomBlocks.mockResolvedValue(new Map([['alice/square', descriptor]]))
      const store = useProjectStore()
      await store.setProjectPath('D:/project')
      await store.ensureProjectCustomBlockLoaded('alice/square')
      mocks.discoverInstalledProjectCustomBlocks.mockResolvedValue(new Map())

      mocks.eventListener?.({ payload: { kind: 'remove', paths: ['D:/project/.opencard/blocks'] } })
      await vi.advanceTimersByTimeAsync(121)
      await Promise.resolve()
      expect(mocks.fontSessionRelease).toHaveBeenCalledOnce()
      expect(store.renderEnvironment.value.customBlockCatalog?.has('alice/square')).toBe(false)
      expect(store.projectCustomBlockManifestCatalog.value.has('alice/square')).toBe(false)
      await store.setProjectPath('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('refreshes the workspace index after saving a new file into the project', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    mocks.readDirectoryEntries.mockResolvedValue([{
      name: 'Draft.ocdocument',
      isDirectory: false,
      isFile: true,
      isSymlink: false,
    }])

    await store.saveFile('D:/project/Draft.ocdocument', '{}')

    expect(mocks.writeFile).toHaveBeenCalledWith('D:/project/Draft.ocdocument', '{}')
    expect(store.indexedEntries.value.map((entry) => entry.name)).toContain('Draft.ocdocument')
    await store.setProjectPath('')
  })

  it('treats a nested legacy-named file as an ordinary workspace entry', async () => {
    mocks.readDirectoryEntries.mockResolvedValue([
      { name: 'config', isDirectory: true, isFile: false, isSymlink: false },
      { name: 'config/.oclocale', isDirectory: false, isFile: true, isSymlink: false },
      { name: 'cards.ocdocument', isDirectory: false, isFile: true, isSymlink: false },
    ])
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    const request = {
      key: 'D:/project/config/.oclocale',
      targetKey: 'D:/project/cards.ocdocument',
      position: 'before' as const,
    }

    expect(store.canMoveEntryByDrop(request)).toBe(true)
    await expect(store.moveEntryByDrop(request)).resolves.toEqual({
      ok: true,
      fromPath: 'D:/project/config/.oclocale',
      toPath: 'D:/project/.oclocale',
    })
    expect(mocks.renameFile).toHaveBeenCalledWith(
      'D:/project/config/.oclocale',
      'D:/project/.oclocale',
    )

    await store.setProjectPath('')
  })

  it('protects managed project files from ordinary trash operations', async () => {
    mocks.fileExists.mockImplementation(async (path: string) => path.endsWith('.opencard/.ocproject'))
    mocks.readFile.mockResolvedValue('{"name":"Demo"}')
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    expect(store.resolvedProject.value?.name).toBe('Demo')
    await expect(store.trashFile('.opencard/.ocproject'))
      .rejects.toThrow('Managed project files cannot be moved to trash')
    expect(store.resolvedProject.value).not.toBeNull()
    expect(mocks.trashFile).not.toHaveBeenCalled()

    await store.setProjectPath('')
  })

  it('trashes only managed font files absent from the current registry draft', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')

    await store.trashUnusedProjectFontFiles(
      ['D:/project/.opencard/fonts/Unused.otf'],
      ['fonts/Brand.otf'],
    )
    expect(mocks.trashFile).toHaveBeenCalledWith('D:/project/.opencard/fonts/Unused.otf')

    await expect(store.trashUnusedProjectFontFiles(
      ['D:/project/.opencard/fonts/Brand.otf'],
      ['fonts/Brand.otf'],
    )).rejects.toThrow('still registered')
    await expect(store.trashUnusedProjectFontFiles(
      ['D:/project/card.ocdocument'],
      [],
    )).rejects.toThrow('Only managed project font files')
    await expect(store.trashUnusedProjectFontFiles(
      ['.opencard/fonts/../../outside.otf'],
      [],
    )).rejects.toThrow('Unsafe project font path')

    await store.setProjectPath('')
  })

  it('trashes only managed icon images absent from the current registry draft', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')

    await store.trashUnusedProjectIconFiles(
      ['D:/project/.opencard/icons/unused.png'],
      ['icons/status.png'],
    )
    expect(mocks.trashFile).toHaveBeenCalledWith('D:/project/.opencard/icons/unused.png')
    await expect(store.trashUnusedProjectIconFiles(
      ['D:/project/.opencard/icons/status.png'],
      ['icons/status.png'],
    )).rejects.toThrow('still registered')

    await store.setProjectPath('')
  })

})

function packageResultForTest(packageId = 'alice/square') {
  return {
    manifest: {
      type: 'opencard-custom-block' as const,
      packageId,
      version: '0.1.0',
      name: packageId.split('/').pop() ?? packageId,
      publicFieldKeys: ['name', 'notes'],
      resize: { widthLocked: false, heightLocked: false },
    },
    block: { type: 'text-block' as const, id: 'root', content: '' },
    installationPath: `D:/project/.opencard/blocks/${packageId}`,
    resourceRootPath: `D:/project/.opencard/blocks/${packageId}/resources`,
  }
}

function manifestDescriptorForTest(packageId = 'alice/square') {
  const fixture = packageResultForTest(packageId)
  return {
    manifest: fixture.manifest,
    installationPath: fixture.installationPath,
    resourceRootPath: fixture.resourceRootPath,
    loadState: 'unloaded' as const,
  }
}

function runtimeResultForTest(packageId = 'alice/square') {
  const fixture = packageResultForTest(packageId)
  const environment = {
    kind: 'package' as const, namespace: `package-${packageId.replace('/', '-')}`,
    rootPath: fixture.resourceRootPath, fontDocument: {}, fonts: {}, iconDocument: {},
    iconCatalog: { series: [], entries: [], errors: [] }, issues: [], customBlockCatalog: new Map(),
  }
  const runtimeEntry = {
    manifest: fixture.manifest, block: fixture.block, environment, dependencies: new Map(),
  }
  return {
    entry: { ...fixture, issues: [] }, runtimeEntry, environments: [environment], issues: [],
  }
}
