import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcToolButton from './OcToolButton.vue'

describe('OcToolButton', () => {
  it('emits click and renders the label', async () => {
    const wrapper = mount(OcToolButton, {
      props: {
        label: 'File',
        kind: 'menu',
      },
    })

    expect(wrapper.text()).toContain('File')

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('maps active sidebar state to the tool-button class', () => {
    const wrapper = mount(OcToolButton, {
      props: {
        iconOnly: true,
        active: true,
        kind: 'sidebar',
        ariaLabel: 'Files',
      },
      slots: {
        default: '<span>F</span>',
      },
    })

    expect(wrapper.classes()).toContain('oc-tool-button--sidebar')
    expect(wrapper.classes()).toContain('is-active')
    expect(wrapper.attributes('aria-label')).toBe('Files')
  })

  it('keeps icon-only buttons accessible through aria-label fallback', () => {
    const wrapper = mount(OcToolButton, {
      props: {
        iconOnly: true,
        kind: 'panel',
        label: 'Sort by category',
        icon: 'icon.list-tree',
      },
    })

    expect(wrapper.attributes('aria-label')).toBe('Sort by category')
  })

  it('supports icon and iconTone combination in default content path', () => {
    const wrapper = mount(OcToolButton, {
      props: {
        kind: 'menu',
        label: 'Warn',
        icon: 'icon.warning',
        iconTone: 'warning',
      },
    })

    const icon = wrapper.findComponent({ name: 'OcIcon' })
    expect(icon.exists()).toBe(true)
    expect(icon.props('tone')).toBe('warning')
  })

  it('keeps icon-only contract compatible when iconTone is provided', () => {
    const wrapper = mount(OcToolButton, {
      props: {
        iconOnly: true,
        kind: 'panel',
        label: 'Delete',
        icon: 'icon.warning',
        iconTone: 'danger',
      },
    })

    const icon = wrapper.findComponent({ name: 'OcIcon' })
    expect(icon.exists()).toBe(true)
    expect(icon.props('tone')).toBe('danger')
    expect(wrapper.classes()).toContain('is-icon-only')
    expect(wrapper.attributes('aria-label')).toBe('Delete')
  })

  it('maps sidebar sizing semantics through classes', () => {
    const wrapper = mount(OcToolButton, {
      props: {
        iconOnly: true,
        kind: 'sidebar',
        size: 'lg',
        ariaLabel: 'Files',
      },
    })

    expect(wrapper.classes()).toContain('oc-tool-button--sidebar')
    expect(wrapper.classes()).toContain('oc-tool-button--size-lg')
    expect(wrapper.classes()).toContain('is-block')
  })
})
