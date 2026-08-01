import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcActionButton from '../../../components/standard/OcActionButton.vue'
import PropertyFieldActionRail from './PropertyFieldActionRail.vue'

describe('PropertyFieldActionRail', () => {
  it('renders every definition through the same Action Button contract and emits its key', () => {
    const wrapper = mount(PropertyFieldActionRail, {
      props: {
        actions: [
          { key: 'field-editor.use-raw-string', icon: 'data.code-string', title: 'Source' },
          { key: 'reset', icon: 'action.discard', title: 'Reset' },
        ],
      },
    })
    const buttons = wrapper.findAllComponents(OcActionButton)

    expect(buttons).toHaveLength(2)
    expect(buttons.every(button => button.props('size') === 'sm')).toBe(true)
    expect(buttons.every(button => button.props('variant') === 'ghost')).toBe(true)
    buttons[1]!.vm.$emit('select', { key: 'reset' })
    expect(wrapper.emitted('action')).toEqual([['reset']])
  })

  it('does not render an empty action container', () => {
    const wrapper = mount(PropertyFieldActionRail, { props: { actions: [] } })
    expect(wrapper.find('.property-field-action-rail').exists()).toBe(false)
  })
})
