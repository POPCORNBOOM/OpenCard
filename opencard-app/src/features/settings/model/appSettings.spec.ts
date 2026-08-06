import { describe, expect, it } from 'vitest'
import {
  APP_THEME_PRESETS,
  APP_THEME_FILE_EXTENSION,
  APP_THEME_FILE_SUFFIX,
  APP_SETTINGS_VERSION,
  createDefaultAppSettings,
  getThemePreset,
  normalizeAppSettings,
  parseAppTheme,
  resolveThemePresetId,
  serializeAppTheme,
} from './appSettings'

describe('appSettings', () => {
  it('exposes the current theme exchange file suffix', () => {
    expect(APP_THEME_FILE_EXTENSION).toBe('octheme')
    expect(APP_THEME_FILE_SUFFIX).toBe('.octheme')
  })

  it('returns independent defaults for missing or unsupported data', () => {
    const first = normalizeAppSettings(null)
    const second = normalizeAppSettings({ version: 99 })

    expect(first).toEqual(createDefaultAppSettings())
    expect(second).toEqual(createDefaultAppSettings())
    expect(first).not.toBe(second)
  })

  it('normalizes fields and clamps sidebar width', () => {
    expect(normalizeAppSettings({
      version: APP_SETTINGS_VERSION,
      appearance: { theme: 'light', locale: 'zh-CN', glassIntensity: 130 },
      shell: { sidebarWidth: 9999, sidebarCollapsed: true },
    })).toEqual({
      version: APP_SETTINGS_VERSION,
      appearance: {
        theme: 'light',
        locale: 'zh-CN',
        glassIntensity: 100,
        baseFontSize: 12,
        themeOverrides: { dark: {}, light: {} },
        accentNeighborAngles: { dark: -50, light: -50 },
        fontFamilies: { dark: 'system', light: 'system' },
        userThemePresets: { dark: [], light: [] },
      },
      shell: { sidebarWidth: 640, sidebarCollapsed: true },
      updates: { suppressReleaseNotesAfterUpdate: false },
      workspace: {
        structureTreeSelectionBehavior: 'expand-exclusive',
        structureTreeScrollToSelection: true,
        showSelectionPositionOnMove: true,
        showSelectionSizeOnResize: true,
        alignmentSnappingEnabledByDefault: true,
        defaultFontImportDirectory: 'assets/fonts',
        defaultIconImportDirectory: 'assets/icons',
      },
      projectCreation: { lastParentPath: '', recentProjects: [], workspaceStates: {} },
    })
  })

  it('keeps only editable valid theme colors for each theme', () => {
    const settings = normalizeAppSettings({
      version: APP_SETTINGS_VERSION,
      appearance: {
        themeOverrides: {
          dark: {
            '--oc-accent': '#aabbcc',
            '--oc-bg-base': 'red',
            '--oc-bg-surface': '#223344',
            '--oc-danger': '#112233',
          },
          light: { '--oc-fg-default': '#123456' },
        },
      },
    })

    expect(settings.appearance.themeOverrides).toEqual({
      dark: { '--oc-accent': '#AABBCC' },
      light: { '--oc-fg-default': '#123456' },
    })
  })

  it('normalizes project-profile collapse state in project workspace cache', () => {
    const settings = normalizeAppSettings({
      version: APP_SETTINGS_VERSION,
      projectCreation: {
        workspaceStates: {
          'D:\\Cards\\Demo\\': {
            expandedDirectories: ['assets'],
            projectProfile: {
              collapsedSections: ['fonts', 'fonts', '', 42],
            },
          },
        },
      },
    })

    expect(settings.projectCreation.workspaceStates['D:/Cards/Demo']).toEqual({
      expandedDirectories: ['assets'],
      projectProfile: { collapsedSections: ['fonts'] },
    })
  })

  it('fills workspace behavior defaults for older current-version settings', () => {
    const settings = normalizeAppSettings({
      version: APP_SETTINGS_VERSION,
      appearance: { theme: 'light', locale: 'zh-CN' },
      shell: { sidebarWidth: 320, sidebarCollapsed: false },
    })

    expect(settings.workspace).toEqual(createDefaultAppSettings().workspace)
    expect(settings.updates).toEqual(createDefaultAppSettings().updates)
    expect(settings.projectCreation).toEqual(createDefaultAppSettings().projectCreation)
    expect(settings.appearance.glassIntensity).toBe(60)
    expect(settings.appearance.accentNeighborAngles).toEqual({ dark: -50, light: -50 })
  })

  it('keeps a valid project-relative font directory and rejects unsafe paths', () => {
    expect(normalizeAppSettings({
      version: APP_SETTINGS_VERSION,
      workspace: { defaultFontImportDirectory: 'resources/typefaces/' },
    }).workspace.defaultFontImportDirectory).toBe('resources/typefaces')
    expect(normalizeAppSettings({
      version: APP_SETTINGS_VERSION,
      workspace: { defaultFontImportDirectory: '../fonts' },
    }).workspace.defaultFontImportDirectory).toBe('assets/fonts')
  })

  it('keeps a valid project-relative icon directory and rejects unsafe paths', () => {
    expect(normalizeAppSettings({
      version: APP_SETTINGS_VERSION,
      workspace: { defaultIconImportDirectory: 'resources/sprites/' },
    }).workspace.defaultIconImportDirectory).toBe('resources/sprites')
    expect(normalizeAppSettings({
      version: APP_SETTINGS_VERSION,
      workspace: { defaultIconImportDirectory: '../icons' },
    }).workspace.defaultIconImportDirectory).toBe('assets/icons')
  })

  it('migrates the legacy shared phase angle and clamps per-theme values', () => {
    const settings = normalizeAppSettings({
      version: APP_SETTINGS_VERSION,
      appearance: {
        accentNeighborAngle: -72,
        accentNeighborAngles: { dark: -240, light: 240 },
      },
    })

    expect(settings.appearance.accentNeighborAngles).toEqual({ dark: -180, light: 180 })
    expect(normalizeAppSettings({
      version: APP_SETTINGS_VERSION,
      appearance: { accentNeighborAngle: -72 },
    }).appearance.accentNeighborAngles).toEqual({ dark: -72, light: -72 })
  })

  it('defines the grass block preset and round-trips exported themes', () => {
    const preset = getThemePreset('dark', 'grass-block')
    expect(preset).toEqual({
      colors: {
        '--oc-accent': '#75FF53',
        '--oc-bg-base': '#34251A',
        '--oc-fg-default': '#CCCCCC',
      },
      accentNeighborAngle: -50,
      fontFamily: 'system',
    })
    expect(resolveThemePresetId('dark', preset!.colors, -50, 'system')).toBe('grass-block')
    expect(getThemePreset('light', 'grass-block')).toBeNull()

    const content = serializeAppTheme('dark', preset!.colors, -50, 'system')
    expect(parseAppTheme(content)).toEqual(preset)
    expect(parseAppTheme('{"format":"opencard-theme","version":1}')).toBeNull()
  })

  it('provides five built-in presets for each color scheme', () => {
    expect(APP_THEME_PRESETS.dark).toHaveLength(5)
    expect(APP_THEME_PRESETS.light).toHaveLength(5)
    expect(APP_THEME_PRESETS.dark.every(id => getThemePreset('dark', id))).toBe(true)
    expect(APP_THEME_PRESETS.light.every(id => getThemePreset('light', id))).toBe(true)
  })

  it('normalizes imported theme presets and resolves them from current data', () => {
    const settings = normalizeAppSettings({
      version: APP_SETTINGS_VERSION,
      appearance: {
        userThemePresets: {
          dark: [{
            name: 'Forest',
            definition: {
              colors: {
                '--oc-accent': '#75ff53',
                '--oc-bg-base': '#34251a',
                '--oc-fg-default': '#cccccc',
              },
              accentNeighborAngle: -35,
              fontFamily: 'Inter; SimSun',
            },
          }],
        },
      },
    })

    expect(settings.appearance.userThemePresets.dark[0]?.definition.colors['--oc-accent']).toBe('#75FF53')
    expect(resolveThemePresetId(
      'dark',
      settings.appearance.userThemePresets.dark[0]!.definition.colors,
      -35,
      'Inter; SimSun',
      settings.appearance.userThemePresets.dark,
    )).toBe('user:Forest')
  })

  it('clamps the base font size and normalizes per-theme font choices', () => {
    const settings = normalizeAppSettings({
      version: APP_SETTINGS_VERSION,
      appearance: {
        baseFontSize: 99,
        fontFamilies: { dark: 'Inter; Microsoft YaHei UI; inter', light: 'bad\nfont' },
      },
    })

    expect(settings.appearance.baseFontSize).toBe(16)
    expect(settings.appearance.fontFamilies).toEqual({
      dark: 'Inter; Microsoft YaHei UI',
      light: 'system',
    })
  })

  it('falls back field-by-field for malformed current-version data', () => {
    expect(normalizeAppSettings({
      version: APP_SETTINGS_VERSION,
      appearance: { theme: 'unknown', locale: 12 },
      shell: { sidebarWidth: 'wide', sidebarCollapsed: 'yes' },
    })).toEqual(createDefaultAppSettings())
  })

  it('normalizes, deduplicates, and limits recent projects', () => {
    const settings = normalizeAppSettings({
      version: APP_SETTINGS_VERSION,
      projectCreation: {
        recentProjects: [
          'D:\\Cards\\',
          'd:/cards',
          ' D:\\Projects\\One ',
          'D:/Projects/Two',
          'D:/Projects/Three',
          'D:/Projects/Four',
          'D:/Projects/Five',
          'D:/Projects/Six',
          'D:/Projects/Seven',
          'D:/Projects/Eight',
          'D:/Projects/Nine',
          42,
        ],
      },
    })

    expect(settings.projectCreation.recentProjects).toEqual([
      'D:/Cards',
      'D:/Projects/One',
      'D:/Projects/Two',
      'D:/Projects/Three',
      'D:/Projects/Four',
      'D:/Projects/Five',
      'D:/Projects/Six',
      'D:/Projects/Seven',
    ])
  })
})
