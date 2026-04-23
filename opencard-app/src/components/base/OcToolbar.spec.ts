import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcToolbar from './OcToolbar.vue'

describe('OcToolbar', () => {
  it('renders toolbar semantics', () => {
    const wrapper = mount(OcToolbar, {
      props: {
        ariaLabel: 'Main toolbar',
      },
      slots: {
        default: '<button>Action</button>',
      },
    })

    expect(wrapper.attributes('role')).toBe('toolbar')
    expect(wrapper.attributes('aria-orientation')).toBe('horizontal')
    expect(wrapper.attributes('aria-label')).toBe('Main toolbar')
  })

  it('supports sidebar vertical layout', () => {
    const wrapper = mount(OcToolbar, {
      props: {
        kind: 'sidebar',
      },
      slots: {
        default: '<button>Action</button>',
      },
    })

    expect(wrapper.classes()).toContain('oc-toolbar--sidebar')
    expect(wrapper.classes()).toContain('oc-toolbar--vertical')
  })

  it('supports layout props for growth, alignment and spacing', () => {
    const wrapper = mount(OcToolbar, {
      props: {
        kind: 'menu',
        grow: true,
        shrink: false,
        align: 'center',
        justify: 'between',
        gap: '6px',
        padding: '4px 8px',
      },
    })

    expect(wrapper.classes()).toContain('is-grow')
    expect(wrapper.classes()).toContain('is-no-shrink')
    expect(wrapper.classes()).toContain('oc-toolbar--align-center')
    expect(wrapper.classes()).toContain('oc-toolbar--justify-between')
    expect(wrapper.attributes('style')).toContain('--oc-toolbar-gap: 6px;')
    expect(wrapper.attributes('style')).toContain('--oc-toolbar-padding: 4px 8px;')
  })
})
