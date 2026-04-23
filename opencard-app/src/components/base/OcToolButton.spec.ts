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
        icon: 'codicon-list-tree',
      },
    })

    expect(wrapper.attributes('aria-label')).toBe('Sort by category')
  })

  it('applies size props through inline style', () => {
    const wrapper = mount(OcToolButton, {
      props: {
        iconOnly: true,
        kind: 'sidebar',
        ariaLabel: 'Files',
        width: '100%',
        height: '56px',
      },
    })

    expect(wrapper.attributes('style')).toContain('width: 100%;')
    expect(wrapper.attributes('style')).toContain('height: 56px;')
  })
})
