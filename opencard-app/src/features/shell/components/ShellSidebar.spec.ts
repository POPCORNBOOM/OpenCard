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
      '.oc-action-menu__button[data-tooltip="OpenCard (.ocdocument)"]',
    )?.click()
    await flushPromises()

    expect(wrapper.emitted('list-button-clicked')).toEqual([[
      'project-files',
      'project.new-file.ocdocument',
    ]])
  })

  it('keeps bottom lists outside the scrolling project lists', async () => {
    const wrapper = mount(ShellSidebar, {
      props: {
        collapsed: false,
        width: 260,
        headButtons: [],
        tailButtons: [],
        bodyLists: [{
          key: 'project-files',
          title: 'Files',
          placeholder: 'No files',
          actions: [],
        }],
        bottomLists: [{
          key: 'changes',
          title: 'Changes',
          placeholder: 'No changes',
          actions: [],
          maxHeight: 'var(--oc-list-max-height-md)',
        }, {
          key: 'versions',
          title: 'Versions',
          placeholder: 'No versions',
          actions: [],
          maxHeight: 'var(--oc-list-max-height-md)',
        }],
      },
    })

    expect(wrapper.get('.shell-sidebar-body').text()).toContain('Files')
    expect(wrapper.get('.shell-sidebar-body').text()).not.toContain('Changes')
    expect(wrapper.get('.shell-sidebar-fixed').text()).toContain('Changes')
    expect(wrapper.get('.shell-sidebar-fixed').text()).toContain('Versions')

    const changes = wrapper.findAll('.shell-sidebar-fixed .shell-sidebar-list')[0]
    expect(changes.get('.shell-sidebar-list-content').attributes('style'))
      .toContain('max-height: var(--oc-list-max-height-md)')
    await changes.get('.shell-sidebar-list-toggle').trigger('click')
    expect(changes.get('.shell-sidebar-list-head').text()).toContain('Changes')
    expect(changes.get('.shell-sidebar-list-content-wrap').classes()).toContain('collapsed')
  })
})
