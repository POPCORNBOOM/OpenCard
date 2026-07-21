/** Versioned application settings contract and normalization boundary. */
import type { OcThemeId } from '../../../shared/ui/foundation'

export const APP_SETTINGS_VERSION = 1 as const
export const MIN_SIDEBAR_WIDTH = 220
export const MAX_SIDEBAR_WIDTH = 640
export const MAX_RECENT_PROJECTS = 8

export type AppLocale = 'system' | 'zh-CN' | 'en-US'
export type AppThemePreference = OcThemeId | 'system'
export type StructureTreeSelectionBehavior = 'none' | 'expand' | 'expand-exclusive'
export type SettingsCategoryKey = 'general' | 'appearance' | 'workspace'
export type AppSettingKey =
  | 'appearance.theme'
  | 'appearance.locale'
  | 'appearance.glassIntensity'
  | 'workspace.structureTreeSelectionBehavior'
  | 'workspace.structureTreeScrollToSelection'

export interface AppSettings {
  version: typeof APP_SETTINGS_VERSION
  appearance: {
    theme: AppThemePreference
    locale: AppLocale
    glassIntensity: number
  }
  shell: {
    sidebarWidth: number
    sidebarCollapsed: boolean
  }
  workspace: {
    structureTreeSelectionBehavior: StructureTreeSelectionBehavior
    structureTreeScrollToSelection: boolean
  }
  projectCreation: {
    lastParentPath: string
    recentProjects: string[]
  }
}

export type SettingsIntent =
  | {
      type: 'setting.change'
      key: AppSettingKey
      value: unknown
    }
  | {
      type: 'project-workspace.reset'
    }

export const DEFAULT_APP_SETTINGS: Readonly<AppSettings> = Object.freeze({
  version: APP_SETTINGS_VERSION,
  appearance: Object.freeze({
    theme: 'system',
    locale: 'system',
    glassIntensity: 60,
  }),
  shell: Object.freeze({
    sidebarWidth: 292,
    sidebarCollapsed: false,
  }),
  workspace: Object.freeze({
    structureTreeSelectionBehavior: 'expand-exclusive',
    structureTreeScrollToSelection: true,
  }),
  projectCreation: Object.freeze({
    lastParentPath: '',
    recentProjects: [],
  }),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clampSidebarWidth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_APP_SETTINGS.shell.sidebarWidth
  }
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(value)))
}

function clampPercentage(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(100, Math.max(0, Math.round(value)))
}

function normalizeRecentProjects(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const path = item.trim().replace(/\\/g, '/').replace(/\/+$/, '')
    const identity = path.toLocaleLowerCase()
    if (!path || seen.has(identity)) continue
    seen.add(identity)
    result.push(path)
    if (result.length >= MAX_RECENT_PROJECTS) break
  }
  return result
}

export function createDefaultAppSettings(): AppSettings {
  return {
    version: APP_SETTINGS_VERSION,
    appearance: { ...DEFAULT_APP_SETTINGS.appearance },
    shell: { ...DEFAULT_APP_SETTINGS.shell },
    workspace: { ...DEFAULT_APP_SETTINGS.workspace },
    projectCreation: {
      ...DEFAULT_APP_SETTINGS.projectCreation,
      recentProjects: [...DEFAULT_APP_SETTINGS.projectCreation.recentProjects],
    },
  }
}

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!isRecord(value) || value.version !== APP_SETTINGS_VERSION) {
    return createDefaultAppSettings()
  }

  const appearance = isRecord(value.appearance) ? value.appearance : {}
  const shell = isRecord(value.shell) ? value.shell : {}
  const workspace = isRecord(value.workspace) ? value.workspace : {}
  const projectCreation = isRecord(value.projectCreation) ? value.projectCreation : {}

  return {
    version: APP_SETTINGS_VERSION,
    appearance: {
      theme: appearance.theme === 'system' || appearance.theme === 'light' || appearance.theme === 'dark'
        ? appearance.theme
        : DEFAULT_APP_SETTINGS.appearance.theme,
      locale: appearance.locale === 'system'
        || appearance.locale === 'zh-CN'
        || appearance.locale === 'en-US'
        ? appearance.locale
        : DEFAULT_APP_SETTINGS.appearance.locale,
      glassIntensity: clampPercentage(
        appearance.glassIntensity,
        DEFAULT_APP_SETTINGS.appearance.glassIntensity,
      ),
    },
    shell: {
      sidebarWidth: clampSidebarWidth(shell.sidebarWidth),
      sidebarCollapsed: typeof shell.sidebarCollapsed === 'boolean'
        ? shell.sidebarCollapsed
        : DEFAULT_APP_SETTINGS.shell.sidebarCollapsed,
    },
    workspace: {
      structureTreeSelectionBehavior: workspace.structureTreeSelectionBehavior === 'none'
        || workspace.structureTreeSelectionBehavior === 'expand'
        || workspace.structureTreeSelectionBehavior === 'expand-exclusive'
        ? workspace.structureTreeSelectionBehavior
        : DEFAULT_APP_SETTINGS.workspace.structureTreeSelectionBehavior,
      structureTreeScrollToSelection: typeof workspace.structureTreeScrollToSelection === 'boolean'
        ? workspace.structureTreeScrollToSelection
        : DEFAULT_APP_SETTINGS.workspace.structureTreeScrollToSelection,
    },
    projectCreation: {
      lastParentPath: typeof projectCreation.lastParentPath === 'string'
        ? projectCreation.lastParentPath
        : DEFAULT_APP_SETTINGS.projectCreation.lastParentPath,
      recentProjects: normalizeRecentProjects(projectCreation.recentProjects),
    },
  }
}
