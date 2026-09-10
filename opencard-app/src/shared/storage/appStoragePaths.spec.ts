import { beforeEach, describe, expect, it, vi } from 'vitest'
import { homeDir, join } from '@tauri-apps/api/path'
import {
  APP_DOWNLOADS_DIRECTORY_NAME,
  APP_STORAGE_DIRECTORY_NAME,
  resolveAppDownloadPath,
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

  it('keeps temporary package downloads inside the application data directory', async () => {
    expect(APP_DOWNLOADS_DIRECTORY_NAME).toBe('downloads')
    await expect(resolveAppDownloadPath('pkg-1.0.0.zip')).resolves.toBe(
      'C:/Users/Test/.opencard/downloads/pkg-1.0.0.zip',
    )
  })
})
