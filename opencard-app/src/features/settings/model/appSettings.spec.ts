import { describe, expect, it } from 'vitest'
import {
  APP_SETTINGS_VERSION,
  createDefaultAppSettings,
  normalizeAppSettings,
} from './appSettings'

describe('appSettings', () => {
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
      appearance: { theme: 'light', locale: 'zh-CN', glassIntensity: 100 },
      shell: { sidebarWidth: 640, sidebarCollapsed: true },
      workspace: {
        structureTreeSelectionBehavior: 'expand-exclusive',
        structureTreeScrollToSelection: true,
      },
      projectCreation: { lastParentPath: '', recentProjects: [] },
    })
  })

  it('fills workspace behavior defaults for older current-version settings', () => {
    const settings = normalizeAppSettings({
      version: APP_SETTINGS_VERSION,
      appearance: { theme: 'light', locale: 'zh-CN' },
      shell: { sidebarWidth: 320, sidebarCollapsed: false },
    })

    expect(settings.workspace).toEqual(createDefaultAppSettings().workspace)
    expect(settings.projectCreation).toEqual(createDefaultAppSettings().projectCreation)
    expect(settings.appearance.glassIntensity).toBe(60)
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
