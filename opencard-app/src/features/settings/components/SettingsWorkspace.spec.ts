import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcSwitch from '../../../components/base/OcSwitch.vue'
import OcSlider from '../../../components/standard/OcSlider.vue'
import SettingsWorkspace from './SettingsWorkspace.vue'

describe('SettingsWorkspace', () => {
  it('emits a setting change from a Switch field', async () => {
    const wrapper = mount(SettingsWorkspace, {
      props: {
        viewModel: {
          key: 'general',
          title: 'General',
          fields: [{
            type: 'switch',
            key: 'updates.suppressReleaseNotesAfterUpdate',
            label: 'Do not show release notes after an update',
            checked: false,
          }],
        },
      },
    })

    await wrapper.getComponent(OcSwitch).get('input').setValue(true)

    expect(wrapper.emitted('intent')).toEqual([[
      {
        type: 'setting.change',
        key: 'updates.suppressReleaseNotesAfterUpdate',
        value: true,
      },
    ]])
  })

  it('returns semantic setting intent without mutating its view model', async () => {
    const viewModel = {
      key: 'appearance' as const,
      title: 'Appearance',
      fields: [{
        type: 'options' as const,
        key: 'appearance.theme' as const,
        label: 'Theme',
        value: 'dark',
        options: [
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
        ],
      }],
    }
    const wrapper = mount(SettingsWorkspace, { props: { viewModel } })

    await wrapper.findAll('[role="radio"]')[1].trigger('click')

    expect(wrapper.emitted('intent')).toEqual([[
      { type: 'setting.change', key: 'appearance.theme', value: 'light' },
    ]])
    expect(viewModel.fields[0].value).toBe('dark')
  })

  it('does not emit a disabled project reset action', async () => {
    const wrapper = mount(SettingsWorkspace, {
      props: {
        viewModel: {
          key: 'workspace',
          title: 'Workspace',
          fields: [{
            type: 'action',
            key: 'project-workspace.reset',
            label: 'Project workspace state',
            actionLabel: 'Reset',
            icon: 'action.restart',
            disabled: true,
          }],
        },
      },
    })

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('intent')).toBeUndefined()
  })

  it('separates range preview from its committed setting change', async () => {
    const wrapper = mount(SettingsWorkspace, {
      props: {
        viewModel: {
          key: 'appearance',
          title: 'Appearance',
          fields: [{
            type: 'range',
            key: 'appearance.glassIntensity',
            label: 'Glass intensity',
            value: 60,
            min: 0,
            max: 100,
            step: 1,
            suffix: '%',
          }],
        },
      },
    })

    wrapper.getComponent(OcSlider).vm.$emit('preview', 42)
    wrapper.getComponent(OcSlider).vm.$emit('commit', 42)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('intent')).toEqual([
      [{ type: 'setting.preview', key: 'appearance.glassIntensity', value: 42 }],
      [{ type: 'setting.change', key: 'appearance.glassIntensity', value: 42 }],
    ])
  })

  it('renders the appearance preview when preview data is provided', () => {
    const wrapper = mount(SettingsWorkspace, {
      props: {
        viewModel: {
          key: 'appearance',
          title: 'Appearance',
          preview: { glassIntensity: 72 },
          fields: [],
        },
      },
    })

    expect(wrapper.get('.settings-workspace__preview-glass').text()).toContain('72%')
  })
})
