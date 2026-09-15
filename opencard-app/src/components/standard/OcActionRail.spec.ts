import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcActionRail from './OcActionRail.vue'

describe('OcActionRail', () => {
  it('renders one ghost action button per action inside a tooltip group', () => {
    const wrapper = mount(OcActionRail, {
      props: {
        actions: [
          { key: 'open', icon: 'action.play', title: 'Open' },
          { key: 'zoom', icon: 'tool.zoom-in', title: 'Zoom in' },
        ],
      },
    })

    expect(wrapper.get('.oc-action-rail').attributes('data-tooltip-group')).toBe('')
    const buttons = wrapper.findAll('.oc-action-button button')
    expect(buttons.map(button => button.attributes('aria-label'))).toEqual(['Open', 'Zoom in'])
    expect(buttons.every(button => button.classes().includes('oc-button--size-sm'))).toBe(true)
    expect(buttons.every(button => button.classes().includes('oc-button--variant-ghost'))).toBe(true)
    expect(wrapper.findAll('.oc-button__icon').every(icon => icon.classes().includes('oc-icon--action'))).toBe(true)
  })

  it('renders an empty rail when no action is given', () => {
    const wrapper = mount(OcActionRail, { props: { actions: [] } })

    expect(wrapper.find('.oc-action-rail').exists()).toBe(true)
    expect(wrapper.findAll('.oc-action-button')).toHaveLength(0)
  })

  it('forwards size, icon size and variant to every action button', () => {
    const wrapper = mount(OcActionRail, {
      props: {
        actions: [{ key: 'open', icon: 'action.play', title: 'Open' }],
        size: 'lg',
        iconSize: 'display',
        variant: 'solid',
      },
    })

    const button = wrapper.get('.oc-action-button button')
    expect(button.classes()).toContain('oc-button--size-lg')
    expect(button.classes()).toContain('oc-button--variant-solid')
    expect(wrapper.get('.oc-button__icon').classes()).toContain('oc-icon--display')
  })

  it('re-emits the key of the clicked action without touching the others', async () => {
    const wrapper = mount(OcActionRail, {
      props: {
        actions: [
          { key: 'open', title: 'Open' },
          { key: 'save', title: 'Save' },
        ],
      },
    })

    await wrapper.findAll('.oc-action-button button')[1].trigger('click')

    expect(wrapper.emitted('select')).toEqual([[{ key: 'save' }]])
  })

  it('keeps a disabled action inert', async () => {
    const wrapper = mount(OcActionRail, {
      props: {
        actions: [
          { key: 'open', title: 'Open', disabled: true, disabledReason: 'No project open' },
          { key: 'save', title: 'Save' },
        ],
      },
    })

    const disabled = wrapper.findAll('.oc-action-button')[0]
    expect(disabled.classes()).toContain('is-disabled')
    expect(disabled.get('button').attributes('disabled')).toBeDefined()
    expect(disabled.get('button').attributes('aria-label')).toBe('Open: No project open')

    disabled.get('button').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('select')).toBeUndefined()
  })
})
