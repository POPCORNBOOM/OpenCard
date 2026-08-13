/** Versioned application settings contract and normalization boundary. */
import {
  OC_EDITABLE_THEME_COLOR_KEYS,
  OC_THEME_REGISTRY,
  type OcEditableThemeColorKey,
  type OcThemeColorOverrides,
  type OcThemeId,
} from '../../../shared/ui/foundation'
import {
  DEFAULT_PROJECT_FONT_DIRECTORY,
  normalizeProjectFontDirectory,
} from '../../workspace/model/projectFonts'
import {
  DEFAULT_PROJECT_ICON_DIRECTORY,
  normalizeProjectIconDirectory,
} from '../../workspace/model/projectIcons'

export const APP_SETTINGS_VERSION = 1 as const
export const APP_THEME_FILE_EXTENSION = 'octheme'
export const APP_THEME_FILE_SUFFIX = `.${APP_THEME_FILE_EXTENSION}`
export const MIN_SIDEBAR_WIDTH = 220
export const MAX_SIDEBAR_WIDTH = 640
export const MAX_RECENT_PROJECTS = 8
export const DEFAULT_ACCENT_NEIGHBOR_ANGLE = -50
export const MIN_BASE_FONT_SIZE = 10
export const MAX_BASE_FONT_SIZE = 16

export type AppLocale = 'system' | 'zh-CN' | 'en-US'
export type AppThemePreference = OcThemeId | 'system'
export type StructureTreeSelectionBehavior = 'none' | 'expand' | 'expand-exclusive'
export type SettingsCategoryKey = 'general' | 'appearance' | 'workspace'
export type AppThemePresetId =
  | 'default'
  | 'grass-block'
  | 'deep-sea'
  | 'ember'
  | 'ink-bamboo'
  | 'morning-mist'
  | 'sakura-paper'
  | 'dune'
  | 'mint'
export type AppThemeDefinition = {
  colors: Required<OcThemeColorOverrides>
  accentNeighborAngle: number
  fontFamily: string
}
export type ProjectWorkspaceState = {
  expandedDirectories: string[]
  projectProfile?: {
    collapsedSections: string[]
  }
}
export type AppUserThemePreset = {
  name: string
  definition: AppThemeDefinition
}

export const APP_THEME_PRESETS: Readonly<Record<OcThemeId, readonly AppThemePresetId[]>> = {
  dark: ['default', 'grass-block', 'deep-sea', 'ember', 'ink-bamboo'],
  light: ['default', 'morning-mist', 'sakura-paper', 'dune', 'mint'],
}

const BUILTIN_THEME_DEFINITIONS: Partial<Record<AppThemePresetId, AppThemeDefinition>> = {
  'grass-block': {
    colors: { '--oc-accent': '#75FF53', '--oc-bg-base': '#34251A', '--oc-fg-default': '#CCCCCC' },
    accentNeighborAngle: -50,
    fontFamily: 'system',
  },
  'deep-sea': {
    colors: { '--oc-accent': '#4CC9F0', '--oc-bg-base': '#071A2B', '--oc-fg-default': '#D9EDF7' },
    accentNeighborAngle: -40,
    fontFamily: 'system',
  },
  ember: {
    colors: { '--oc-accent': '#FF7A45', '--oc-bg-base': '#241713', '--oc-fg-default': '#E8D8D0' },
    accentNeighborAngle: 35,
    fontFamily: 'system',
  },
  'ink-bamboo': {
    colors: { '--oc-accent': '#78C091', '--oc-bg-base': '#101A16', '--oc-fg-default': '#D5E2DA' },
    accentNeighborAngle: -110,
    fontFamily: 'system',
  },
  'morning-mist': {
    colors: { '--oc-accent': '#5B7CFA', '--oc-bg-base': '#F2F5FB', '--oc-fg-default': '#283044' },
    accentNeighborAngle: -35,
    fontFamily: 'system',
  },
  'sakura-paper': {
    colors: { '--oc-accent': '#E56B9F', '--oc-bg-base': '#FFF6FA', '--oc-fg-default': '#3D2933' },
    accentNeighborAngle: 40,
    fontFamily: 'system',
  },
  dune: {
    colors: { '--oc-accent': '#C7822F', '--oc-bg-base': '#FFF8E9', '--oc-fg-default': '#3B3022' },
    accentNeighborAngle: -45,
    fontFamily: 'system',
  },
  mint: {
    colors: { '--oc-accent': '#2AAE88', '--oc-bg-base': '#F1FBF7', '--oc-fg-default': '#203A33' },
    accentNeighborAngle: 45,
    fontFamily: 'system',
  },
}
export type AppSettingKey =
  | 'appearance.theme'
  | 'appearance.locale'
  | 'appearance.glassIntensity'
  | 'appearance.baseFontSize'
  | 'updates.suppressReleaseNotesAfterUpdate'
  | 'workspace.structureTreeSelectionBehavior'
  | 'workspace.structureTreeScrollToSelection'
  | 'workspace.showSelectionPositionOnMove'
  | 'workspace.showSelectionSizeOnResize'
  | 'workspace.alignmentSnappingEnabledByDefault'
  | 'workspace.defaultFontImportDirectory'
  | 'workspace.defaultIconImportDirectory'
  | 'workspace.historyEntryLimit'

export interface AppSettings {
  version: typeof APP_SETTINGS_VERSION
  appearance: {
    theme: AppThemePreference
    locale: AppLocale
    glassIntensity: number
    baseFontSize: number
    themeOverrides: Record<OcThemeId, OcThemeColorOverrides>
    accentNeighborAngles: Record<OcThemeId, number>
    fontFamilies: Record<OcThemeId, string>
    userThemePresets: Record<OcThemeId, AppUserThemePreset[]>
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
    alignmentSnappingEnabledByDefault: boolean
    defaultFontImportDirectory: string
    defaultIconImportDirectory: string
    historyEntryLimit: number
  }
  projectCreation: {
    lastParentPath: string
    recentProjects: string[]
    workspaceStates: Record<string, ProjectWorkspaceState>
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
  | {
      type: 'theme-angle.preview' | 'theme-angle.change'
      themeId: OcThemeId
      value: number
    }
  | {
      type: 'theme-preset.change'
      themeId: OcThemeId
      presetId: string
    }
  | { type: 'theme-preset.delete'; themeId: OcThemeId; presetId: string }
  | { type: 'theme-font.change'; themeId: OcThemeId; value: string }
  | { type: 'theme.import' | 'theme.export'; themeId: OcThemeId }
  | { type: 'themes.reset' }
  | {
      type: 'project-workspace.reset'
    }

export const DEFAULT_APP_SETTINGS: Readonly<AppSettings> = Object.freeze({
  version: APP_SETTINGS_VERSION,
  appearance: Object.freeze({
    theme: 'system',
    locale: 'system',
    glassIntensity: 60,
    baseFontSize: 12,
    themeOverrides: Object.freeze({ dark: Object.freeze({}), light: Object.freeze({}) }),
    accentNeighborAngles: Object.freeze({
      dark: DEFAULT_ACCENT_NEIGHBOR_ANGLE,
      light: DEFAULT_ACCENT_NEIGHBOR_ANGLE,
    }),
    fontFamilies: Object.freeze({ dark: 'system', light: 'system' }),
    userThemePresets: { dark: [], light: [] },
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
    alignmentSnappingEnabledByDefault: true,
    defaultFontImportDirectory: DEFAULT_PROJECT_FONT_DIRECTORY,
    defaultIconImportDirectory: DEFAULT_PROJECT_ICON_DIRECTORY,
    historyEntryLimit: 100,
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

function clampHistoryEntryLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_APP_SETTINGS.workspace.historyEntryLimit
  return Math.min(1000, Math.max(10, Math.round(value / 10) * 10))
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

function clampBaseFontSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_APP_SETTINGS.appearance.baseFontSize
  }
  return Math.min(MAX_BASE_FONT_SIZE, Math.max(MIN_BASE_FONT_SIZE, Math.round(value)))
}

function parseUiFontFamilies(value: unknown): string[] | null {
  if (value === 'system') return []
  if (typeof value !== 'string' || /[\u0000-\u001F\u007F]/.test(value)) return null
  const families = value.split(';').map(item => item.trim()).filter(Boolean)
  if (families.length === 0 || families.length > 8 || families.some(item => item.length > 128)) return null
  const seen = new Set<string>()
  return families.filter((family) => {
    const identity = family.toLocaleLowerCase()
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

function normalizeUiFontFamily(value: unknown): string {
  const families = parseUiFontFamilies(value)
  return families?.length ? families.join('; ') : 'system'
}

function clampAngle(value: unknown, fallback = DEFAULT_ACCENT_NEIGHBOR_ANGLE): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
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

export function getThemePreset(
  themeId: OcThemeId,
  presetId: string,
  userPresets: readonly AppUserThemePreset[] = [],
): AppThemeDefinition | null {
  if (presetId.startsWith('user:')) {
    return userPresets.find(preset => `user:${preset.name}` === presetId)?.definition ?? null
  }
  if (!APP_THEME_PRESETS[themeId].includes(presetId as AppThemePresetId)) return null
  if (presetId === 'default') return {
    colors: {
      '--oc-accent': OC_THEME_REGISTRY[themeId]['--oc-accent'],
      '--oc-bg-base': OC_THEME_REGISTRY[themeId]['--oc-bg-base'],
      '--oc-fg-default': OC_THEME_REGISTRY[themeId]['--oc-fg-default'],
    },
    accentNeighborAngle: DEFAULT_ACCENT_NEIGHBOR_ANGLE,
    fontFamily: 'system',
  }
  return BUILTIN_THEME_DEFINITIONS[presetId as AppThemePresetId] ?? null
}

export function resolveThemePresetId(
  themeId: OcThemeId,
  overrides: OcThemeColorOverrides,
  accentNeighborAngle: number,
  fontFamily: string,
  userPresets: readonly AppUserThemePreset[] = [],
): string {
  for (const presetId of APP_THEME_PRESETS[themeId]) {
    const preset = getThemePreset(themeId, presetId)!
    const matchesColors = OC_EDITABLE_THEME_COLOR_KEYS.every(token => (
      (overrides[token] ?? OC_THEME_REGISTRY[themeId][token]) === preset.colors[token]
    ))
    if (matchesColors
      && accentNeighborAngle === preset.accentNeighborAngle
      && fontFamily === preset.fontFamily) return presetId
  }
  for (const preset of userPresets) {
    const matchesColors = OC_EDITABLE_THEME_COLOR_KEYS.every(token => (
      (overrides[token] ?? OC_THEME_REGISTRY[themeId][token]) === preset.definition.colors[token]
    ))
    if (matchesColors
      && accentNeighborAngle === preset.definition.accentNeighborAngle
      && fontFamily === preset.definition.fontFamily) return `user:${preset.name}`
  }
  return ''
}

export function serializeAppTheme(
  themeId: OcThemeId,
  overrides: OcThemeColorOverrides,
  accentNeighborAngle: number,
  fontFamily: string,
): string {
  return `${JSON.stringify({
    format: 'opencard-theme',
    version: 1,
    colors: {
      accent: overrides['--oc-accent'] ?? OC_THEME_REGISTRY[themeId]['--oc-accent'],
      background: overrides['--oc-bg-base'] ?? OC_THEME_REGISTRY[themeId]['--oc-bg-base'],
      foreground: overrides['--oc-fg-default'] ?? OC_THEME_REGISTRY[themeId]['--oc-fg-default'],
    },
    accentNeighborAngle,
    fontFamily,
  }, null, 2)}\n`
}

export function parseAppTheme(content: string): AppThemeDefinition | null {
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch {
    return null
  }
  if (!isRecord(value) || value.format !== 'opencard-theme' || value.version !== 1) return null
  if (!isRecord(value.colors)) return null
  const colors = {
    '--oc-accent': value.colors.accent,
    '--oc-bg-base': value.colors.background,
    '--oc-fg-default': value.colors.foreground,
  }
  if (Object.values(colors).some(color => typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color))) {
    return null
  }
  if (typeof value.accentNeighborAngle !== 'number'
    || !Number.isFinite(value.accentNeighborAngle)
    || value.accentNeighborAngle < -180
    || value.accentNeighborAngle > 180) return null
  const fontFamilies = parseUiFontFamilies(value.fontFamily)
  if (!fontFamilies) return null
  return {
    colors: Object.fromEntries(Object.entries(colors).map(([token, color]) => (
      [token, (color as string).toUpperCase()]
    ))) as Required<OcThemeColorOverrides>,
    accentNeighborAngle: Math.round(value.accentNeighborAngle),
    fontFamily: fontFamilies.length ? fontFamilies.join('; ') : 'system',
  }
}

function normalizeUserThemePresets(value: unknown): AppUserThemePreset[] {
  if (!Array.isArray(value)) return []
  const result: AppUserThemePreset[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.name !== 'string' || !isRecord(item.definition)) continue
    const name = item.name.trim()
    if (!name || name.length > 80 || /[\u0000-\u001F\u007F]/.test(name)) continue
    const colors = normalizeThemeColorOverrides(item.definition.colors)
    if (OC_EDITABLE_THEME_COLOR_KEYS.some(token => !colors[token])) continue
    if (typeof item.definition.accentNeighborAngle !== 'number'
      || !Number.isFinite(item.definition.accentNeighborAngle)
      || item.definition.accentNeighborAngle < -180
      || item.definition.accentNeighborAngle > 180) continue
    const fontFamilies = parseUiFontFamilies(item.definition.fontFamily)
    if (!fontFamilies) continue
    const preset: AppUserThemePreset = {
      name,
      definition: {
        colors: colors as Required<OcThemeColorOverrides>,
        accentNeighborAngle: Math.round(item.definition.accentNeighborAngle),
        fontFamily: fontFamilies.length ? fontFamilies.join('; ') : 'system',
      },
    }
    const existingIndex = result.findIndex(candidate => (
      candidate.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    ))
    if (existingIndex >= 0) result[existingIndex] = preset
    else if (result.length < 32) result.push(preset)
  }
  return result
}

function normalizeWorkspaceStates(value: unknown): Record<string, ProjectWorkspaceState> {
  if (!isRecord(value)) return {}
  const result: Record<string, ProjectWorkspaceState> = {}
  for (const [pathInput, state] of Object.entries(value)) {
    if (!isRecord(state) || !Array.isArray(state.expandedDirectories)) continue
    const path = pathInput.trim().replace(/\\/g, '/').replace(/\/+$/, '')
    if (!path) continue
    const collapsedSections = isRecord(state.projectProfile) && Array.isArray(state.projectProfile.collapsedSections)
      ? [...new Set(state.projectProfile.collapsedSections.filter((item): item is string => (
          typeof item === 'string' && item.trim() !== ''
        )).map(item => item.trim()))]
      : []
    result[path] = {
      expandedDirectories: state.expandedDirectories
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
        .filter(Boolean),
      ...(collapsedSections.length > 0 ? { projectProfile: { collapsedSections } } : {}),
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
      accentNeighborAngles: { ...DEFAULT_APP_SETTINGS.appearance.accentNeighborAngles },
      fontFamilies: { ...DEFAULT_APP_SETTINGS.appearance.fontFamilies },
      userThemePresets: { dark: [], light: [] },
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
  const legacyAccentNeighborAngle = clampAngle(appearance.accentNeighborAngle)
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
      baseFontSize: clampBaseFontSize(appearance.baseFontSize),
      themeOverrides: {
        dark: normalizeThemeColorOverrides(isRecord(appearance.themeOverrides)
          ? appearance.themeOverrides.dark
          : undefined),
        light: normalizeThemeColorOverrides(isRecord(appearance.themeOverrides)
          ? appearance.themeOverrides.light
          : undefined),
      },
      accentNeighborAngles: {
        dark: clampAngle(
          isRecord(appearance.accentNeighborAngles) ? appearance.accentNeighborAngles.dark : undefined,
          legacyAccentNeighborAngle,
        ),
        light: clampAngle(
          isRecord(appearance.accentNeighborAngles) ? appearance.accentNeighborAngles.light : undefined,
          legacyAccentNeighborAngle,
        ),
      },
      fontFamilies: {
        dark: normalizeUiFontFamily(isRecord(appearance.fontFamilies) ? appearance.fontFamilies.dark : undefined),
        light: normalizeUiFontFamily(isRecord(appearance.fontFamilies) ? appearance.fontFamilies.light : undefined),
      },
      userThemePresets: {
        dark: normalizeUserThemePresets(isRecord(appearance.userThemePresets)
          ? appearance.userThemePresets.dark
          : undefined),
        light: normalizeUserThemePresets(isRecord(appearance.userThemePresets)
          ? appearance.userThemePresets.light
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
      alignmentSnappingEnabledByDefault: typeof workspace.alignmentSnappingEnabledByDefault === 'boolean'
        ? workspace.alignmentSnappingEnabledByDefault
        : DEFAULT_APP_SETTINGS.workspace.alignmentSnappingEnabledByDefault,
      defaultFontImportDirectory: typeof workspace.defaultFontImportDirectory === 'string'
        ? normalizeProjectFontDirectory(workspace.defaultFontImportDirectory) ?? DEFAULT_PROJECT_FONT_DIRECTORY
        : DEFAULT_PROJECT_FONT_DIRECTORY,
      defaultIconImportDirectory: typeof workspace.defaultIconImportDirectory === 'string'
        ? normalizeProjectIconDirectory(workspace.defaultIconImportDirectory) ?? DEFAULT_PROJECT_ICON_DIRECTORY
        : DEFAULT_PROJECT_ICON_DIRECTORY,
      historyEntryLimit: clampHistoryEntryLimit(workspace.historyEntryLimit),
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
