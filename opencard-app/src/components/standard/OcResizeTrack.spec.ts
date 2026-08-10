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
      },
    })

    expect(wrapper.classes()).toContain('oc-resize-track--horizontal')
    expect(wrapper.get('[role="separator"]').attributes('aria-valuenow')).toBe('280')

    await wrapper.trigger('dblclick')
    expect(wrapper.emitted('double-click')).toHaveLength(1)
  })
})
