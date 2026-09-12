import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectIconSetSettingsDialog from './ProjectIconSetSettingsDialog.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('ProjectIconSetSettingsDialog', () => {
  it('saves an independent display name and Key', async () => {
    const wrapper = mount(ProjectIconSetSettingsDialog, {
      props: {
        open: true, name: 'Status icons', seriesKey: 'status', existingKeys: ['status'],
      },
      global: { stubs: { Teleport: true } },
    })
    const inputs = wrapper.findAll('input')
    // A set is renamed through its own name and Key only; its icons each own their file.
    expect(inputs).toHaveLength(2)
    await inputs[0]!.setValue(' 状态图标 ')
    await inputs[1]!.setValue(' status-new ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({ name: '状态图标', key: 'status-new' })
  })

  it('blocks invalid and case-insensitively duplicated names', async () => {
    const wrapper = mount(ProjectIconSetSettingsDialog, {
      props: { open: true, name: 'Status icons', seriesKey: 'status', existingKeys: ['status', 'Actions'] },
      global: { stubs: { Teleport: true } },
    })
    const input = wrapper.findAll('input')[1]!
    await input.setValue('ACTIONS')
    expect(wrapper.text()).toContain('projectConfig.icons.invalidIconSetKey')
    await input.setValue('actions')
    expect(wrapper.text()).toContain('projectConfig.icons.iconSetKeyExists')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
