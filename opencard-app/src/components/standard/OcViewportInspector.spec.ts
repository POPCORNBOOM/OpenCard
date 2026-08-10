import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OcViewportInspector from './OcViewportInspector.vue'

const style = [
  '--oc-viewport-inspector-default-height: 240px',
  '--oc-viewport-inspector-min-height: 180px',
  '--oc-viewport-inspector-visible-min-height: 160px',
].join(';')

function rect(top: number, height: number): DOMRect {
  return {
    x: 0, y: top, left: 0, top, right: 800, bottom: top + height,
    width: 800, height, toJSON: () => ({}),
  } as DOMRect
}

async function mountInspector() {
  const wrapper = mount(OcViewportInspector, {
    props: {
      heading: 'Preview',
      actions: [{ key: 'reset', icon: 'action.discard', title: 'Reset' }],
      expanded: true,
      height: null,
      expandLabel: 'Expand',
      collapseLabel: 'Collapse',
      resizeLabel: 'Resize preview',
    },
    attrs: { style },
    slots: { default: '<div class="content">Content</div>' },
  })
  const root = wrapper.element as HTMLElement
  const container = root.parentElement as HTMLElement
  root.getBoundingClientRect = () => rect(360, 240)
  container.getBoundingClientRect = () => rect(0, 600)
  const handle = wrapper.get('[role="separator"]').element as HTMLElement
  Object.defineProperties(handle, {
    setPointerCapture: { value: () => undefined },
    hasPointerCapture: { value: () => false },
    releasePointerCapture: { value: () => undefined },
  })
  await wrapper.setProps({ expanded: false })
  await wrapper.setProps({ expanded: true })
  await nextTick()
  return { handle: wrapper.get('[role="separator"]'), wrapper }
}

afterEach(() => {
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  vi.unstubAllGlobals()
})

describe('OcViewportInspector', () => {
  it('combines business actions with a glass-card collapse action', async () => {
    const { wrapper } = await mountInspector()

    expect(wrapper.find('.oc-card--variant-glass').exists()).toBe(true)
    expect(wrapper.get('button[aria-label="Reset"]')).toBeTruthy()
    await wrapper.get('button[aria-label="Collapse"]').trigger('click')

    expect(wrapper.emitted('update:expanded')).toEqual([[false]])
  })

  it('keeps the outside handle mounted and toggles collapse from double click', async () => {
    const { wrapper } = await mountInspector()
    const track = wrapper.getComponent({ name: 'OcResizeTrack' })

    track.vm.$emit('double-click', new MouseEvent('dblclick'))
    expect(wrapper.emitted('update:expanded')).toContainEqual([false])

    await wrapper.setProps({ expanded: false })
    expect(wrapper.findComponent({ name: 'OcResizeTrack' }).exists()).toBe(true)
    expect(wrapper.getComponent({ name: 'OcResizeTrack' }).props('disabled')).toBe(true)
    expect(wrapper.getComponent({ name: 'OcCard' }).props('collapsed')).toBe(true)
    track.vm.$emit('double-click', new MouseEvent('dblclick'))
    expect(wrapper.emitted('update:expanded')).toContainEqual([true])
  })

  it('resizes upward with pointer capture and clamps to the visible viewport contract', async () => {
    const { handle, wrapper } = await mountInspector()

    handle.element.dispatchEvent(new PointerEvent('pointerdown', {
      button: 0, pointerId: 7, clientY: 360, bubbles: true,
    }))
    handle.element.dispatchEvent(new PointerEvent('pointermove', {
      pointerId: 7, clientY: 80, bubbles: true,
    }))
    await wrapper.vm.$nextTick()

    const updates = wrapper.emitted('update:height') ?? []
    expect(updates[updates.length - 1]).toEqual([440])
    expect(document.body.style.cursor).toBe('row-resize')

    handle.element.dispatchEvent(new PointerEvent('pointerup', {
      pointerId: 7, clientY: 80, bubbles: true,
    }))
    await wrapper.vm.$nextTick()
    expect(document.body.style.cursor).toBe('')
  })

  it('supports keyboard resizing with separator values', async () => {
    const { handle, wrapper } = await mountInspector()

    await handle.trigger('keydown', { key: 'ArrowDown' })
    const updates = wrapper.emitted('update:height') ?? []
    expect(updates[updates.length - 1]).toEqual([224])
    expect(handle.attributes('aria-valuemin')).toBe('180')
    expect(handle.attributes('aria-valuemax')).toBe('440')
  })

  it('updates occlusion when the inspector itself finishes collapsing', async () => {
    let callback: ResizeObserverCallback = () => undefined
    const observed: Element[] = []
    class ResizeObserverMock {
      constructor(next: ResizeObserverCallback) { callback = next }
      observe(target: Element): void { observed.push(target) }
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    const { wrapper } = await mountInspector()
    const root = wrapper.element as HTMLElement
    root.getBoundingClientRect = () => rect(566, 28)

    expect(observed).toContain(root)
    callback([], {} as ResizeObserver)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const updates = wrapper.emitted('occlusion-change') ?? []
    expect(updates[updates.length - 1]).toEqual([34])
  })
})
