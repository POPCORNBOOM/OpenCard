import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PropertyEditor from './PropertyEditor.vue'

const mocked = vi.hoisted(() => ({
  openMenuSpy: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    te: () => false,
  }),
}))

vi.mock('../../composables/useFloatingMenu', () => ({
  useFloatingMenu: () => ({
    openMenu: mocked.openMenuSpy,
  }),
}))

describe('PropertyEditor', () => {
  beforeEach(() => {
    mocked.openMenuSpy.mockClear()
  })

  it('renders empty hint when no source inputs', () => {
    const wrapper = mount(PropertyEditor, {
      props: {
        inputs: [],
        sortMode: 'category',
      },
    })

    expect(wrapper.find('.oc-empty-hint').exists()).toBe(true)
  })

  it('renders grouped sections and keeps add/reset interactions wired', async () => {
    const wrapper = mount(PropertyEditor, {
      props: {
        sortMode: 'category',
        inputs: [{
          key: 'block',
          record: { foo: 'bar' },
          override: {
            foo: {
              datatype: 'string',
              categoryId: 'identity',
              resettable: true,
            },
            addMe: {
              datatype: 'string',
              categoryId: 'identity',
            },
          },
        }],
      },
    })

    expect(wrapper.findAll('.oc-bar').length).toBeGreaterThanOrEqual(2)
    expect(wrapper.text()).toContain('block')
    expect(wrapper.text()).toContain('identity')

    await wrapper.get('.reset-field-button').trigger('click')
    expect(wrapper.emitted('reset-property')?.[0]).toEqual([{
      sourceKey: 'block',
      fieldKey: 'foo',
    }])

    await wrapper.get('.add-field-button').trigger('click')
    expect(mocked.openMenuSpy).toHaveBeenCalledTimes(1)

    const menuRequest = mocked.openMenuSpy.mock.calls[0][0]
    menuRequest.onSelect('addMe')
    expect(wrapper.emitted('add-property')?.[0]).toEqual([{
      sourceKey: 'block',
      fieldKey: 'addMe',
      value: '',
    }])
  })
})
