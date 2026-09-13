import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import type { EditorItem, EditorItemEditorPart } from '../../../shared/ui/property-editor/propertyEditor.types'
import { createDefaultAppSettings, type SettingsCategoryKey } from '../model/appSettings'
import { useSettingsWorkspace } from './useSettingsWorkspace'

function editor(item: EditorItem, key = 'value'): EditorItemEditorPart {
  return item.content?.find((part): part is EditorItemEditorPart => (
    typeof part !== 'string' && part.type === 'editor' && part.key === key
  ))!
}

describe('useSettingsWorkspace', () => {
  it('projects general settings as root editor items', () => {
    const categoryKey = ref<SettingsCategoryKey>('general')
    const { categoryTreeData, activeCategory } = useSettingsWorkspace({
      settings: ref(createDefaultAppSettings()), categoryKey, projectOpen: ref(false),
      translate: (_key, fallback) => fallback,
    })

    expect(categoryTreeData.value.rootKeys).toEqual(['general', 'appearance', 'workspace'])
    // Every category row shows its own icon: the tree paints a row's leading visual from `visual`,
    // and a node that carries none falls back to the expand chevron.
    expect(categoryTreeData.value.rootKeys.map(key => categoryTreeData.value.items.get(key)?.visual)).toEqual([
      { type: 'icon', icon: 'tool.settings' },
      { type: 'icon', icon: 'data.symbol-color' },
      { type: 'icon', icon: 'nav.files' },
    ])
    expect(activeCategory.value.items.map(item => item.key)).toEqual([
      'appearance.locale',
      'shell.titleBarNoticeHistoryLimit',
      'updates.suppressReleaseNotesAfterUpdate',
      'exporting.openCdeWorkbookAfterExport',
      'identity.publisherKey',
    ])
    const publisherKey = activeCategory.value.items[4]!
    expect(editor(publisherKey)).toMatchObject({
      value: createDefaultAppSettings().identity.publisherKey,
      definition: { fieldType: 'string', commitMode: 'blur' },
    })
    expect(publisherKey.content?.filter(part => typeof part !== 'string' && part.type === 'action'))
      .toMatchObject([{ key: 'regenerate', icon: 'action.refresh', iconOnly: true }])
    expect(editor(activeCategory.value.items[0]!)).toMatchObject({
      value: 'system',
      definition: { fieldType: 'string', presentation: 'option-group' },
    })
    expect(editor(activeCategory.value.items[1]!)).toMatchObject({
      value: 128,
      definition: {
        fieldType: 'number', presentation: 'slider', min: 1, max: 512,
        ticks: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512],
      },
    })
  })

  it('projects appearance preview, sliders, and recursive theme items', async () => {
    const settings = createDefaultAppSettings()
    settings.appearance.userThemePresets.dark = [{
      name: 'Forest',
      definition: {
        colors: { '--oc-accent': '#112233', '--oc-bg-base': '#223344', '--oc-fg-default': '#DDEEFF' },
        accentNeighborAngle: -70,
        fontFamily: 'Inter',
      },
    }]
    settings.appearance.themeOverrides.dark = { ...settings.appearance.userThemePresets.dark[0]!.definition.colors }
    settings.appearance.accentNeighborAngles.dark = -70
    settings.appearance.fontFamilies.dark = 'Inter'
    const categoryKey = ref<SettingsCategoryKey>('appearance')
    const { activeCategory } = useSettingsWorkspace({
      settings: ref(settings), categoryKey, projectOpen: ref(false),
      systemFontFamilies: ref(['Inter', 'Microsoft YaHei UI']),
      translate: (_key, fallback) => fallback,
    })

    expect(activeCategory.value.preview).toEqual({ glassIntensity: 60 })
    expect(editor(activeCategory.value.items.find(item => item.key === 'appearance.baseFontSize')!))
      .toMatchObject({ definition: { presentation: 'slider', ticks: [10, 11, 12, 13, 14, 15, 16] } })
    const darkTheme = activeCategory.value.items.find(item => item.key === 'theme:dark')!
    const lightTheme = activeCategory.value.items.find(item => item.key === 'theme:light')!
    expect(darkTheme.children?.map(item => item.key)).toEqual([
      'preset', 'color:--oc-accent', 'color:--oc-bg-base', 'color:--oc-fg-default', 'font', 'angle',
    ])
    expect(lightTheme.children).toHaveLength(6)
    const preset = darkTheme.children?.[0]!
    expect(editor(preset).value).toBe('user:Forest')
    expect(preset.content?.filter(part => typeof part !== 'string' && part.type === 'action')).toHaveLength(3)
    const font = darkTheme.children?.find(item => item.key === 'font')!
    expect((await editor(font).definition.completion?.provider?.({ value: 'Mic', cursor: 3 }))?.items[0]?.label)
      .toBe('Microsoft YaHei UI')
  })

  it('projects workspace settings and updates reset availability reactively', () => {
    const categoryKey = ref<SettingsCategoryKey>('workspace')
    const projectOpen = ref(false)
    const { activeCategory } = useSettingsWorkspace({
      settings: ref(createDefaultAppSettings()), categoryKey, projectOpen,
      translate: (_key, fallback) => fallback,
    })

    expect(activeCategory.value.items.map(item => item.key)).toContain('workspace.autoSave')
    expect(activeCategory.value.items[activeCategory.value.items.length - 1]?.content?.[0]).toMatchObject({ type: 'action', disabled: true })
    projectOpen.value = true
    expect(activeCategory.value.items[activeCategory.value.items.length - 1]?.content?.[0]).toMatchObject({ type: 'action', disabled: false })
  })

  it('projects useful ticks for workspace numeric settings', () => {
    const categoryKey = ref<SettingsCategoryKey>('workspace')
    const { activeCategory } = useSettingsWorkspace({
      settings: ref(createDefaultAppSettings()), categoryKey, projectOpen: ref(false),
      translate: (_key, fallback) => fallback,
    })

    const definitionFor = (key: string) => editor(activeCategory.value.items.find(item => item.key === key)!).definition
    expect(definitionFor('workspace.autoSaveIntervalSeconds')).toMatchObject({
      ticks: [5, 15, 30, 60, 120, 300],
    })
    expect(definitionFor('workspace.historyEntryLimit')).toMatchObject({
      ticks: [10, 50, 100, 250, 500, 1000],
    })
  })
})
