import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  schedule: vi.fn(),
  openProject: vi.fn(),
  fileExists: vi.fn(),
  readDirectoryEntries: vi.fn(),
  writeFile: vi.fn(),
  startWatching: vi.fn(),
  stopWatching: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: vi.fn() }))
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
    expect(mocks.writeFile).toHaveBeenCalledWith(
      'D:/project/.opencardproject',
      expect.stringContaining('"expandedDirectories": []'),
    )

    await store.setProjectPath('')
  })

  it('merges edited project information with the current workspace state', async () => {
    const store = useProjectStore()
    await store.setProjectPath('D:/project')
    store.setDirectoryExpanded('D:/project/assets', true)

    const saved = await store.saveProjectConfiguration(JSON.stringify({
      version: 1,
      project: {
        name: 'Renamed',
        description: 'Demo cards',
        author: 'Alice',
        additionalFieldDefinition: {
          author: { fieldType: 'string', title: 'Author' },
        },
      },
      workspace: { indexedEntries: [], expandedDirectories: [] },
    }))

    expect(JSON.parse(saved)).toMatchObject({
      project: {
        name: 'Renamed',
        description: 'Demo cards',
        author: 'Alice',
        additionalFieldDefinition: {
          author: { fieldType: 'string', title: 'Author' },
        },
      },
      workspace: { expandedDirectories: ['assets'] },
    })
    expect(mocks.writeFile).toHaveBeenLastCalledWith('D:/project/.opencardproject', saved)

    await store.setProjectPath('')
  })

  it('keeps the project file visible in the workspace index', async () => {
    mocks.readDirectoryEntries.mockResolvedValue([{
      name: '.opencardproject',
      isDirectory: false,
      isFile: true,
      isSymlink: false,
    }])
    const store = useProjectStore()

    await store.setProjectPath('D:/project')

    expect(store.indexedEntries.value.map((entry) => entry.name)).toContain('.opencardproject')
    await store.setProjectPath('')
  })

  it('detects a recent project by its project file', async () => {
    mocks.fileExists.mockImplementation(async (path: string) => path === 'D:/moved/.opencardproject')
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
})
