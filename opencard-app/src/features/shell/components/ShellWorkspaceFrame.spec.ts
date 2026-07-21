import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ShellWorkspaceFrame from './ShellWorkspaceFrame.vue'

describe('ShellWorkspaceFrame', () => {
  it('renders only the controlled workspace content', () => {
    const wrapper = mount(ShellWorkspaceFrame, {
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
