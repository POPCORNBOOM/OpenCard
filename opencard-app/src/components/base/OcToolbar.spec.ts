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
})
