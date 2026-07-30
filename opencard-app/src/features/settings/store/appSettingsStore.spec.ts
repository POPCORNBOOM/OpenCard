import { describe, expect, it, vi } from 'vitest'
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
    store.updateSetting('appearance.accentNeighborAngle', -72)
    store.updateSetting('updates.suppressReleaseNotesAfterUpdate', true)
    store.updateShell({ sidebarWidth: 9999, sidebarCollapsed: true })
    store.updateSetting('workspace.structureTreeSelectionBehavior', 'expand')
    store.updateSetting('workspace.structureTreeScrollToSelection', false)
    store.updateSetting('workspace.showSelectionPositionOnMove', false)
    store.updateSetting('workspace.showSelectionSizeOnResize', false)
    store.updateProjectCreation({ lastParentPath: 'D:\\Cards' })
    await store.flush()

    const saved = await persistence.load()
    expect(saved).toMatchObject({
      appearance: { theme: 'light', locale: 'zh-CN', glassIntensity: 75, accentNeighborAngle: -72 },
      shell: { sidebarWidth: 640, sidebarCollapsed: true },
      updates: { suppressReleaseNotesAfterUpdate: true },
      workspace: {
        structureTreeSelectionBehavior: 'expand',
        structureTreeScrollToSelection: false,
        showSelectionPositionOnMove: false,
        showSelectionSizeOnResize: false,
      },
      projectCreation: { lastParentPath: 'D:\\Cards' },
    })
  })

  it('applies continuous previews without persisting until commit', async () => {
    const persistence = new MemorySettingsPersistence()
    const save = vi.spyOn(persistence, 'save')
    const store = createAppSettingsStore(persistence)
    await store.initialize()
    save.mockClear()

    for (let value = 61; value <= 80; value += 1) {
      store.previewSetting('appearance.glassIntensity', value)
    }

    expect(store.settings.value.appearance.glassIntensity).toBe(80)
    expect(save).not.toHaveBeenCalled()

    store.updateSetting('appearance.glassIntensity', 80)
    await store.flush()

    expect(save).toHaveBeenCalledTimes(1)
    expect(await persistence.load()).toMatchObject({ appearance: { glassIntensity: 80 } })
  })

  it('previews, persists, and resets paired theme color overrides', async () => {
    const persistence = new MemorySettingsPersistence()
    const save = vi.spyOn(persistence, 'save')
    const store = createAppSettingsStore(persistence)
    await store.initialize()
    save.mockClear()

    store.previewThemeColor('dark', '--oc-accent', '#112233')
    expect(store.settings.value.appearance.themeOverrides.dark['--oc-accent']).toBe('#112233')
    expect(save).not.toHaveBeenCalled()

    store.updateThemeColor('dark', '--oc-accent', '#112233')
    await store.flush()
    expect(save).toHaveBeenCalledTimes(1)

    store.resetThemeColors()
    await store.flush()
    expect(store.settings.value.appearance.themeOverrides).toEqual({ dark: {}, light: {} })
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
    store.updateProjectCreation({ workspaceStates: { 'D:/Projects/One': { expandedDirectories: ['assets'] } } })

    store.forgetRecentProject('d:\\projects\\one\\')
    await store.flush()

    expect(store.settings.value.projectCreation.recentProjects).toEqual(['D:/Projects/Two'])
    expect(store.settings.value.projectCreation.workspaceStates).not.toHaveProperty('D:/Projects/One')
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
