import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OcButton from '../../../components/base/OcButton.vue'
import OcSwitch from '../../../components/base/OcSwitch.vue'
import PropertyFieldControl from './PropertyFieldControl.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

describe('PropertyFieldControl', () => {
  it('exposes an embedded appearance without changing field behavior', () => {
    const wrapper = mount(PropertyFieldControl, {
      props: {
        identity: 'blueprint\0block\0content',
        appearance: 'embedded',
        definition: { title: 'Content', fieldType: 'string' },
        value: 'Hello',
      },
    })

    expect(wrapper.classes()).toContain('property-field-control--embedded')
    expect(wrapper.get('input').element).toHaveProperty('value', 'Hello')
  })

  it('uses a Switch for editable boolean fields', async () => {
    const wrapper = mount(PropertyFieldControl, {
      props: {
        identity: 'blueprint\0block\0visible',
        definition: { title: 'Visible', fieldType: 'boolean' },
        value: 'false',
      },
    })

    await wrapper.getComponent(OcSwitch).get('input').setValue(true)

    expect(wrapper.emitted('update:value')).toEqual([['true']])
  })

  it('keeps forced source mode scoped to the stable field identity', async () => {
    const wrapper = mount(PropertyFieldControl, {
      props: {
        identity: 'blueprint\0block\0opacity',
        definition: {
          title: 'Opacity',
          fieldType: 'number',
          binding: { provider: () => null },
        },
        value: '1',
        bindingInterpreter: {
          isExpression: value => typeof value === 'string' && value.startsWith('{{'),
        },
      },
    })

    const sourceToggle = () => wrapper.findAllComponents(OcButton)
      .find(button => button.classes().includes('raw-string-toggle'))!
    expect(wrapper.find('.number-field').exists()).toBe(true)
    await sourceToggle().trigger('click')
    expect(wrapper.find('.reference-string-field').exists()).toBe(true)

    await wrapper.setProps({ identity: 'blueprint\0block\0width' })
    expect(wrapper.find('.reference-string-field').exists()).toBe(false)

    await wrapper.setProps({ value: '{{self:opacity}}' })
    expect(wrapper.find('.reference-string-field').exists()).toBe(true)
  })
})
