import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OcButton from '../base/OcButton.vue'
import OcViewportControls from '../standard/OcViewportControls.vue'
import ProjectIconCropEditor from './ProjectIconCropEditor.vue'

const labels = { lt: 'lt', t: 't', rt: 'rt', r: 'r', rb: 'rb', b: 'b', lb: 'lb', l: 'l' } as const
const runtime = {
  name: 'Status icons', key: 'status', source: 'status.png', src: 'asset://status', imageWidth: 100, imageHeight: 50,
}
const icon = { iconKey: 'one', name: 'One', x: 10, y: 10, width: 20, height: 10 }

describe('ProjectIconCropEditor', () => {
  let animationFrames: FrameRequestCallback[]

  class ResizeObserverMock {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element): void {
      this.callback([{
        target,
        contentRect: { width: 400, height: 300 },
      } as ResizeObserverEntry], this as unknown as ResizeObserver)
    }
    disconnect(): void {}
  }

  beforeEach(() => {
    animationFrames = []
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => vi.unstubAllGlobals())

  async function flushAnimation(): Promise<void> {
    for (let index = 0; index < 100 && animationFrames.length > 0; index += 1) {
      animationFrames.shift()?.(index * 16)
    }
    await nextTick()
  }

  it('moves the crop through the center interaction and exposes eight resize handles', async () => {
    const wrapper = mount(ProjectIconCropEditor, {
      props: { runtime, icon, alt: 'Status', moveLabel: 'Move', handleLabels: labels, pixelatedLabel: 'Pixelated', gridLabel: 'Show grid' },
    })
    const media = wrapper.get('.project-icon-crop-editor__media').element as HTMLElement
    media.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100,
      toJSON: () => ({}),
    })
    expect(wrapper.findAll('.project-icon-crop-editor__handle')).toHaveLength(8)

    wrapper.get('.project-icon-crop-editor__selection').element.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 20, clientY: 20, bubbles: true }),
    )
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 40, clientY: 30 }))
    expect(wrapper.emitted('update:icon')).toBeUndefined()
    window.dispatchEvent(new PointerEvent('pointerup'))
    const updates = wrapper.emitted('update:icon') ?? []
    expect(updates[updates.length - 1]?.[0]).toMatchObject({ x: 20, y: 15, width: 20, height: 10 })
    wrapper.unmount()
  })

  it('resizes from an edge handle in natural image pixels', async () => {
    const wrapper = mount(ProjectIconCropEditor, {
      props: { runtime, icon, alt: 'Status', moveLabel: 'Move', handleLabels: labels, pixelatedLabel: 'Pixelated', gridLabel: 'Show grid' },
    })
    const media = wrapper.get('.project-icon-crop-editor__media').element as HTMLElement
    media.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100,
      toJSON: () => ({}),
    })
    wrapper.get('.project-icon-crop-editor__handle--r').element.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 60, clientY: 30, bubbles: true }),
    )
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 80, clientY: 30 }))
    window.dispatchEvent(new PointerEvent('pointerup'))
    const updates = wrapper.emitted('update:icon') ?? []
    expect(updates[updates.length - 1]?.[0]).toMatchObject({ x: 10, y: 10, width: 30, height: 10 })
    wrapper.unmount()
  })

  it('snaps movement and resizing to non-divisible grid boundaries', async () => {
    const wrapper = mount(ProjectIconCropEditor, {
      props: {
        runtime: { ...runtime, imageWidth: 101 },
        icon: { ...icon, x: 0, width: 25 },
        alt: 'Status', moveLabel: 'Move', handleLabels: labels, pixelatedLabel: 'Pixelated', gridLabel: 'Show grid',
        snapToGrid: true, gridRows: 2, gridColumns: 4,
      },
    })
    const media = wrapper.get('.project-icon-crop-editor__media').element as HTMLElement
    media.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 202, bottom: 100, width: 202, height: 100,
      toJSON: () => ({}),
    })
    const columnLines = wrapper.findAll('.project-icon-crop-editor__grid-line--column')
    const rowLines = wrapper.findAll('.project-icon-crop-editor__grid-line--row')
    expect(columnLines).toHaveLength(3)
    expect(rowLines).toHaveLength(1)
    const firstColumnStyle = columnLines[0]!.attributes('style') ?? ''
    const firstRowStyle = rowLines[0]!.attributes('style') ?? ''
    expect(parseFloat(firstColumnStyle.match(/left:\s*([^%;]+)/)?.[1] ?? '')).toBeCloseTo(25 / 101 * 100)
    expect(parseFloat(firstRowStyle.match(/top:\s*([^%;]+)/)?.[1] ?? '')).toBeCloseTo(50)

    wrapper.get('.project-icon-crop-editor__selection').element.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 0, clientY: 20, bubbles: true }),
    )
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 44, clientY: 20 }))
    window.dispatchEvent(new PointerEvent('pointerup'))
    let updates = wrapper.emitted('update:icon') ?? []
    expect(updates[updates.length - 1]?.[0]).toMatchObject({ x: 25, width: 25 })

    wrapper.get('.project-icon-crop-editor__handle--r').element.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 50, clientY: 20, bubbles: true }),
    )
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 96, clientY: 20 }))
    window.dispatchEvent(new PointerEvent('pointerup'))
    updates = wrapper.emitted('update:icon') ?? []
    expect(updates[updates.length - 1]?.[0]).toMatchObject({ x: 0, width: 50 })
    wrapper.unmount()
  })

  it('toggles the grid overlay independently while snapping is disabled', async () => {
    const wrapper = mount(ProjectIconCropEditor, {
      props: { runtime, icon, alt: 'Status', moveLabel: 'Move', handleLabels: labels, pixelatedLabel: 'Pixelated', gridLabel: 'Show grid' },
    })
    expect(wrapper.find('.project-icon-crop-editor__grid').exists()).toBe(true)
    const gridButton = wrapper.findAllComponents(OcButton)
      .find(candidate => candidate.attributes('aria-label') === 'Show grid')!
    expect(gridButton.props('icon')).toBe('tool.grid')
    const toggle = wrapper.get('button[aria-label="Show grid"]')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    await toggle.trigger('click')
    expect(wrapper.find('.project-icon-crop-editor__grid').exists()).toBe(false)
    expect(toggle.attributes('aria-pressed')).toBe('false')
    expect(gridButton.props('icon')).toBe('tool.grid-off')
  })

  it('uses pixelated sampling and exposes the display toggle in the viewport toolbar', async () => {
    const wrapper = mount(ProjectIconCropEditor, {
      props: {
        runtime, icon, alt: 'Status', moveLabel: 'Move', handleLabels: labels,
        pixelatedLabel: 'Pixelated', gridLabel: 'Show grid', pixelated: true,
      },
    })
    expect(wrapper.get('.project-icon-crop-editor__media').classes()).toContain('is-pixelated')
    expect(wrapper.get('.project-icon-crop-editor__viewport-toolbar').classes()).toContain('oc-overlay-toolbar--vertical')
    const toggle = wrapper.get('.project-icon-crop-editor__viewport-toolbar button[aria-label="Pixelated"]')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    await toggle.trigger('click')
    expect(wrapper.emitted('update:pixelated')).toEqual([[false]])
  })

  it('fits the atlas, zooms around the pointer, and pans with the middle button', async () => {
    const wrapper = mount(ProjectIconCropEditor, {
      props: { runtime, icon, alt: 'Status', moveLabel: 'Move', handleLabels: labels, pixelatedLabel: 'Pixelated', gridLabel: 'Show grid' },
    })
    await nextTick()
    expect(wrapper.findComponent(OcViewportControls).exists()).toBe(true)
    const viewport = wrapper.get('.project-icon-crop-editor').element as HTMLElement
    viewport.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300,
      toJSON: () => ({}),
    })
    const api = wrapper.vm as unknown as {
      getViewportTransform(): { x: number; y: number; scale: number }
    }
    const anchor = { x: 120, y: 90 }
    const before = api.getViewportTransform()
    const worldX = (anchor.x - (400 - runtime.imageWidth * before.scale) / 2 - before.x) / before.scale
    const worldY = (anchor.y - (300 - runtime.imageHeight * before.scale) / 2 - before.y) / before.scale

    viewport.dispatchEvent(new WheelEvent('wheel', {
      clientX: anchor.x, clientY: anchor.y, deltaY: -120, deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      bubbles: true,
    }))
    await flushAnimation()
    const zoomed = api.getViewportTransform()
    expect(zoomed.scale).toBeGreaterThan(before.scale)
    expect((anchor.x - (400 - runtime.imageWidth * zoomed.scale) / 2 - zoomed.x) / zoomed.scale)
      .toBeCloseTo(worldX, 4)
    expect((anchor.y - (300 - runtime.imageHeight * zoomed.scale) / 2 - zoomed.y) / zoomed.scale)
      .toBeCloseTo(worldY, 4)

    viewport.dispatchEvent(new MouseEvent('mousedown', {
      button: 1, clientX: 100, clientY: 100, bubbles: true,
    }))
    viewport.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 130, clientY: 80, bubbles: true,
    }))
    const panned = api.getViewportTransform()
    expect(panned).toMatchObject({
      x: zoomed.x + 30,
      y: zoomed.y - 20,
      scale: zoomed.scale,
    })
    viewport.dispatchEvent(new MouseEvent('mouseup', { button: 1, bubbles: true }))
    wrapper.unmount()
  })
})
