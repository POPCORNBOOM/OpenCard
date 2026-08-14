import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcPanel from './OcPanel.vue'
import panelSource from './OcPanel.vue?raw'

describe('OcPanel', () => {
  it('pairs the accent surface with its readable foreground', () => {
    const wrapper = mount(OcPanel, {
      props: { tone: 'accent' },
      slots: { default: 'Accent content' },
    })

    expect(wrapper.classes()).toContain('oc-panel--tone-accent')
    expect(panelSource).toContain(`.oc-panel--tone-accent {
  background-color: var(--oc-bg-accent);
  color: var(--oc-accent-fg);
}`)
  })
})
