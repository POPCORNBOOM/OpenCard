import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ShellTitleBar from './ShellTitleBar.vue'

describe('ShellTitleBar', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('does not emit disabled menu actions', async () => {
    const wrapper = mount(ShellTitleBar, {
      attachTo: document.body,
      props: {
        collapsed: false,
        brandLabel: 'OpenCard',
        menuGroups: [{
          key: 'file',
          label: 'File',
          actions: [
            { key: 'open-project', title: 'Open Project' },
            { key: 'close-project-folder', title: 'Close Project Folder', disabled: true },
          ],
        }],
      },
    })

    await wrapper.get('.titlebar-menu-button').trigger('click')
    const items = document.body.querySelectorAll<HTMLButtonElement>('.oc-action-menu__button')
    expect(items[1]?.disabled).toBe(true)

    items[1]!.click()
    expect(wrapper.emitted('menu-action')).toBeUndefined()

    items[0]!.click()
    expect(wrapper.emitted('menu-action')).toEqual([['file', 'open-project']])
    wrapper.unmount()
  })

  it('switches menus on hover after a menu has been activated', async () => {
    const wrapper = mount(ShellTitleBar, {
      props: {
        collapsed: false,
        brandLabel: 'OpenCard',
        menuGroups: [
          { key: 'file', label: 'File', actions: [] },
          { key: 'edit', label: 'Edit', actions: [] },
        ],
      },
    })
    const menus = wrapper.findAll('.titlebar-menu')
    const buttons = wrapper.findAll('.titlebar-menu-button')

    await menus[1]!.trigger('pointerenter')
    expect(buttons[1]!.attributes('aria-expanded')).toBe('false')

    await buttons[0]!.trigger('click')
    await menus[1]!.trigger('pointerenter')

    expect(buttons[0]!.attributes('aria-expanded')).toBe('false')
    expect(buttons[1]!.attributes('aria-expanded')).toBe('true')
  })
})
