import { beforeEach, describe, expect, it, vi } from 'vitest'
import { homeDir, join } from '@tauri-apps/api/path'
import {
  APP_STORAGE_DIRECTORY_NAME,
  resolveAppStoragePath,
  resolveAppStorageRoot,
} from './appStoragePaths'

vi.mock('@tauri-apps/api/path', () => ({
  homeDir: vi.fn(),
  join: vi.fn(),
}))

describe('appStoragePaths', () => {
  beforeEach(() => {
    vi.mocked(homeDir).mockResolvedValue('C:/Users/Test')
    vi.mocked(join).mockImplementation(async (...segments) => segments.join('/'))
  })

  it('resolves application data below the user home directory', async () => {
    expect(APP_STORAGE_DIRECTORY_NAME).toBe('.opencard')
    await expect(resolveAppStorageRoot()).resolves.toBe('C:/Users/Test/.opencard')
    await expect(resolveAppStoragePath('templates', 'sample')).resolves.toBe(
      'C:/Users/Test/.opencard/templates/sample',
    )
  })
})
