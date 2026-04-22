import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcIcon from './OcIcon.vue'

describe('OcIcon', () => {
  it('renders codicon name and size class', () => {
    const wrapper = mount(OcIcon, {
      props: {
        name: 'codicon-folder',
        size: 'lg',
      },
    })

    expect(wrapper.classes()).toContain('codicon-folder')
    expect(wrapper.classes()).toContain('oc-icon--lg')
  })

  it('maps tone to semantic icon token color', () => {
    const wrapper = mount(OcIcon, {
      props: {
        name: 'codicon-warning',
        tone: 'warning',
      },
    })

    const style = wrapper.attributes('style')
    expect(style).toContain('var(--icon-warning)')
  })
})
