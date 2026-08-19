import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createDefaultAppSettings, type SettingsCategoryKey } from '../model/appSettings'
import { useSettingsWorkspace } from './useSettingsWorkspace'

describe('useSettingsWorkspace', () => {
  it('projects roots-only categories and the selected category fields', () => {
    const categoryKey = ref<SettingsCategoryKey>('general')
    const projectOpen = ref(false)
    const { categoryTreeData, activeCategory } = useSettingsWorkspace({
      settings: ref(createDefaultAppSettings()),
      categoryKey,
      projectOpen,
      translate: (_key, fallback) => fallback,
    })

    expect(categoryTreeData.value.rootKeys).toEqual(['general', 'appearance', 'workspace'])
    expect(categoryTreeData.value.children.size).toBe(0)
    expect(activeCategory.value.fields[0]).toMatchObject({
      type: 'options',
      key: 'appearance.locale',
      value: 'system',
    })
    expect(activeCategory.value.fields[1]).toMatchObject({
      type: 'switch',
      key: 'updates.suppressReleaseNotesAfterUpdate',
      checked: false,
    })
    expect(activeCategory.value.fields[2]).toMatchObject({
      type: 'switch',
      key: 'exporting.openCdeWorkbookAfterExport',
      checked: true,
    })

    categoryKey.value = 'appearance'
    expect(activeCategory.value.preview).toEqual({ glassIntensity: 60 })
    expect(activeCategory.value.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'options',
        key: 'appearance.theme',
        value: 'system',
        options: expect.arrayContaining([expect.objectContaining({ value: 'system' })]),
      }),
      expect.objectContaining({
        type: 'range',
        key: 'appearance.glassIntensity',
        value: 60,
        min: 0,
        max: 100,
      }),
      expect.objectContaining({
        type: 'range',
        key: 'appearance.baseFontSize',
        value: 12,
        min: 10,
        max: 16,
        suffix: 'px',
      }),
      expect.objectContaining({
        type: 'theme-color-panel',
        key: 'appearance.darkThemeColors',
        themeId: 'dark',
        preset: expect.objectContaining({ value: 'default' }),
        accentNeighborAngle: expect.objectContaining({ value: -50, min: -180, max: 180, suffix: '°' }),
        fontFamily: expect.objectContaining({ value: 'system' }),
        colors: expect.arrayContaining([
          expect.objectContaining({ key: 'accentColor', token: '--oc-accent' }),
        ]),
      }),
      expect.objectContaining({ type: 'theme-color-panel', key: 'appearance.lightThemeColors', themeId: 'light' }),
      expect.objectContaining({ type: 'action', key: 'themes.reset' }),
    ]))
    const colorPanels = activeCategory.value.fields.filter(field => field.type === 'theme-color-panel')
    expect(colorPanels).toHaveLength(2)
    expect(colorPanels.every(panel => panel.colors.length === 3)).toBe(true)
    expect(colorPanels.every(panel => panel.preset.options.filter(option => !option.value.startsWith('user:')).length === 5)).toBe(true)
    expect(colorPanels[0]!.preset.options[0]).toEqual({ value: 'default', label: 'OpenCard Dark' })
    expect(colorPanels[1]!.preset.options[0]).toEqual({ value: 'default', label: 'OpenCard Light' })
    expect(colorPanels[0]!.preset.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'grass-block', label: 'Grass Block' }),
    ]))
    expect(colorPanels[1]!.preset.options).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'grass-block' }),
    ]))
    expect(colorPanels[1]!.preset.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'morning-mist', label: 'Morning Mist' }),
      expect.objectContaining({ value: 'mint', label: 'Mint' }),
    ]))

    const customSettings = createDefaultAppSettings()
    customSettings.appearance.accentNeighborAngles.dark = -72
    const customWorkspace = useSettingsWorkspace({
      settings: ref(customSettings),
      categoryKey,
      projectOpen,
      translate: (_key, fallback) => fallback,
    })
    expect(customWorkspace.activeCategory.value.fields.find(field => (
      field.type === 'theme-color-panel' && field.themeId === 'dark'
    ))).toMatchObject({ preset: { value: '', canDelete: false } })

    categoryKey.value = 'workspace'
    expect(activeCategory.value.fields.map((field) => field.key)).toEqual([
      'workspace.historyEntryLimit',
      'workspace.structureTreeSelectionBehavior',
      'workspace.structureTreeScrollToSelection',
      'workspace.hideDotFiles',
      'workspace.showSelectionPositionOnMove',
      'workspace.showSelectionSizeOnResize',
      'workspace.alignmentSnappingEnabledByDefault',
      'project-workspace.reset',
    ])
    expect(activeCategory.value.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'options',
        key: 'workspace.structureTreeSelectionBehavior',
        value: 'expand-exclusive',
      }),
      expect.objectContaining({
        type: 'switch',
        key: 'workspace.structureTreeScrollToSelection',
        checked: true,
      }),
      expect.objectContaining({
        type: 'switch',
        key: 'workspace.hideDotFiles',
        checked: true,
      }),
      expect.objectContaining({
        type: 'switch',
        key: 'workspace.showSelectionPositionOnMove',
        checked: true,
      }),
      expect.objectContaining({
        type: 'switch',
        key: 'workspace.showSelectionSizeOnResize',
        checked: true,
      }),
      expect.objectContaining({
        type: 'switch',
        key: 'workspace.alignmentSnappingEnabledByDefault',
        checked: true,
      }),
      expect.objectContaining({ type: 'action', key: 'project-workspace.reset', disabled: true }),
    ]))

    projectOpen.value = true
    expect(activeCategory.value.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'action', key: 'project-workspace.reset', disabled: false }),
    ]))
  })

  it('projects installed system font families into both theme panels', () => {
    const { activeCategory } = useSettingsWorkspace({
      settings: ref(createDefaultAppSettings()),
      categoryKey: ref<SettingsCategoryKey>('appearance'),
      projectOpen: ref(false),
      systemFontFamilies: ref(['Inter', 'Microsoft YaHei UI']),
      translate: (_key, fallback) => fallback,
    })

    const panels = activeCategory.value.fields.filter(field => field.type === 'theme-color-panel')
    expect(panels).toHaveLength(2)
    expect(panels[0]!.fontFamily.fontFamilies).toEqual(['Inter', 'Microsoft YaHei UI'])
    expect(panels[0]!.fontFamily.placeholder).toBe('System')
  })

  it('adds imported themes to the preset list and marks only them deletable', () => {
    const settings = createDefaultAppSettings()
    settings.appearance.userThemePresets.dark = [{
      name: 'Forest',
      definition: {
        colors: {
          '--oc-accent': '#228833',
          '--oc-bg-base': '#102010',
          '--oc-fg-default': '#DDEEDD',
        },
        accentNeighborAngle: -25,
        fontFamily: 'Inter; SimSun',
      },
    }]
    settings.appearance.themeOverrides.dark = { ...settings.appearance.userThemePresets.dark[0]!.definition.colors }
    settings.appearance.accentNeighborAngles.dark = -25
    settings.appearance.fontFamilies.dark = 'Inter; SimSun'
    const { activeCategory } = useSettingsWorkspace({
      settings: ref(settings),
      categoryKey: ref<SettingsCategoryKey>('appearance'),
      projectOpen: ref(false),
      translate: (_key, fallback) => fallback,
    })

    const darkPanel = activeCategory.value.fields.find(field => (
      field.type === 'theme-color-panel' && field.themeId === 'dark'
    ))
    expect(darkPanel).toMatchObject({ preset: { value: 'user:Forest', canDelete: true } })
    expect(darkPanel?.type === 'theme-color-panel' && darkPanel.preset.options).toEqual(expect.arrayContaining([
      { value: 'user:Forest', label: 'Forest · Imported' },
    ]))
  })
})
