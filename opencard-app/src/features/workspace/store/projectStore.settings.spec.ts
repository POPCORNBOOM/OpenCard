import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  schedule: vi.fn(),
  openProject: vi.fn(),
  fileExists: vi.fn(),
  readDirectoryEntries: vi.fn(),
  writeFile: vi.fn(),
  createDirectory: vi.fn(),
    copyFile: vi.fn(),
    renameFile: vi.fn(),
  readFile: vi.fn(),
  trashFile: vi.fn(),
  startWatching: vi.fn(),
  stopWatching: vi.fn(),
  readProjectCustomBlockPackage: vi.fn(),
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
    createDirectory: mocks.createDirectory,
    copyFile: mocks.copyFile,
    renameFile: mocks.renameFile,
    readFile: mocks.readFile,
    trashFile: mocks.trashFile,
    startWatching: mocks.startWatching,
    stopWatching: mocks.stopWatching,
  },
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
    mocks.createDirectory.mockResolvedValue(undefined)
    mocks.copyFile.mockResolvedValue(undefined)
    mocks.renameFile.mockResolvedValue(undefined)
    mocks.readFile.mockResolvedValue('{}')
    mocks.trashFile.mockResolvedValue(undefined)
    mocks.startWatching.mockResolvedValue(undefined)
    mocks.stopWatching.mockResolvedValue(undefined)
    mocks.readProjectCustomBlockPackage.mockResolvedValue({
      manifest: {
        type: 'opencard-custom-block',
        schemaVersion: '1',
        key: 'square',
        name: 'Square',
        interfaceHash: 'same-interface',
        root: { type: 'text', id: 'root', name: 'Square' },
        publicFields: [],
        resize: { widthLocked: false, heightLocked: false },
      },
      archivePath: '',
      files: new Map(),
    })
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

  it('merges edited project information with the current workspace state', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    store.setDirectoryExpanded('D:/project/assets', true)

    const saved = await store.saveProjectConfiguration('.ocproject', JSON.stringify({
      name: 'Renamed',
      description: 'Demo cards',
      version: '1.0.0',
    }))

    expect(JSON.parse(saved)).toMatchObject({
      name: 'Renamed',
      description: 'Demo cards',
      version: '1.0.0',
    })
    expect(mocks.writeFile).toHaveBeenLastCalledWith('D:/project/.ocproject', saved)

    await store.setProjectPath('')
  })

  it('rejects duplicate project icon keys at the icon-registry save boundary', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    const icon = { iconKey: 'same', name: '', x: 0, y: 0, width: 8, height: 8 }

    await expect(store.saveProjectIconRegistry('.ocicons', JSON.stringify({
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
      path.endsWith('.ocproject') || path.endsWith('.ocfonts') || path.endsWith('.ocicons')
    ))
    mocks.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('.ocfonts')) {
        return JSON.stringify({
          fonts: [{ key: 'brand', name: 'Brand', source: 'assets/fonts/Brand.woff2' }],
          fontSets: [{ key: 'body', name: 'Body', fontKeys: ['brand'] }],
        })
      }
      if (path.endsWith('.ocicons')) {
        return JSON.stringify({ iconSeries: [] })
      }
      return JSON.stringify({ name: 'Demo', fonts: { ignored: true }, iconSeries: [{ ignored: true }] })
    })

    const store = useProjectStore()
    await store.setProjectPath('D:/project')

    expect(store.resolvedProject.value?.name).toBe('Demo')
    expect(store.projectFonts.value).toEqual({
      brand: { name: 'Brand', source: 'assets/fonts/Brand.woff2' },
      body: { name: 'Body', source: 'font:brand' },
    })
    expect(store.projectFontFiles.value).toEqual([
      { key: 'brand', name: 'Brand', source: 'assets/fonts/Brand.woff2' },
    ])
    expect(store.projectFontSets.value).toEqual([{ key: 'body', name: 'Body', fontKeys: ['brand'] }])
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
      path.endsWith('.ocproject') || path.endsWith('.oclocale')
    ))
    mocks.readFile.mockImplementation(async (path: string) => (
      path.endsWith('.oclocale') ? dictionaryContent : '{"name":"Demo"}'
    ))
    mocks.writeFile.mockImplementation(async (path: string, content: string) => {
      if (path.endsWith('.oclocale')) dictionaryContent = content
    })

    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    expect(store.resolvedProject.value?.name).toBe('Demo')
    expect(store.resolvedDictionary.value).toEqual({ title: 'English' })

    const saved = await store.saveProjectDictionary('.oclocale', JSON.stringify({
      base: { title: 'Changed' },
    }))
    expect(JSON.parse(saved)).toEqual({ base: { title: 'Changed' } })
    expect(store.resolvedDictionary.value).toEqual({ title: 'Changed' })
    expect(store.resolvedProject.value?.name).toBe('Demo')

    await store.setProjectPath('')
  })

  it('keeps the project file visible in the workspace index', async () => {
    mocks.readDirectoryEntries.mockResolvedValue([{
      name: '.ocproject',
      isDirectory: false,
      isFile: true,
      isSymlink: false,
    }])
    const store = useProjectStore()

    await store.setProjectPath('D:/project')

    expect(store.indexedEntries.value.map((entry) => entry.name)).toContain('.ocproject')
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

  it('distinguishes project font files from external files and uses a custom import directory', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')

    expect(store.getRelativeProjectPathIfInside('D:/project/assets/fonts/Brand.woff2'))
      .toBe('assets/fonts/Brand.woff2')
    expect(store.getRelativeProjectPathIfInside('D:/other/Brand.woff2')).toBeNull()

    await expect(store.importProjectFontFile(
      'D:/Downloads/Brand.woff2',
      'resources/typefaces',
    )).resolves.toEqual({ source: 'resources/typefaces/Brand.woff2', copied: true })
    expect(mocks.createDirectory).toHaveBeenCalledWith('D:/project/resources/typefaces')
    expect(mocks.copyFile).toHaveBeenCalledWith(
      'D:/Downloads/Brand.woff2',
      'D:/project/resources/typefaces/Brand.woff2',
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
      'assets/fonts',
    )).resolves.toEqual({
      existingSource: 'assets/fonts/Brand.woff2',
      availableCopySource: 'assets/fonts/Brand (11).woff2',
    })

    await expect(store.importProjectFontFile(
      'D:/Downloads/Brand.woff2',
      'assets/fonts',
      'use-existing',
    )).resolves.toEqual({ source: 'assets/fonts/Brand.woff2', copied: false })
    expect(mocks.copyFile).not.toHaveBeenCalled()

    await expect(store.importProjectFontFile(
      'D:/Downloads/Brand.woff2',
      'assets/fonts',
      'rename-copy',
    )).resolves.toEqual({ source: 'assets/fonts/Brand (11).woff2', copied: true })
    expect(mocks.copyFile).toHaveBeenCalledWith(
      'D:/Downloads/Brand.woff2',
      'D:/project/assets/fonts/Brand (11).woff2',
    )

    await store.setProjectPath('')
  })

  it('keeps project custom block packages in place and copies external packages to assets/blocks', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')

    await expect(store.importProjectCustomBlockFile(
      'D:/project/library/square.ocblock',
    )).resolves.toEqual({ source: 'library/square.ocblock', copied: false })
    await expect(store.importProjectCustomBlockFile(
      'D:/Downloads/square.ocblock',
    )).resolves.toEqual({ source: 'assets/blocks/square.ocblock', copied: true })
    expect(mocks.copyFile).toHaveBeenCalledWith(
      'D:/Downloads/square.ocblock',
      'D:/project/assets/blocks/square.ocblock',
    )

    await store.setProjectPath('')
  })

  it('replaces a compatible same-key registration and rejects an incompatible package before copying', async () => {
    mocks.fileExists.mockImplementation(async (path: string) => path.endsWith('.ocblocks'))
    mocks.readFile.mockResolvedValue('{"blocks":["library/old-square.ocblock"]}')
    const store = useProjectStore()
    await store.setProjectPath('D:/project')

    await expect(store.importProjectCustomBlockFile(
      'D:/Downloads/new-square.ocblock',
    )).resolves.toEqual({
      source: 'assets/blocks/new-square.ocblock',
      copied: true,
      replacedSource: 'library/old-square.ocblock',
    })

    mocks.copyFile.mockClear()
    mocks.readProjectCustomBlockPackage.mockResolvedValueOnce({
      manifest: {
        type: 'opencard-custom-block',
        schemaVersion: '1',
        key: 'square',
        name: 'Square v2',
        interfaceHash: 'different-interface',
        root: { type: 'text', id: 'root', name: 'Square' },
        publicFields: [],
        resize: { widthLocked: false, heightLocked: false },
      },
      archivePath: '',
      files: new Map(),
    })
    await expect(store.importProjectCustomBlockFile(
      'D:/Downloads/incompatible.ocblock',
    )).rejects.toThrow('Custom block interface mismatch: square')
    expect(mocks.copyFile).not.toHaveBeenCalled()

    await store.setProjectPath('')
  })

  it('creates the explicit registry only when a custom block is registered', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')

    await expect(store.registerProjectCustomBlockFile(
      'D:/Downloads/square.ocblock',
    )).resolves.toMatchObject({
      source: 'assets/blocks/square.ocblock',
      copied: true,
    })

    const registryWrite = mocks.writeFile.mock.calls.find(([path]) => path === 'D:/project/.ocblocks')
    expect(registryWrite).toBeDefined()
    expect(JSON.parse(registryWrite?.[1] as string)).toEqual({
      blocks: ['assets/blocks/square.ocblock'],
    })
    await store.setProjectPath('')
  })

  it('does not let an older custom block reload overwrite a newer catalog', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    mocks.fileExists.mockImplementation(async path => path.endsWith('.ocblocks'))
    let resolveOld: (value: ReturnType<typeof packageResultForTest>) => void = () => undefined
    const oldPackage = new Promise<ReturnType<typeof packageResultForTest>>(resolve => { resolveOld = resolve })
    mocks.readFile.mockImplementation(async () => '{"blocks":["old.ocblock"]}')
    mocks.readProjectCustomBlockPackage.mockImplementationOnce(async () => await oldPackage)

    const oldReload = store.reloadProjectCustomBlockRegistry()
    await Promise.resolve()
    mocks.readFile.mockImplementation(async () => '{"blocks":["new.ocblock"]}')
    mocks.readProjectCustomBlockPackage.mockImplementationOnce(async () => ({
      ...packageResultForTest('same-interface'),
      manifest: { ...packageResultForTest('same-interface').manifest, key: 'new' },
    }))
    const newReload = store.reloadProjectCustomBlockRegistry()
    resolveOld({
      ...packageResultForTest('same-interface'),
      manifest: { ...packageResultForTest('same-interface').manifest, key: 'old' },
    })

    await Promise.all([oldReload, newReload])
    expect([...store.projectCustomBlockCatalog.value.keys()]).toEqual(['new'])
    await store.setProjectPath('')
  })

  it('validates the actual project package selected by use-existing', async () => {
    mocks.fileExists.mockImplementation(async (path: string) => (
      path.endsWith('.ocblocks') || path.endsWith('/assets/blocks/square.ocblock')
    ))
    mocks.readFile.mockResolvedValue('{"blocks":["library/old-square.ocblock"]}')
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    mocks.readProjectCustomBlockPackage
      .mockResolvedValueOnce({ ...packageResultForTest('same-interface') })
      .mockResolvedValueOnce({ ...packageResultForTest('different-interface') })

    await expect(store.importProjectCustomBlockFile(
      'D:/Downloads/square.ocblock',
      'use-existing',
    )).rejects.toThrow('Custom block interface mismatch: square')
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

  it('moves a nested special file back to the project root beside a root entry', async () => {
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

  it('preserves the loaded profile when moving it to trash fails', async () => {
    mocks.fileExists.mockImplementation(async (path: string) => path.endsWith('.ocproject'))
    mocks.readFile.mockResolvedValue('{"name":"Demo"}')
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    expect(store.resolvedProject.value?.name).toBe('Demo')
    mocks.trashFile.mockRejectedValueOnce(new Error('trash unavailable'))

    await expect(store.trashFile('.ocproject')).rejects.toThrow('trash unavailable')
    expect(store.resolvedProject.value).not.toBeNull()

    await store.setProjectPath('')
  })

  it('clears the loaded profile only after it reaches trash', async () => {
    mocks.fileExists.mockImplementation(async (path: string) => path.endsWith('.ocproject'))
    mocks.readFile.mockResolvedValue('{"name":"Demo"}')
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    expect(store.resolvedProject.value?.name).toBe('Demo')

    await store.trashFile('.ocproject')
    expect(mocks.trashFile).toHaveBeenCalledWith('D:/project/.ocproject')
    expect(store.resolvedProject.value).toBeNull()

    await store.setProjectPath('')
  })
})

function packageResultForTest(interfaceHash: string) {
  return {
    manifest: {
      type: 'opencard-custom-block',
      schemaVersion: '1',
      key: 'square',
      name: 'Square',
      interfaceHash,
      root: { type: 'text', id: 'root', name: 'Square' },
      publicFields: [],
      resize: { widthLocked: false, heightLocked: false },
    },
    archivePath: '',
    files: new Map(),
  }
}
