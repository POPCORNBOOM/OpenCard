/** Versioned application settings contract and normalization boundary. */
import {
  OC_EDITABLE_THEME_COLOR_KEYS,
  type OcEditableThemeColorKey,
  type OcThemeColorOverrides,
  type OcThemeId,
} from '../../../shared/ui/foundation'

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
  | 'appearance.accentNeighborAngle'
  | 'updates.suppressReleaseNotesAfterUpdate'
  | 'workspace.structureTreeSelectionBehavior'
  | 'workspace.structureTreeScrollToSelection'
  | 'workspace.showSelectionPositionOnMove'
  | 'workspace.showSelectionSizeOnResize'

export interface AppSettings {
  version: typeof APP_SETTINGS_VERSION
  appearance: {
    theme: AppThemePreference
    locale: AppLocale
    glassIntensity: number
    accentNeighborAngle: number
    themeOverrides: Record<OcThemeId, OcThemeColorOverrides>
  }
  shell: {
    sidebarWidth: number
    sidebarCollapsed: boolean
  }
  updates: {
    suppressReleaseNotesAfterUpdate: boolean
  }
  workspace: {
    structureTreeSelectionBehavior: StructureTreeSelectionBehavior
    structureTreeScrollToSelection: boolean
    showSelectionPositionOnMove: boolean
    showSelectionSizeOnResize: boolean
  }
  projectCreation: {
    lastParentPath: string
    recentProjects: string[]
    workspaceStates: Record<string, { expandedDirectories: string[] }>
  }
}

export type SettingsIntent =
  | {
      type: 'setting.preview'
      key: AppSettingKey
      value: unknown
    }
  | {
      type: 'setting.change'
      key: AppSettingKey
      value: unknown
    }
  | {
      type: 'theme-color.preview' | 'theme-color.change' | 'theme-color.cancel'
      themeId: OcThemeId
      token: OcEditableThemeColorKey
      value: string | null
    }
  | { type: 'theme-colors.reset' }
  | {
      type: 'project-workspace.reset'
    }

export const DEFAULT_APP_SETTINGS: Readonly<AppSettings> = Object.freeze({
  version: APP_SETTINGS_VERSION,
  appearance: Object.freeze({
    theme: 'system',
    locale: 'system',
    glassIntensity: 60,
    accentNeighborAngle: -50,
    themeOverrides: Object.freeze({ dark: Object.freeze({}), light: Object.freeze({}) }),
  }),
  shell: Object.freeze({
    sidebarWidth: 292,
    sidebarCollapsed: false,
  }),
  updates: Object.freeze({
    suppressReleaseNotesAfterUpdate: false,
  }),
  workspace: Object.freeze({
    structureTreeSelectionBehavior: 'expand-exclusive',
    structureTreeScrollToSelection: true,
    showSelectionPositionOnMove: true,
    showSelectionSizeOnResize: true,
  }),
  projectCreation: Object.freeze({
    lastParentPath: '',
    recentProjects: [],
    workspaceStates: {},
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

function clampAngle(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_APP_SETTINGS.appearance.accentNeighborAngle
  }
  return Math.min(180, Math.max(-180, Math.round(value)))
}

function normalizeThemeColorOverrides(value: unknown): OcThemeColorOverrides {
  if (!isRecord(value)) return {}
  const result: OcThemeColorOverrides = {}
  for (const token of OC_EDITABLE_THEME_COLOR_KEYS) {
    const color = value[token]
    if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) {
      result[token] = color.toUpperCase()
    }
  }
  return result
}

function normalizeWorkspaceStates(value: unknown): Record<string, { expandedDirectories: string[] }> {
  if (!isRecord(value)) return {}
  const result: Record<string, { expandedDirectories: string[] }> = {}
  for (const [pathInput, state] of Object.entries(value)) {
    if (!isRecord(state) || !Array.isArray(state.expandedDirectories)) continue
    const path = pathInput.trim().replace(/\\/g, '/').replace(/\/+$/, '')
    if (!path) continue
    result[path] = {
      expandedDirectories: state.expandedDirectories
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
        .filter(Boolean),
    }
  }
  return result
}

export function createDefaultAppSettings(): AppSettings {
  return {
    version: APP_SETTINGS_VERSION,
    appearance: {
      ...DEFAULT_APP_SETTINGS.appearance,
      themeOverrides: { dark: {}, light: {} },
    },
    shell: { ...DEFAULT_APP_SETTINGS.shell },
    updates: { ...DEFAULT_APP_SETTINGS.updates },
    workspace: { ...DEFAULT_APP_SETTINGS.workspace },
    projectCreation: {
      ...DEFAULT_APP_SETTINGS.projectCreation,
      recentProjects: [...DEFAULT_APP_SETTINGS.projectCreation.recentProjects],
      workspaceStates: { ...DEFAULT_APP_SETTINGS.projectCreation.workspaceStates },
    },
  }
}

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!isRecord(value) || value.version !== APP_SETTINGS_VERSION) {
    return createDefaultAppSettings()
  }

  const appearance = isRecord(value.appearance) ? value.appearance : {}
  const shell = isRecord(value.shell) ? value.shell : {}
  const updates = isRecord(value.updates) ? value.updates : {}
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
      accentNeighborAngle: clampAngle(appearance.accentNeighborAngle),
      themeOverrides: {
        dark: normalizeThemeColorOverrides(isRecord(appearance.themeOverrides)
          ? appearance.themeOverrides.dark
          : undefined),
        light: normalizeThemeColorOverrides(isRecord(appearance.themeOverrides)
          ? appearance.themeOverrides.light
          : undefined),
      },
    },
    shell: {
      sidebarWidth: clampSidebarWidth(shell.sidebarWidth),
      sidebarCollapsed: typeof shell.sidebarCollapsed === 'boolean'
        ? shell.sidebarCollapsed
        : DEFAULT_APP_SETTINGS.shell.sidebarCollapsed,
    },
    updates: {
      suppressReleaseNotesAfterUpdate: typeof updates.suppressReleaseNotesAfterUpdate === 'boolean'
        ? updates.suppressReleaseNotesAfterUpdate
        : DEFAULT_APP_SETTINGS.updates.suppressReleaseNotesAfterUpdate,
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
      showSelectionPositionOnMove: typeof workspace.showSelectionPositionOnMove === 'boolean'
        ? workspace.showSelectionPositionOnMove
        : DEFAULT_APP_SETTINGS.workspace.showSelectionPositionOnMove,
      showSelectionSizeOnResize: typeof workspace.showSelectionSizeOnResize === 'boolean'
        ? workspace.showSelectionSizeOnResize
        : DEFAULT_APP_SETTINGS.workspace.showSelectionSizeOnResize,
    },
    projectCreation: {
      lastParentPath: typeof projectCreation.lastParentPath === 'string'
        ? projectCreation.lastParentPath
        : DEFAULT_APP_SETTINGS.projectCreation.lastParentPath,
      recentProjects: normalizeRecentProjects(projectCreation.recentProjects),
      workspaceStates: normalizeWorkspaceStates(projectCreation.workspaceStates),
    },
  }
}
