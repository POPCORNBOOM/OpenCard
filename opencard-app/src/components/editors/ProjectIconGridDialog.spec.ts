import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectIconGridDialog from './ProjectIconGridDialog.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('ProjectIconGridDialog', () => {
  it('submits typed grid settings and resets overwrite when reopened', async () => {
    const wrapper = mount(ProjectIconGridDialog, {
      props: { open: true, hasIcons: true, initialRows: 2, initialColumns: 3 },
      global: { stubs: { Teleport: true } },
    })
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('4')
    await inputs[1]!.setValue('5')
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({ rows: 4, columns: 5, pixelated: false, overwrite: true })

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    expect((wrapper.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false)
  })

  it('does not submit invalid dimensions', async () => {
    const wrapper = mount(ProjectIconGridDialog, {
      props: { open: true },
      global: { stubs: { Teleport: true } },
    })
    await wrapper.findAll('input')[0]!.setValue('0')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
