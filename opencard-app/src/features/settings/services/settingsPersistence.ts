/** Persistence adapters for the single versioned application settings document. */
import { isTauri } from '@tauri-apps/api/core'
import { LazyStore } from '@tauri-apps/plugin-store'
import { createDefaultAppSettings, type AppSettings } from '../model/appSettings'

const SETTINGS_FILE_NAME = 'settings.json'
const SETTINGS_DOCUMENT_KEY = 'app-settings'
const SETTINGS_AUTO_SAVE_DELAY_MS = 250

export interface SettingsPersistence {
  load(): Promise<unknown>
  save(settings: AppSettings): Promise<void>
  flush(): Promise<void>
}

export class MemorySettingsPersistence implements SettingsPersistence {
  private value: unknown

  constructor(initialValue?: unknown) {
    this.value = initialValue
  }

  async load(): Promise<unknown> {
    return this.value
  }

  async save(settings: AppSettings): Promise<void> {
    this.value = structuredClone(settings)
  }

  async flush(): Promise<void> {}
}

class TauriSettingsPersistence implements SettingsPersistence {
  private readonly store = new LazyStore(SETTINGS_FILE_NAME, {
    defaults: {
      [SETTINGS_DOCUMENT_KEY]: createDefaultAppSettings(),
    },
    autoSave: SETTINGS_AUTO_SAVE_DELAY_MS,
  })

  async load(): Promise<unknown> {
    return await this.store.get(SETTINGS_DOCUMENT_KEY)
  }

  async save(settings: AppSettings): Promise<void> {
    await this.store.set(SETTINGS_DOCUMENT_KEY, settings)
  }

  async flush(): Promise<void> {
    await this.store.save()
  }
}

export function createSettingsPersistence(): SettingsPersistence {
  return isTauri()
    ? new TauriSettingsPersistence()
    : new MemorySettingsPersistence()
}
