import { homeDir, join } from '@tauri-apps/api/path'

export const APP_STORAGE_DIRECTORY_NAME = '.opencard'

export async function resolveAppStorageRoot(): Promise<string> {
  return await join(await homeDir(), APP_STORAGE_DIRECTORY_NAME)
}

export async function resolveAppStoragePath(...segments: string[]): Promise<string> {
  return await join(await resolveAppStorageRoot(), ...segments)
}
