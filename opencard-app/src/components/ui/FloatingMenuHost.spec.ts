import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFloatingMenu } from '../../composables/useFloatingMenu'
import FloatingMenuHost from './FloatingMenuHost.vue'

describe('FloatingMenuHost pointer dismissal', () => {
  afterEach(() => {
    useFloatingMenu().closeMenu()
    vi.useRealTimers()
  })

  it('closes after the pointer moves beyond the menu safety distance', async () => {
    vi.useFakeTimers()
    const wrapper = mount(FloatingMenuHost, { attachTo: document.body })
    const menu = useFloatingMenu()
    menu.openMenu({
      anchor: new DOMRect(10, 10, 0, 0),
      items: [{ key: 'rename', title: 'Rename' }],
    })
    await nextTick()

    const surface = document.querySelector<HTMLElement>('.floating-menu-surface')!
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(10, 10, 120, 80),
    )
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 300, clientY: 300 }))
    vi.advanceTimersByTime(181)

    expect(menu.state.value.isOpen).toBe(false)
    wrapper.unmount()
  })

  it('cancels pending dismissal when the pointer returns near the menu', async () => {
    vi.useFakeTimers()
    const wrapper = mount(FloatingMenuHost, { attachTo: document.body })
    const menu = useFloatingMenu()
    menu.openMenu({
      anchor: new DOMRect(10, 10, 0, 0),
      items: [{ key: 'rename', title: 'Rename' }],
    })
    await nextTick()

    const surface = document.querySelector<HTMLElement>('.floating-menu-surface')!
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(10, 10, 120, 80),
    )
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 300, clientY: 300 }))
    vi.advanceTimersByTime(100)
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 132, clientY: 50 }))
    vi.advanceTimersByTime(100)

    expect(menu.state.value.isOpen).toBe(true)
    wrapper.unmount()
  })
})
