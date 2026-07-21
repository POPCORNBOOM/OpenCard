import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import EzWorkspaceFrame from './EzWorkspaceFrame.vue'

describe('EzWorkspaceFrame', () => {
  it('renders only the controlled workspace content', () => {
    const wrapper = mount(EzWorkspaceFrame, {
      props: {
        title: 'Workspace',
        actions: [],
      },
      slots: { default: '<div class="workspace-content">Editor</div>' },
    })

    expect(wrapper.get('.workspace-content').text()).toBe('Editor')
    expect(wrapper.find('.workspace-bottom-panel').exists()).toBe(false)
  })
})
