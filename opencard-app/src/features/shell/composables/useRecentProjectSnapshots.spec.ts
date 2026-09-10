import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => `asset://${path}` }))
import { recentProjectKey, useRecentProjectSnapshots, WELCOME_COVER_SOURCE_LIMIT } from './useRecentProjectSnapshots'

function createFileSystem(files: ReadonlyMap<string, string>) {
  return {
    fileExists: async (path: string) => files.has(path),
    readFile: async (path: string) => files.get(path) ?? '',
  }
}

function projectFiles(name: string, cover?: string): Map<string, string> {
  return new Map<string, string>([
    [`/${name}/.opencard/project.json`, JSON.stringify(cover ? { name, cover } : { name })],
    ...(cover ? [[`/${name}/${cover}`, 'bytes'] as [string, string]] : []),
  ])
}

describe('useRecentProjectSnapshots', () => {
  it('probes availability and cover for every recent project', async () => {
    const files = new Map<string, string>([
      ...projectFiles('Covered', 'assets/cover.png'),
      ...projectFiles('Bare'),
    ])
    files.set('/Covered', '')
    files.set('/Bare', '')
    const recentProjects = ref<readonly string[]>(['/Covered', '/Bare', '/Missing'])
    const { snapshots } = useRecentProjectSnapshots({ recentProjects, fs: createFileSystem(files) })
    await vi.waitFor(() => expect(snapshots.value.size).toBe(3))

    expect(snapshots.value.get(recentProjectKey('/Covered'))).toEqual({
      available: true,
      cover: {
        relativePath: 'assets/cover.png',
        absolutePath: '/Covered/assets/cover.png',
        src: 'asset:///Covered/assets/cover.png',
      },
    })
    expect(snapshots.value.get(recentProjectKey('/Bare'))).toEqual({ available: true, cover: null })
    expect(snapshots.value.get(recentProjectKey('/Missing'))).toEqual({ available: false, cover: null })
  })

  it('stays silent when the project profile is unreadable', async () => {
    const files = new Map<string, string>([['/Broken', ''], ['/Broken/.opencard/project.json', '{broken']])
    const recentProjects = ref<readonly string[]>(['/Broken'])
    const { snapshots } = useRecentProjectSnapshots({ recentProjects, fs: createFileSystem(files) })
    await vi.waitFor(() => expect(snapshots.value.size).toBe(1))

    expect(snapshots.value.get(recentProjectKey('/Broken'))).toEqual({ available: true, cover: null })
  })

  it('only reads covers for the most recent projects that the cover wall can show', async () => {
    const paths = Array.from({ length: WELCOME_COVER_SOURCE_LIMIT + 2 }, (_, index) => `/Project ${index}`)
    const files = new Map<string, string>()
    for (const path of paths) {
      files.set(path, '')
      files.set(`${path}/.opencard/project.json`, JSON.stringify({ name: path, cover: 'assets/cover.png' }))
      files.set(`${path}/assets/cover.png`, 'bytes')
    }
    const recentProjects = ref<readonly string[]>(paths)
    const { snapshots } = useRecentProjectSnapshots({ recentProjects, fs: createFileSystem(files) })
    await vi.waitFor(() => expect(snapshots.value.size).toBe(paths.length))

    const withCover = paths.filter(path => snapshots.value.get(recentProjectKey(path))?.cover)
    expect(withCover).toEqual(paths.slice(0, WELCOME_COVER_SOURCE_LIMIT))
  })

  it('reprobes when the recent project list changes', async () => {
    const files = new Map<string, string>([...projectFiles('One', 'cover.png')])
    files.set('/One', '')
    const recentProjects = ref<readonly string[]>(['/One'])
    const { snapshots } = useRecentProjectSnapshots({ recentProjects, fs: createFileSystem(files) })
    await vi.waitFor(() => expect(snapshots.value.size).toBe(1))
    expect(snapshots.value.get(recentProjectKey('/One'))?.cover).not.toBeNull()

    recentProjects.value = []
    await nextTick()
    await vi.waitFor(() => expect(snapshots.value.size).toBe(0))
  })
})
