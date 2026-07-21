import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./features/shell/OpenCardShell.vue', () => ({
  default: defineComponent({
    name: 'MockOpenCardShell',
    setup() {
      return () => h('div', 'SHELL VIEW')
    },
  }),
}))

import App from './App.vue'

function setView(view: string) {
  window.history.replaceState({}, '', `/?view=${view}`)
}

describe('App entry view', () => {
  it('ignores removed view routing and always renders the OpenCard shell', () => {
    setView('ui-gallery')

    const wrapper = mount(App)

    expect(wrapper.text()).toContain('SHELL VIEW')
  })
})
