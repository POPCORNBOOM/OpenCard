import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }))
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readDir: vi.fn(),
  mkdir: vi.fn(),
  remove: vi.fn(),
  rename: vi.fn(),
  copyFile: vi.fn(),
  exists: vi.fn(),
  lstat: vi.fn(),
}))

import { fileSystemService } from './fileSystemService'

describe('fileSystemService native file actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.invoke.mockResolvedValue(undefined)
  })

  it('issues an independent reveal command for every click', async () => {
    await Promise.all([
      fileSystemService.revealInFileManager('D:/cards/a.opencard'),
      fileSystemService.revealInFileManager('D:/cards/a.opencard'),
      fileSystemService.revealInFileManager('D:/cards/a.opencard'),
    ])

    expect(mocks.invoke).toHaveBeenCalledTimes(3)
    expect(mocks.invoke).toHaveBeenNthCalledWith(1, 'reveal_path', { path: 'D:/cards/a.opencard' })
  })

  it('uses trash_path for user deletion and propagates failure', async () => {
    mocks.invoke.mockRejectedValueOnce(new Error('trash unavailable'))
    await expect(fileSystemService.trashFile('D:/cards/a.opencard')).rejects.toThrow('trash unavailable')
    expect(mocks.invoke).toHaveBeenCalledWith('trash_path', { path: 'D:/cards/a.opencard' })
  })

  it('uses the native default-app command instead of the reveal command', async () => {
    await fileSystemService.openWithDefaultApp('D:/cards/reference.bin')

    expect(mocks.invoke).toHaveBeenCalledWith('open_path', { path: 'D:/cards/reference.bin' })
    expect(mocks.invoke).not.toHaveBeenCalledWith('reveal_path', expect.anything())
  })
})
