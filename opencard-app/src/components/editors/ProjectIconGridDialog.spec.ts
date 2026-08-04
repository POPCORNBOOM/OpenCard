import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectIconGridDialog from './ProjectIconGridDialog.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('ProjectIconGridDialog', () => {
  it('submits typed grid settings and resets overwrite when reopened', async () => {
    const wrapper = mount(ProjectIconGridDialog, {
      props: {
        open: true, hasIcons: true, initialRows: 2, initialColumns: 3,
        imageSrc: 'asset://icons', imageWidth: 101, imageHeight: 51,
      },
      global: { stubs: { Teleport: true } },
    })
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('4')
    await inputs[1]!.setValue('5')
    const switches = wrapper.findAll('input[type="checkbox"]')
    await switches[1]!.setValue(true)
    expect(wrapper.findAll('.project-icon-grid-dialog__grid-line')).toHaveLength(7)
    expect(wrapper.get('.project-icon-grid-dialog__preview').attributes('viewBox')).toBe('0 0 101 51')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({ rows: 4, columns: 5, pixelated: false, overwrite: true })

    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    expect((wrapper.findAll('input[type="checkbox"]')[1]!.element as HTMLInputElement).checked).toBe(false)
  })

  it('normalizes invalid dimensions when the parent submits the dialog', async () => {
    const wrapper = mount(ProjectIconGridDialog, {
      props: { open: true },
      global: { stubs: { Teleport: true } },
    })
    await wrapper.findAll('input')[0]!.setValue('0')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ rows: 1, columns: 1 })
  })

  it('steps through factors and normalizes typed values to the nearest factor', async () => {
    const wrapper = mount(ProjectIconGridDialog, {
      props: { open: true, imageSrc: 'asset://icons', imageWidth: 12, imageHeight: 8 },
      global: { stubs: { Teleport: true } },
    })
    const inputs = wrapper.findAll('.number-field__input')
    await inputs[0]!.setValue('3')
    await inputs[1]!.setValue('5')
    await wrapper.findAll('input[type="checkbox"]')[0]!.setValue(true)
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('2')
    expect((inputs[1]!.element as HTMLInputElement).value).toBe('4')

    await wrapper.findAll('.number-field__stepper')[0]!.trigger('click')
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('4')

    ;(inputs[0]!.element as HTMLInputElement).value = '7'
    await inputs[0]!.trigger('input')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ rows: 8, columns: 4 })
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('8')
  })
})
