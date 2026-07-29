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

  it('renders workspace actions and emits their key to the Shell owner', async () => {
    const wrapper = mount(ShellWorkspaceFrame, {
      props: {
        title: 'Card',
        actions: [{
          key: 'card-designer.toggle-mode',
          icon: 'data.table',
          hoverTip: 'Switch to data table view',
        }],
      },
    })

    const action = wrapper.get('.workspace-action')
    expect(action.attributes('data-tooltip')).toBe('Switch to data table view')
    await action.trigger('click')
    expect(wrapper.emitted('action')).toEqual([['card-designer.toggle-mode']])
  })
})
