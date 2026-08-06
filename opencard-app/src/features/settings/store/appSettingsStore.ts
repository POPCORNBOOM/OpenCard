/** Global application settings truth with serialized persistence writes. */
import { readonly, ref, type DeepReadonly, type Ref } from 'vue'
import type { OcEditableThemeColorKey, OcThemeId } from '../../../shared/ui/foundation'
import {
  DEFAULT_APP_SETTINGS,
  createDefaultAppSettings,
  getThemePreset,
  normalizeAppSettings,
  type AppThemeDefinition,
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
  previewSetting(key: AppSettingKey, value: unknown): void
  updateSetting(key: AppSettingKey, value: unknown): void
  previewThemeColor(themeId: OcThemeId, token: OcEditableThemeColorKey, value: string | null): void
  updateThemeColor(themeId: OcThemeId, token: OcEditableThemeColorKey, value: string | null): void
  previewThemeAngle(themeId: OcThemeId, value: number): void
  updateThemeAngle(themeId: OcThemeId, value: number): void
  updateThemeFont(themeId: OcThemeId, value: string): void
  applyThemePreset(themeId: OcThemeId, presetId: string): void
  importThemePreset(themeId: OcThemeId, name: string, definition: AppThemeDefinition): void
  deleteThemePreset(themeId: OcThemeId, presetId: string): void
  resetThemes(): void
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

  function applySetting(candidate: AppSettings, key: AppSettingKey, value: unknown): void {
    if (key === 'appearance.theme') candidate.appearance.theme = value as AppSettings['appearance']['theme']
    else if (key === 'appearance.locale') candidate.appearance.locale = value as AppSettings['appearance']['locale']
    else if (key === 'appearance.glassIntensity') candidate.appearance.glassIntensity = value as number
    else if (key === 'appearance.baseFontSize') candidate.appearance.baseFontSize = value as number
    else if (key === 'updates.suppressReleaseNotesAfterUpdate') {
      candidate.updates.suppressReleaseNotesAfterUpdate = value as boolean
    } else if (key === 'workspace.structureTreeSelectionBehavior') {
      candidate.workspace.structureTreeSelectionBehavior = value as AppSettings['workspace']['structureTreeSelectionBehavior']
    } else if (key === 'workspace.structureTreeScrollToSelection') {
      candidate.workspace.structureTreeScrollToSelection = value as boolean
    } else if (key === 'workspace.showSelectionPositionOnMove') {
      candidate.workspace.showSelectionPositionOnMove = value as boolean
    } else if (key === 'workspace.showSelectionSizeOnResize') {
      candidate.workspace.showSelectionSizeOnResize = value as boolean
    } else if (key === 'workspace.alignmentSnappingEnabledByDefault') {
      candidate.workspace.alignmentSnappingEnabledByDefault = value as boolean
    } else if (key === 'workspace.defaultFontImportDirectory') {
      candidate.workspace.defaultFontImportDirectory = String(value)
    } else if (key === 'workspace.defaultIconImportDirectory') {
      candidate.workspace.defaultIconImportDirectory = String(value)
    }
  }

  function previewSetting(key: AppSettingKey, value: unknown): void {
    const candidate = normalizeAppSettings(settings.value)
    applySetting(candidate, key, value)
    settings.value = normalizeAppSettings(candidate)
  }

  function updateSetting(key: AppSettingKey, value: unknown): void {
    const candidate = normalizeAppSettings(settings.value)
    applySetting(candidate, key, value)
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
    const workspaceStates = { ...settings.value.projectCreation.workspaceStates }
    const workspaceKey = Object.keys(workspaceStates).find((item) => item.toLocaleLowerCase() === identity)
    if (workspaceKey) delete workspaceStates[workspaceKey]
    if (recentProjects.length === settings.value.projectCreation.recentProjects.length && !workspaceKey) return
    updateProjectCreation({ recentProjects, workspaceStates })
  }

  function applyThemeColor(
    candidate: AppSettings,
    themeId: OcThemeId,
    token: OcEditableThemeColorKey,
    value: string | null,
  ): void {
    const overrides = { ...candidate.appearance.themeOverrides[themeId] }
    if (value === null) delete overrides[token]
    else overrides[token] = value
    candidate.appearance.themeOverrides[themeId] = overrides
  }

  function previewThemeColor(
    themeId: OcThemeId,
    token: OcEditableThemeColorKey,
    value: string | null,
  ): void {
    const candidate = normalizeAppSettings(settings.value)
    applyThemeColor(candidate, themeId, token, value)
    settings.value = normalizeAppSettings(candidate)
  }

  function updateThemeColor(
    themeId: OcThemeId,
    token: OcEditableThemeColorKey,
    value: string | null,
  ): void {
    const candidate = normalizeAppSettings(settings.value)
    applyThemeColor(candidate, themeId, token, value)
    commit(candidate)
  }

  function applyThemeAngle(candidate: AppSettings, themeId: OcThemeId, value: number): void {
    candidate.appearance.accentNeighborAngles[themeId] = value
  }

  function previewThemeAngle(themeId: OcThemeId, value: number): void {
    const candidate = normalizeAppSettings(settings.value)
    applyThemeAngle(candidate, themeId, value)
    settings.value = normalizeAppSettings(candidate)
  }

  function updateThemeAngle(themeId: OcThemeId, value: number): void {
    const candidate = normalizeAppSettings(settings.value)
    applyThemeAngle(candidate, themeId, value)
    commit(candidate)
  }

  function updateThemeFont(themeId: OcThemeId, value: string): void {
    const candidate = normalizeAppSettings(settings.value)
    candidate.appearance.fontFamilies[themeId] = value
    commit(candidate)
  }

  function applyThemePreset(themeId: OcThemeId, presetId: string): void {
    const preset = getThemePreset(themeId, presetId, settings.value.appearance.userThemePresets[themeId])
    if (!preset) return
    const candidate = normalizeAppSettings(settings.value)
    candidate.appearance.themeOverrides[themeId] = presetId === 'default' ? {} : { ...preset.colors }
    candidate.appearance.accentNeighborAngles[themeId] = preset.accentNeighborAngle
    candidate.appearance.fontFamilies[themeId] = preset.fontFamily
    commit(candidate)
  }

  function importThemePreset(themeId: OcThemeId, name: string, definition: AppThemeDefinition): void {
    const candidate = normalizeAppSettings(settings.value)
    const presets = candidate.appearance.userThemePresets[themeId].filter(preset => (
      preset.name.toLocaleLowerCase() !== name.trim().toLocaleLowerCase()
    ))
    candidate.appearance.userThemePresets[themeId] = [
      ...presets.slice(-31),
      { name: name.trim(), definition },
    ]
    candidate.appearance.themeOverrides[themeId] = { ...definition.colors }
    candidate.appearance.accentNeighborAngles[themeId] = definition.accentNeighborAngle
    candidate.appearance.fontFamilies[themeId] = definition.fontFamily
    commit(candidate)
  }

  function deleteThemePreset(themeId: OcThemeId, presetId: string): void {
    if (!presetId.startsWith('user:')) return
    const name = presetId.slice('user:'.length)
    const candidate = normalizeAppSettings(settings.value)
    candidate.appearance.userThemePresets[themeId] = candidate.appearance.userThemePresets[themeId]
      .filter(preset => preset.name !== name)
    commit(candidate)
  }

  function resetThemes(): void {
    const candidate = normalizeAppSettings(settings.value)
    candidate.appearance.themeOverrides = { dark: {}, light: {} }
    candidate.appearance.accentNeighborAngles = { ...DEFAULT_APP_SETTINGS.appearance.accentNeighborAngles }
    candidate.appearance.fontFamilies = { ...DEFAULT_APP_SETTINGS.appearance.fontFamilies }
    commit(candidate)
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
    previewSetting,
    updateSetting,
    previewThemeColor,
    updateThemeColor,
    previewThemeAngle,
    updateThemeAngle,
    updateThemeFont,
    applyThemePreset,
    importThemePreset,
    deleteThemePreset,
    resetThemes,
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
