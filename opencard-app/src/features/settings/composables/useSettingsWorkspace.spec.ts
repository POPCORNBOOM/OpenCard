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
    ]))

    categoryKey.value = 'workspace'
    expect(activeCategory.value.fields.map((field) => field.key)).toEqual([
      'workspace.structureTreeSelectionBehavior',
      'workspace.structureTreeScrollToSelection',
      'workspace.showSelectionPositionOnMove',
      'workspace.showSelectionSizeOnResize',
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
        key: 'workspace.showSelectionPositionOnMove',
        checked: true,
      }),
      expect.objectContaining({
        type: 'switch',
        key: 'workspace.showSelectionSizeOnResize',
        checked: true,
      }),
      expect.objectContaining({ type: 'action', key: 'project-workspace.reset', disabled: true }),
    ]))

    projectOpen.value = true
    expect(activeCategory.value.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'action', key: 'project-workspace.reset', disabled: false }),
    ]))
  })
})
