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
})
