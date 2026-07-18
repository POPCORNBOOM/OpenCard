import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./views/MainIDE.vue', () => ({
  default: defineComponent({
    name: 'MockMainIDE',
    setup() {
      return () => h('div', 'IDE VIEW')
    },
  }),
}))

import App from './App.vue'

function setView(view: string) {
  window.history.replaceState({}, '', `/?view=${view}`)
}

describe('App entry view', () => {
  it('ignores removed view routing and always renders the IDE', () => {
    setView('ui-gallery')

    const wrapper = mount(App)

    expect(wrapper.text()).toContain('IDE VIEW')
  })
})
