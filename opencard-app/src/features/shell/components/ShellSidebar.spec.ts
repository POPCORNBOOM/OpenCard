import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ShellSidebar from './ShellSidebar.vue'

describe('ShellSidebar list actions', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('emits the selected child key from a list action submenu', async () => {
    const wrapper = mount(ShellSidebar, {
      attachTo: document.body,
      props: {
        collapsed: false,
        width: 260,
        headButtons: [],
        tailButtons: [],
        bodyLists: [{
          key: 'project-files',
          title: 'Files',
          placeholder: 'Empty',
          actions: [{
            key: 'project.new-file',
            icon: 'action.file-plus',
            hoverTip: 'New File',
            children: [
              { key: 'project.new-file.opencard', title: 'OpenCard (.opencard)' },
              { key: 'project.new-file.opencardproject', title: 'Project Interpretation' },
            ],
          }],
        }],
      },
    })

    await wrapper.get('button[aria-label="New File"]').trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLButtonElement>(
      '.oc-action-menu__button[title="OpenCard (.opencard)"]',
    )?.click()
    await flushPromises()

    expect(wrapper.emitted('list-button-clicked')).toEqual([[
      'project-files',
      'project.new-file.opencard',
    ]])
  })
})
