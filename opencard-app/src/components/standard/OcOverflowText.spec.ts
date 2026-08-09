import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OcOverflowText from './OcOverflowText.vue'

let resizeCallback: ResizeObserverCallback | null = null

class ResizeObserverStub {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback
  }
  observe = vi.fn()
  disconnect = vi.fn()
}

describe('OcOverflowText', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('scrolls by the measured overflow distance only while active', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    const wrapper = mount(OcOverflowText, {
      props: { text: 'A long completion title', active: false },
    })
    const viewport = wrapper.get('.oc-overflow-text').element as HTMLElement
    const content = wrapper.get('.oc-overflow-text__content').element as HTMLElement
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 80 })
    Object.defineProperty(content, 'scrollWidth', { configurable: true, value: 180 })
    resizeCallback?.([], {} as ResizeObserver)
    await nextTick()

    expect(viewport.classList).toContain('is-overflowing')
    expect(viewport.classList).not.toContain('is-scrolling')
    expect(viewport.style.getPropertyValue('--oc-overflow-text-distance')).toBe('100px')

    await wrapper.setProps({ active: true })
    expect(viewport.classList).toContain('is-scrolling')
  })
})
