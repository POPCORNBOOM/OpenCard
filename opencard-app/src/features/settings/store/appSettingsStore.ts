/** Global application settings truth with serialized persistence writes. */
import { readonly, ref, type DeepReadonly, type Ref } from 'vue'
import {
  createDefaultAppSettings,
  normalizeAppSettings,
  type AppSettingKey,
  type AppSettings,
} from '../model/appSettings'
import {
  createSettingsPersistence,
  type SettingsPersistence,
} from '../services/settingsPersistence'

type SettingsSection = keyof Pick<AppSettings, 'appearance' | 'shell' | 'workspace'>

export interface AppSettingsStore {
  settings: Readonly<Ref<DeepReadonly<AppSettings>>>
  isReady: Readonly<Ref<boolean>>
  error: Readonly<Ref<string | null>>
  initialize(): Promise<void>
  updateSetting(key: AppSettingKey, value: unknown): void
  updateShell(patch: Partial<AppSettings['shell']>): void
  updateProjectCreation(patch: Partial<AppSettings['projectCreation']>): void
  rememberRecentProject(path: string): void
  forgetRecentProject(path: string): void
  resetSection(section: SettingsSection): void
  resetAll(): void
  flush(): Promise<void>
}

function describeError(value: unknown): string {
  return value instanceof Error ? value.message : String(value)
}

export function createAppSettingsStore(
  persistence: SettingsPersistence = createSettingsPersistence(),
): AppSettingsStore {
  const settings = ref<AppSettings>(createDefaultAppSettings())
  const isReady = ref(false)
  const error = ref<string | null>(null)
  let initializePromise: Promise<void> | null = null
  let writeQueue = Promise.resolve()

  function queueSave(): void {
    const snapshot = normalizeAppSettings(settings.value)
    writeQueue = writeQueue
      .catch(() => undefined)
      .then(async () => {
        try {
          await persistence.save(snapshot)
          error.value = null
        } catch (cause) {
          error.value = describeError(cause)
          throw cause
        }
      })
    void writeQueue.catch(() => undefined)
  }

  async function initialize(): Promise<void> {
    if (initializePromise) return await initializePromise

    initializePromise = (async () => {
      try {
        const storedValue = await persistence.load()
        const normalized = normalizeAppSettings(storedValue)
        settings.value = normalized
        error.value = null

        if (JSON.stringify(storedValue) !== JSON.stringify(normalized)) {
          queueSave()
          await writeQueue
        }
      } catch (cause) {
        settings.value = createDefaultAppSettings()
        error.value = describeError(cause)
      } finally {
        isReady.value = true
      }
    })()

    await initializePromise
  }

  function commit(candidate: AppSettings): void {
    settings.value = normalizeAppSettings(candidate)
    queueSave()
  }

  function updateSetting(key: AppSettingKey, value: unknown): void {
    const candidate = normalizeAppSettings(settings.value)
    if (key === 'appearance.theme') candidate.appearance.theme = value as AppSettings['appearance']['theme']
    else if (key === 'appearance.locale') candidate.appearance.locale = value as AppSettings['appearance']['locale']
    else if (key === 'appearance.glassIntensity') candidate.appearance.glassIntensity = value as number
    else if (key === 'shell.sidebarCollapsed') candidate.shell.sidebarCollapsed = value as boolean
    else if (key === 'workspace.structureTreeSelectionBehavior') {
      candidate.workspace.structureTreeSelectionBehavior = value as AppSettings['workspace']['structureTreeSelectionBehavior']
    } else if (key === 'workspace.structureTreeScrollToSelection') {
      candidate.workspace.structureTreeScrollToSelection = value as boolean
    }
    commit(candidate)
  }

  function updateShell(patch: Partial<AppSettings['shell']>): void {
    commit({
      ...normalizeAppSettings(settings.value),
      shell: {
        ...settings.value.shell,
        ...patch,
      },
    })
  }

  function updateProjectCreation(patch: Partial<AppSettings['projectCreation']>): void {
    commit({
      ...normalizeAppSettings(settings.value),
      projectCreation: {
        ...settings.value.projectCreation,
        ...patch,
      },
    })
  }

  function rememberRecentProject(path: string): void {
    const normalizedPath = path.trim().replace(/\\/g, '/').replace(/\/+$/, '')
    if (!normalizedPath) return
    const identity = normalizedPath.toLocaleLowerCase()
    updateProjectCreation({
      recentProjects: [
        normalizedPath,
        ...settings.value.projectCreation.recentProjects.filter((item) => (
          item.toLocaleLowerCase() !== identity
        )),
      ],
    })
  }

  function forgetRecentProject(path: string): void {
    const normalizedPath = path.trim().replace(/\\/g, '/').replace(/\/+$/, '')
    if (!normalizedPath) return
    const identity = normalizedPath.toLocaleLowerCase()
    const recentProjects = settings.value.projectCreation.recentProjects.filter((item) => (
      item.toLocaleLowerCase() !== identity
    ))
    if (recentProjects.length === settings.value.projectCreation.recentProjects.length) return
    updateProjectCreation({ recentProjects })
  }

  function resetSection(section: SettingsSection): void {
    const defaults = createDefaultAppSettings()
    commit({
      ...normalizeAppSettings(settings.value),
      [section]: defaults[section],
    })
  }

  function resetAll(): void {
    commit(createDefaultAppSettings())
  }

  async function flush(): Promise<void> {
    await writeQueue
    await persistence.flush()
  }

  return {
    settings: readonly(settings),
    isReady: readonly(isReady),
    error: readonly(error),
    initialize,
    updateSetting,
    updateShell,
    updateProjectCreation,
    rememberRecentProject,
    forgetRecentProject,
    resetSection,
    resetAll,
    flush,
  }
}

const appSettingsStore = createAppSettingsStore()

export function useAppSettingsStore(): AppSettingsStore {
  return appSettingsStore
}
