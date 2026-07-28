import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  schedule: vi.fn(),
  openProject: vi.fn(),
  fileExists: vi.fn(),
  readDirectoryEntries: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  trashFile: vi.fn(),
  startWatching: vi.fn(),
  stopWatching: vi.fn(),
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
    readFile: mocks.readFile,
    trashFile: mocks.trashFile,
    startWatching: mocks.startWatching,
    stopWatching: mocks.stopWatching,
  },
}))

import { useProjectStore } from './projectStore'

describe('projectStore settings actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.openProject.mockResolvedValue(null)
    mocks.fileExists.mockResolvedValue(false)
    mocks.readDirectoryEntries.mockResolvedValue([])
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.readFile.mockResolvedValue('{}')
    mocks.trashFile.mockResolvedValue(undefined)
    mocks.startWatching.mockResolvedValue(undefined)
    mocks.stopWatching.mockResolvedValue(undefined)
  })

  it('resets workspace state through the store and rewrites project metadata', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    store.setDirectoryExpanded('D:/project/src', true)

    await store.resetProjectWorkspaceState()

    expect(mocks.cancel).toHaveBeenCalledWith('project-metadata')
    expect(store.expandedDirectories.value.size).toBe(0)
    expect(store.registeredDirectories.value).toEqual(new Map([['', 1]]))
    expect(mocks.writeFile).not.toHaveBeenCalled()

    await store.setProjectPath('')
  })

  it('merges edited project information with the current workspace state', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    store.setDirectoryExpanded('D:/project/assets', true)

    const saved = await store.saveProjectConfiguration('.opencardprojectprofile', JSON.stringify({
      name: 'Renamed',
      description: 'Demo cards',
      version: '1.0.0',
    }))

    expect(JSON.parse(saved)).toMatchObject({
      name: 'Renamed',
      description: 'Demo cards',
      version: '1.0.0',
    })
    expect(mocks.writeFile).toHaveBeenLastCalledWith('D:/project/.opencardprojectprofile', saved)

    await store.setProjectPath('')
  })

  it('loads and saves the dictionary independently from the project profile', async () => {
    let dictionaryContent = JSON.stringify({
      active: 'en_US',
      base: { title: '默认' },
      languages: { en_US: { title: 'English' } },
    })
    mocks.fileExists.mockImplementation(async (path: string) => (
      path.endsWith('.opencardprojectprofile') || path.endsWith('.dictionary')
    ))
    mocks.readFile.mockImplementation(async (path: string) => (
      path.endsWith('.dictionary') ? dictionaryContent : '{"name":"Demo"}'
    ))
    mocks.writeFile.mockImplementation(async (path: string, content: string) => {
      if (path.endsWith('.dictionary')) dictionaryContent = content
    })

    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    expect(store.resolvedProject.value?.name).toBe('Demo')
    expect(store.resolvedDictionary.value).toEqual({ title: 'English' })

    const saved = await store.saveProjectDictionary('.dictionary', JSON.stringify({
      base: { title: 'Changed' },
    }))
    expect(JSON.parse(saved)).toEqual({ base: { title: 'Changed' } })
    expect(store.resolvedDictionary.value).toEqual({ title: 'Changed' })
    expect(store.resolvedProject.value?.name).toBe('Demo')

    await store.setProjectPath('')
  })

  it('keeps the project file visible in the workspace index', async () => {
    mocks.readDirectoryEntries.mockResolvedValue([{
      name: '.opencardprojectprofile',
      isDirectory: false,
      isFile: true,
      isSymlink: false,
    }])
    const store = useProjectStore()

    await store.setProjectPath('D:/project')

    expect(store.indexedEntries.value.map((entry) => entry.name)).toContain('.opencardprojectprofile')
    expect(mocks.readDirectoryEntries).toHaveBeenCalledWith('D:/project', 1, '')
    expect(mocks.readDirectoryEntries.mock.calls.every(([, depth]) => Number.isFinite(depth))).toBe(true)
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
      'Untitled.opencard',
      'file',
      '{}',
    )).resolves.toBe('D:/project/Untitled 2.opencard')
    expect(mocks.writeFile).toHaveBeenCalledWith('D:/project/Untitled 2.opencard', '{}')

    await store.setProjectPath('')
  })

  it('preserves the loaded profile when moving it to trash fails', async () => {
    mocks.fileExists.mockImplementation(async (path: string) => path.endsWith('.opencardprojectprofile'))
    mocks.readFile.mockResolvedValue('{"name":"Demo"}')
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    expect(store.resolvedProject.value?.name).toBe('Demo')
    mocks.trashFile.mockRejectedValueOnce(new Error('trash unavailable'))

    await expect(store.trashFile('.opencardprojectprofile')).rejects.toThrow('trash unavailable')
    expect(store.resolvedProject.value).not.toBeNull()

    await store.setProjectPath('')
  })

  it('clears the loaded profile only after it reaches trash', async () => {
    mocks.fileExists.mockImplementation(async (path: string) => path.endsWith('.opencardprojectprofile'))
    mocks.readFile.mockResolvedValue('{"name":"Demo"}')
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    expect(store.resolvedProject.value?.name).toBe('Demo')

    await store.trashFile('.opencardprojectprofile')
    expect(mocks.trashFile).toHaveBeenCalledWith('D:/project/.opencardprojectprofile')
    expect(store.resolvedProject.value).toBeNull()

    await store.setProjectPath('')
  })
})
