import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ShellTitleBar from './ShellTitleBar.vue'

describe('ShellTitleBar', () => {
  it('does not emit disabled menu actions', async () => {
    const wrapper = mount(ShellTitleBar, {
      props: {
        collapsed: false,
        brandLabel: 'OpenCard',
        menuGroups: [{
          key: 'file',
          label: 'File',
          items: [
            { key: 'open-project', label: 'Open Project' },
            { key: 'close-project-folder', label: 'Close Project Folder', disabled: true },
          ],
        }],
      },
    })

    await wrapper.get('.titlebar-menu-button').trigger('click')
    const items = wrapper.findAll('.titlebar-menu-item')
    expect(items[1]?.attributes('disabled')).toBeDefined()

    await items[1]!.trigger('click')
    expect(wrapper.emitted('menu-action')).toBeUndefined()

    await items[0]!.trigger('click')
    expect(wrapper.emitted('menu-action')).toEqual([['file', 'open-project']])
  })
})
