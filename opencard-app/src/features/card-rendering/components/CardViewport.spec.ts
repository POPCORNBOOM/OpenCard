import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RenderReadyCardFace } from '../render.types'
import CardViewport from './CardViewport.vue'

const face: RenderReadyCardFace = {
  type: 'card-face',
  id: 'test-face',
  faceKey: 'front',
  width: 630,
  height: 880,
  background: '#ffffff',
  children: [],
}

class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element): void {
    Object.defineProperties(target, {
      clientWidth: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 800 },
    })
    this.callback([{
      target,
      contentRect: { width: 1000, height: 800 },
    } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }

  disconnect(): void {}
}

describe('CardViewport wheel zoom API', () => {
  let animationFrames: FrameRequestCallback[]

  beforeEach(() => {
    animationFrames = []
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      animationFrames.push(callback)
      return animationFrames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function flushAnimation(): Promise<void> {
    for (let index = 0; index < 100 && animationFrames.length > 0; index += 1) {
      animationFrames.shift()?.(index * 16)
    }
    await nextTick()
  }

  it('zooms in around the supplied viewport anchor', async () => {
    const wrapper = mount(CardViewport, {
      props: { face },
      global: { stubs: { CardFaceRenderer: true } },
    })
    const viewport = wrapper.vm as unknown as {
      zoomByWheelAt(deltaY: number, deltaMode: number, viewportX: number, viewportY: number): void
    }
    const anchorX = 250
    const anchorY = 200
    const initialWorldX = anchorX - (1000 - face.width) / 2
    const initialWorldY = anchorY - (800 - face.height) / 2

    viewport.zoomByWheelAt(-120, WheelEvent.DOM_DELTA_PIXEL, anchorX, anchorY)
    await flushAnimation()
    const zoomEvents = wrapper.emitted('viewport-transform-change') ?? []
    const zoomedIn = zoomEvents[zoomEvents.length - 1]?.[0] as {
      x: number
      y: number
      scale: number
    }
    expect(zoomedIn.scale).toBeGreaterThan(1)
    const zoomedWorldX = (
      anchorX - (1000 - face.width * zoomedIn.scale) / 2 - zoomedIn.x
    ) / zoomedIn.scale
    const zoomedWorldY = (
      anchorY - (800 - face.height * zoomedIn.scale) / 2 - zoomedIn.y
    ) / zoomedIn.scale
    expect(zoomedWorldX).toBeCloseTo(initialWorldX, 4)
    expect(zoomedWorldY).toBeCloseTo(initialWorldY, 4)
  })

  it('forwards face clipping to the face renderer', () => {
    const wrapper = mount(CardViewport, {
      props: { face, clipToFace: true },
    })

    expect(wrapper.find('.card-canvas').classes()).toContain('card-canvas--clipped')
  })

  it('anchors supplemental information to the top-right of the face', () => {
    const wrapper = mount(CardViewport, {
      props: { face },
      slots: {
        info: '<div data-test="face-info">Details</div>',
        'left-info': '<div data-test="height-info">Height</div>',
        'bottom-info': '<div data-test="width-info">Width</div>',
      },
      global: { stubs: { CardFaceRenderer: true } },
    })

    const info = wrapper.find('.card-viewport-info')
    expect(info.exists()).toBe(true)
    expect(info.attributes('style')).toContain(`left: ${face.width + 16}px`)
    expect(info.find('[data-test="face-info"]').text()).toBe('Details')
    expect(wrapper.find('.card-viewport-left-info').attributes('style'))
      .toContain(`top: ${face.height / 2}px`)
    expect(wrapper.find('[data-test="height-info"]').text()).toBe('Height')
    expect(wrapper.find('.card-viewport-bottom-info').attributes('style'))
      .toContain(`left: ${face.width / 2}px`)
    expect(wrapper.find('[data-test="width-info"]').text()).toBe('Width')
  })
})
