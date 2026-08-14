import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcFloatingLayer from './OcFloatingLayer.vue'

describe('OcFloatingLayer', () => {
  it('owns the fade transition used by shared floating surfaces', () => {
    const anchor = document.createElement('button')
    const wrapper = mount(OcFloatingLayer, {
      props: { open: true, anchor },
      global: { stubs: { teleport: true } },
    })

    const transition = wrapper.get('transition-stub')
    expect(transition.attributes('name')).toBe('oc-floating-layer-fade')
    expect(transition.attributes()).toHaveProperty('appear')
  })
})
