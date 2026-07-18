import { describe, expect, it } from 'vitest'
import { createDefaultAppSettings } from '../model/appSettings'
import { MemorySettingsPersistence } from '../services/settingsPersistence'
import { createAppSettingsStore } from './appSettingsStore'

describe('appSettingsStore', () => {
  it('loads normalized settings and becomes ready', async () => {
    const persistence = new MemorySettingsPersistence({
      version: 1,
      appearance: { theme: 'light', locale: 'en-US' },
      shell: { sidebarWidth: 500, sidebarCollapsed: true },
    })
    const store = createAppSettingsStore(persistence)

    await store.initialize()

    expect(store.isReady.value).toBe(true)
    expect(store.settings.value.appearance.theme).toBe('light')
    expect(store.settings.value.shell.sidebarWidth).toBe(500)
  })

  it('validates semantic updates and persists the final document', async () => {
    const persistence = new MemorySettingsPersistence()
    const store = createAppSettingsStore(persistence)
    await store.initialize()

    store.updateSetting('appearance.theme', 'light')
    store.updateSetting('appearance.locale', 'zh-CN')
    store.updateSetting('appearance.glassIntensity', 75)
    store.updateShell({ sidebarWidth: 9999, sidebarCollapsed: true })
    store.updateSetting('workspace.structureTreeSelectionBehavior', 'expand')
    store.updateSetting('workspace.structureTreeScrollToSelection', false)
    store.updateProjectCreation({ lastParentPath: 'D:\\Cards' })
    await store.flush()

    const saved = await persistence.load()
    expect(saved).toMatchObject({
      appearance: { theme: 'light', locale: 'zh-CN', glassIntensity: 75 },
      shell: { sidebarWidth: 640, sidebarCollapsed: true },
      workspace: {
        structureTreeSelectionBehavior: 'expand',
        structureTreeScrollToSelection: false,
      },
      projectCreation: { lastParentPath: 'D:\\Cards' },
    })
  })

  it('keeps recently opened projects in most-recent-first order', async () => {
    const persistence = new MemorySettingsPersistence()
    const store = createAppSettingsStore(persistence)
    await store.initialize()

    store.rememberRecentProject('D:\\Projects\\One\\')
    store.rememberRecentProject('D:/Projects/Two')
    store.rememberRecentProject('d:/projects/one')
    await store.flush()

    expect(store.settings.value.projectCreation.recentProjects).toEqual([
      'd:/projects/one',
      'D:/Projects/Two',
    ])
    expect(await persistence.load()).toMatchObject({
      projectCreation: {
        recentProjects: ['d:/projects/one', 'D:/Projects/Two'],
      },
    })
  })

  it('forgets a recent project without touching its files', async () => {
    const persistence = new MemorySettingsPersistence()
    const store = createAppSettingsStore(persistence)
    await store.initialize()
    store.rememberRecentProject('D:/Projects/One')
    store.rememberRecentProject('D:/Projects/Two')

    store.forgetRecentProject('d:\\projects\\one\\')
    await store.flush()

    expect(store.settings.value.projectCreation.recentProjects).toEqual(['D:/Projects/Two'])
  })

  it('resets individual sections without replacing other settings', async () => {
    const store = createAppSettingsStore(new MemorySettingsPersistence())
    await store.initialize()
    store.updateSetting('appearance.theme', 'light')
    store.updateShell({ sidebarWidth: 500 })

    store.resetSection('appearance')

    expect(store.settings.value.appearance).toEqual(createDefaultAppSettings().appearance)
    expect(store.settings.value.shell.sidebarWidth).toBe(500)
  })
})
