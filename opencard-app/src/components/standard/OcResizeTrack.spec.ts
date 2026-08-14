import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcResizeTrack from './OcResizeTrack.vue'

describe('OcResizeTrack', () => {
  it('keeps the separator handle inside a shared centered track and forwards double-click intent', async () => {
    const wrapper = mount(OcResizeTrack, {
      props: {
        minimum: 0,
        maximum: 600,
        value: 280,
        label: 'Resize panel',
        tooltip: 'Resize panel[br]Double-click to toggle',
        edge: 'top',
        placement: 'outside',
      },
    })

    expect(wrapper.classes()).toContain('oc-resize-track--horizontal')
    expect(wrapper.classes()).toContain('oc-resize-track--edge-top')
    expect(wrapper.classes()).toContain('oc-resize-track--placement-outside')
    expect(wrapper.get('[role="separator"]').attributes('aria-valuenow')).toBe('280')
    expect(wrapper.get('[role="separator"]').attributes('data-tooltip'))
      .toBe('Resize panel[br]Double-click to toggle')

    await wrapper.trigger('dblclick')
    expect(wrapper.emitted('double-click')).toHaveLength(1)
  })
})
