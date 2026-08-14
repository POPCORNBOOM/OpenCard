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
              { key: 'project.new-file.ocdocument', title: 'OpenCard (.ocdocument)' },
              { key: 'project.new-file.ocproject', title: 'Project Configuration' },
            ],
          }],
        }],
      },
    })

    const action = wrapper.get('button[aria-label="New File"]')
    expect(action.classes()).toContain('oc-button')
    expect(action.element.parentElement?.classList).not.toContain('shell-sidebar-action')
    await action.trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLButtonElement>(
      '.oc-action-menu__button[aria-label="OpenCard (.ocdocument)"]',
    )?.click()
    await flushPromises()

    expect(wrapper.emitted('list-button-clicked')).toEqual([[
      'project-files',
      'project.new-file.ocdocument',
    ]])
  })

  it('uses the same medium icon size as sidebar trees for primary buttons', () => {
    const wrapper = mount(ShellSidebar, {
      props: {
        collapsed: false,
        width: 260,
        headButtons: [{ key: 'open', title: 'Open', icon: 'status.folder-open' }],
        tailButtons: [{ key: 'settings', title: 'Settings', icon: 'tool.settings' }],
        bodyLists: [],
      },
    })

    const icons = wrapper.findAll('.shell-sidebar-button .oc-icon')
    expect(icons).toHaveLength(2)
    expect(icons.every(icon => icon.classes().includes('oc-icon--md'))).toBe(true)
  })
})
