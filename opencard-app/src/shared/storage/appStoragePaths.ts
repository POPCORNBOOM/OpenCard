import { homeDir, join } from '@tauri-apps/api/path'

export const APP_STORAGE_DIRECTORY_NAME = '.opencard'
export const APP_DOWNLOADS_DIRECTORY_NAME = 'downloads'

export async function resolveAppStorageRoot(): Promise<string> {
  return await join(await homeDir(), APP_STORAGE_DIRECTORY_NAME)
}

export async function resolveAppStoragePath(...segments: string[]): Promise<string> {
  return await join(await resolveAppStorageRoot(), ...segments)
}

/** 远程包下载的临时目录位于应用数据目录下，不进入项目目录。 */
export async function resolveAppDownloadPath(...segments: string[]): Promise<string> {
  return await resolveAppStoragePath(APP_DOWNLOADS_DIRECTORY_NAME, ...segments)
}
