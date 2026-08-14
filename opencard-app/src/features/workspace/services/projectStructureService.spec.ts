import { describe, expect, it, vi } from 'vitest'
import type { FileSystemService } from './fileSystemService'
import {
  classifyProjectDirectory,
  ensureProjectStructure,
  initializeProjectStructure,
} from './projectStructureService'

function createFileSystem(initial: Record<string, 'file' | 'directory' | 'symlink'> = {}) {
  const entries = new Map(Object.entries(initial))
  const writes = new Map<string, string>()
  const fs = {
    fileExists: vi.fn(async (path: string) => entries.has(path)),
    getFileInfo: vi.fn(async (path: string) => {
      const kind = entries.get(path)
      if (!kind) throw new Error(`Missing: ${path}`)
      return { isFile: kind === 'file', isDirectory: kind === 'directory', isSymlink: kind === 'symlink' }
    }),
    createDirectory: vi.fn(async (path: string) => { entries.set(path, 'directory') }),
    writeFile: vi.fn(async (path: string, content: string) => {
      entries.set(path, 'file')
      writes.set(path, content)
    }),
    renameFile: vi.fn(async (source: string, target: string) => {
      const moved = [...entries].filter(([path]) => path === source || path.startsWith(`${source}/`))
      for (const [path] of moved) entries.delete(path)
      for (const [path, kind] of moved) entries.set(`${target}${path.slice(source.length)}`, kind)
    }),
    deleteFile: vi.fn(async (path: string) => {
      for (const key of [...entries.keys()]) {
        if (key === path || key.startsWith(`${path}/`)) entries.delete(key)
      }
    }),
  } as unknown as FileSystemService
  return { fs, entries, writes }
}

describe('projectStructureService', () => {
  it('distinguishes current, legacy, ordinary, and unsafe project directories', async () => {
    expect(await classifyProjectDirectory(createFileSystem({
      'D:/Cards/.opencard': 'directory',
      'D:/Cards/.opencard/.ocproject': 'file',
    }).fs, 'D:/Cards')).toBe('project')
    expect(await classifyProjectDirectory(createFileSystem({
      'D:/Cards/.ocproject': 'file',
    }).fs, 'D:/Cards')).toBe('legacy')
    expect(await classifyProjectDirectory(createFileSystem().fs, 'D:/Cards')).toBe('uninitialized')
    expect(await classifyProjectDirectory(createFileSystem({
      'D:/Cards/.opencard': 'symlink',
    }).fs, 'D:/Cards')).toBe('invalid')
  })

  it('builds a complete project internally and commits it with one rename', async () => {
    const { fs, entries, writes } = createFileSystem()
    await initializeProjectStructure(fs, 'D:/Cards', () => 'test')

    expect(fs.renameFile).toHaveBeenCalledWith('D:/Cards/.opencard-init-test', 'D:/Cards/.opencard')
    expect(entries.get('D:/Cards/.opencard/fonts')).toBe('directory')
    expect(entries.get('D:/Cards/.opencard/icons')).toBe('directory')
    expect(entries.get('D:/Cards/.opencard/blocks')).toBe('directory')
    expect(entries.get('D:/Cards/.opencard/.ocproject')).toBe('file')
    expect(writes.get('D:/Cards/.opencard-init-test/.ocblocks')).toContain('"blocks": []')
  })

  it('repairs missing managed entries without overwriting existing files', async () => {
    const { fs, entries } = createFileSystem({
      'D:/Cards/.opencard': 'directory',
      'D:/Cards/.opencard/.ocproject': 'file',
    })
    await ensureProjectStructure(fs, 'D:/Cards')

    expect(entries.get('D:/Cards/.opencard/.ocfonts')).toBe('file')
    expect(entries.get('D:/Cards/.opencard/fonts')).toBe('directory')
    expect(fs.writeFile).not.toHaveBeenCalledWith('D:/Cards/.opencard/.ocproject', expect.anything())
  })

  it('rejects legacy roots and unsafe managed paths without writing', async () => {
    const legacy = createFileSystem({ 'D:/Cards/.ocfonts': 'file' })
    await expect(initializeProjectStructure(legacy.fs, 'D:/Cards')).rejects.toThrow('Legacy')
    expect(legacy.fs.createDirectory).not.toHaveBeenCalled()

    const unsafe = createFileSystem({ 'D:/Cards/.opencard': 'symlink' })
    await expect(initializeProjectStructure(unsafe.fs, 'D:/Cards')).rejects.toThrow('safe directory')
    expect(unsafe.fs.createDirectory).not.toHaveBeenCalled()
  })

  it('cleans up the temporary directory when initial creation fails', async () => {
    const { fs, entries } = createFileSystem()
    vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('disk full'))
    await expect(initializeProjectStructure(fs, 'D:/Cards', () => 'failed')).rejects.toThrow('disk full')
    expect(fs.deleteFile).toHaveBeenCalledWith('D:/Cards/.opencard-init-failed')
    expect(entries.has('D:/Cards/.opencard-init-failed')).toBe(false)
    expect(entries.has('D:/Cards/.opencard')).toBe(false)
  })
})
