import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SettingsWorkspace from './SettingsWorkspace.vue'
import type { SettingsCategoryViewModel } from '../composables/useSettingsWorkspace'

describe('SettingsWorkspace', () => {
  it('renders page editor items and forwards setting editor events', async () => {
    const viewModel: SettingsCategoryViewModel = {
      key: 'general',
      title: 'General',
      items: [{
        key: 'appearance.baseFontSize',
        title: 'Base font size',
        content: [{
          type: 'editor',
          key: 'value',
          value: 12,
          definition: { title: 'Base font size', fieldType: 'number', presentation: 'slider', min: 10, max: 16 },
        }],
      }],
    }
    const wrapper = mount(SettingsWorkspace, { props: { viewModel } })
    const editor = wrapper.findComponent({ name: 'PropertyFieldRenderer' })
    editor.vm.$emit('preview:value', '14')
    editor.vm.$emit('commit:value', '15')

    expect(wrapper.emitted('intent')).toEqual([
      [{ type: 'setting.preview', key: 'appearance.baseFontSize', value: 14 }],
      [{ type: 'setting.change', key: 'appearance.baseFontSize', value: 15 }],
    ])
  })

  it('keeps the appearance preview in the page editor before slot', () => {
    const viewModel: SettingsCategoryViewModel = {
      key: 'appearance', title: 'Appearance', preview: { glassIntensity: 72 }, items: [],
    }
    const wrapper = mount(SettingsWorkspace, { props: { viewModel } })
    expect(wrapper.find('.settings-workspace__preview-glass').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'PagePropertyEditor' }).exists()).toBe(true)
  })
})
