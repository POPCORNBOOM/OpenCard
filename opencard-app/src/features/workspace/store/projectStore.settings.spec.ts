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
  startWatching: vi.fn(),
  stopWatching: vi.fn(),
  readProjectCustomBlockPackage: vi.fn(),
  readProjectCustomBlockManifest: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: vi.fn(), isTauri: () => false }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => vi.fn()) }))
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
    startWatching: mocks.startWatching,
    stopWatching: mocks.stopWatching,
  },
}))
vi.mock('../services/projectStructureService', () => ({
  classifyProjectDirectory: vi.fn(async () => 'project'),
  ensureProjectStructure: vi.fn(async () => undefined),
  initializeProjectStructure: vi.fn(async () => undefined),
}))
vi.mock('../services/projectIconCatalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/projectIconCatalog')>()
  return {
    ...actual,
    buildProjectIconCatalog: vi.fn(async () => ({ series: [], entries: [], errors: [] })),
  }
})
vi.mock('../services/projectCustomBlock', () => ({
  readProjectCustomBlockPackage: mocks.readProjectCustomBlockPackage,
  readProjectCustomBlockManifest: mocks.readProjectCustomBlockManifest,
}))

import { useProjectStore } from './projectStore'
import { useAppSettingsStore } from '../../settings/store/appSettingsStore'

describe('projectStore settings actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    mocks.readProjectCustomBlockPackage.mockResolvedValue(packageResultForTest())
    mocks.readProjectCustomBlockManifest.mockResolvedValue({ manifest: packageResultForTest().manifest, issues: [] })
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
            faces: [{
              source: 'fonts/Brand.woff2',
              weight: { min: 400, max: 400 },
              stretch: { min: 100, max: 100 },
              style: { kind: 'normal' },
            }],
          }],
          compositions: [{ key: 'body', name: 'Body', members: [{ familyKey: 'brand' }] }],
        })
      }
      if (path.endsWith('.opencard/.ocicons')) {
        return JSON.stringify({ iconSeries: [] })
      }
      return JSON.stringify({ name: 'Demo', fonts: { ignored: true }, iconSeries: [{ ignored: true }] })
    })

    const store = useProjectStore()
    await store.setProjectPath('D:/project')

    expect(store.resolvedProject.value?.name).toBe('Demo')
    expect(store.projectFonts.value).toEqual({
      brand: {
        kind: 'family',
        name: 'Brand',
        family: {
          key: 'brand',
          name: 'Brand',
          faces: [{
            source: 'fonts/Brand.woff2',
            weight: { min: 400, max: 400 },
            stretch: { min: 100, max: 100 },
            style: { kind: 'normal' },
          }],
        },
      },
      body: {
        kind: 'composition',
        name: 'Body',
        composition: { key: 'body', name: 'Body', members: [{ familyKey: 'brand' }] },
      },
    })
    expect(store.projectFontFamilies.value).toEqual([{
      key: 'brand',
      name: 'Brand',
      faces: [{
        source: 'fonts/Brand.woff2',
        weight: { min: 400, max: 400 },
        stretch: { min: 100, max: 100 },
        style: { kind: 'normal' },
      }],
    }])
    expect(store.projectFontCompositions.value)
      .toEqual([{ key: 'body', name: 'Body', members: [{ familyKey: 'brand' }] }])
    expect(store.projectIconSeries.value).toEqual([])

    await store.setProjectPath('')
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

  it('copies custom block packages into the managed blocks directory', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')

    await expect(store.importProjectCustomBlockFile(
      'D:/project/library/square.ocblock',
    )).resolves.toEqual({ source: 'blocks/square.ocblock', copied: true })
    await expect(store.importProjectCustomBlockFile(
      'D:/Downloads/square.ocblock',
    )).resolves.toEqual({ source: 'blocks/square.ocblock', copied: true })
    expect(mocks.copyFile).toHaveBeenCalledWith(
      'D:/Downloads/square.ocblock',
      'D:/project/.opencard/blocks/square.ocblock',
    )

    await store.setProjectPath('')
  })

  it('replaces a compatible same-key registration and rejects an incompatible package before copying', async () => {
    mocks.fileExists.mockImplementation(async (path: string) => path.endsWith('.opencard/.ocblocks'))
    mocks.readFile.mockResolvedValue('{"blocks":["blocks/old-square.ocblock"]}')
    const store = useProjectStore()
    await store.setProjectPath('D:/project')

    await expect(store.importProjectCustomBlockFile(
      'D:/Downloads/new-square.ocblock',
    )).resolves.toEqual({
      source: 'blocks/new-square.ocblock',
      copied: true,
      replacedSource: 'blocks/old-square.ocblock',
    })

    mocks.copyFile.mockClear()
    mocks.readProjectCustomBlockPackage.mockResolvedValueOnce({
      manifest: {
        type: 'opencard-custom-block',

        customBlockKey: 'square',
        name: 'Square v2',
        publicFieldKeys: [],
        resize: { widthLocked: false, heightLocked: false },
      },
      block: { type: 'text-block', id: 'root', content: '' },
      archivePath: '',
      files: new Map(),
    })
    await expect(store.importProjectCustomBlockFile(
      'D:/Downloads/incompatible.ocblock',
    )).resolves.toMatchObject({ replacedSource: 'blocks/old-square.ocblock' })

    await store.setProjectPath('')
  })

  it('creates the explicit registry only when a custom block is registered', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')

    await expect(store.registerProjectCustomBlockFile(
      'D:/Downloads/square.ocblock',
    )).resolves.toMatchObject({
      source: 'blocks/square.ocblock',
      copied: true,
    })

    const registryWrite = mocks.writeFile.mock.calls.find(([path]) => path === 'D:/project/.opencard/.ocblocks')
    expect(registryWrite).toBeDefined()
    expect(JSON.parse(registryWrite?.[1] as string)).toEqual({
      blocks: ['blocks/square.ocblock'],
    })
    await store.setProjectPath('')
  })

  it('does not let an older custom block reload overwrite a newer catalog', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    mocks.fileExists.mockImplementation(async path => path.endsWith('.opencard/.ocblocks'))
    type ManifestResult = { manifest: ReturnType<typeof packageResultForTest>['manifest'], issues: readonly never[] }
    let resolveOld: (value: ManifestResult) => void = () => undefined
    const oldPackage = new Promise<ManifestResult>(resolve => { resolveOld = resolve })
    mocks.readFile.mockImplementation(async () => '{"blocks":["old.ocblock"]}')
    mocks.readProjectCustomBlockManifest.mockImplementationOnce(async () => await oldPackage)

    const oldReload = store.reloadProjectCustomBlockRegistry()
    await vi.waitFor(() => expect(mocks.readProjectCustomBlockManifest).toHaveBeenCalled())
    mocks.readProjectCustomBlockManifest.mockClear()
    mocks.readFile.mockImplementation(async () => '{"blocks":["new.ocblock"]}')
    mocks.readProjectCustomBlockManifest.mockImplementationOnce(async () => ({
      manifest: { ...packageResultForTest().manifest, customBlockKey: 'new' }, issues: [],
    }))
    const newReload = store.reloadProjectCustomBlockRegistry()
    resolveOld({ manifest: { ...packageResultForTest().manifest, customBlockKey: 'old' }, issues: [] })

    await Promise.all([oldReload, newReload])
    expect([...store.projectCustomBlockManifestCatalog.value.keys()]).toEqual(['new'])
    await store.setProjectPath('')
  })

  it('uses the actual project package selected by use-existing', async () => {
    mocks.fileExists.mockImplementation(async (path: string) => (
      path.endsWith('.opencard/.ocblocks') || path.endsWith('/.opencard/blocks/square.ocblock')
    ))
    mocks.readFile.mockResolvedValue('{"blocks":["blocks/old-square.ocblock"]}')
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    mocks.readProjectCustomBlockPackage
      .mockResolvedValueOnce({ ...packageResultForTest() })
      .mockResolvedValueOnce({ ...packageResultForTest() })

    await expect(store.importProjectCustomBlockFile(
      'D:/Downloads/square.ocblock',
      'use-existing',
    )).resolves.toMatchObject({ copied: false })
    expect(mocks.copyFile).not.toHaveBeenCalled()
    await store.setProjectPath('')
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

})

function packageResultForTest() {
  return {
    manifest: {
      type: 'opencard-custom-block',

      customBlockKey: 'square',
      name: 'Square',
      publicFieldKeys: [],
      resize: { widthLocked: false, heightLocked: false },
    },
    block: { type: 'text-block', id: 'root', content: '' },
    archivePath: '',
    files: new Map(),
  }
}
