import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorViewportTransform } from '../editor-runtime/model/editorUiState'
import {
  useCdeViewportController,
  type CdeViewportPort,
} from './useCdeViewportController'

type ViewportController = ReturnType<typeof useCdeViewportController>

let resizeCallback: ResizeObserverCallback
const observe = vi.fn()
const unobserve = vi.fn()
const disconnect = vi.fn()

beforeEach(() => {
  observe.mockReset()
  unobserve.mockReset()
  disconnect.mockReset()
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) {
      resizeCallback = callback
    }
    observe = observe
    unobserve = unobserve
    disconnect = disconnect
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function rect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }
}

function createHarness(initialFaceSize: { width: number; height: number } | null = {
  width: 400,
  height: 200,
}) {
  const faceSize = ref(initialFaceSize)
  const leftSidebarElement = ref<HTMLElement | null>(null)
  const rightSidebarElement = ref<HTMLElement | null>(null)
  const zoomBy = vi.fn()
  const zoomByWheelAt = vi.fn()
  const fitView = vi.fn()
  const viewportPort = ref<CdeViewportPort | null>({ zoomBy, zoomByWheelAt, fitView })
  const commits: EditorViewportTransform[] = []
  let controller!: ViewportController

  const Host = defineComponent({
    setup() {
      controller = useCdeViewportController({
        faceSize,
        viewportPort,
        leftSidebarElement,
        rightSidebarElement,
        commitTransform: transform => commits.push(transform),
      })
      return () => h('main', [
        h('aside', { ref: leftSidebarElement }),
        h('div', { ref: controller.centerSpacerRef }),
        h('aside', { ref: rightSidebarElement }),
        h('div', { ref: controller.transformPreviewHostRef }, [
          h('div', { ref: controller.transformPreviewViewportRef }),
        ]),
      ])
    },
  })

  const wrapper = mount(Host)
  return {
    commits,
    controller,
    faceSize,
    fitView,
    leftSidebarElement,
    rightSidebarElement,
    viewportPort,
    wrapper,
    zoomBy,
    zoomByWheelAt,
  }
}

function resizeHost(host: HTMLElement, width: number, height: number): void {
  resizeCallback([
    {
      target: host,
      contentRect: rect(0, 0, width, height),
    } as unknown as ResizeObserverEntry,
  ], {} as ResizeObserver)
}

describe('useCdeViewportController', () => {
  it('owns the transform and commits viewport and preview keyboard changes', () => {
    const { commits, controller, wrapper } = createHarness()

    controller.handleViewportTransformChange({ x: 20, y: -10, scale: 2 })
    expect(controller.viewportTransform.value).toEqual({ x: 20, y: -10, scale: 2 })
    expect(commits).toEqual([{ x: 20, y: -10, scale: 2 }])

    controller.handlePreviewViewportKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(commits[commits.length - 1]).toEqual({ x: 0, y: -10, scale: 2 })
    wrapper.unmount()
  })

  it('projects preview geometry from the single transform', () => {
    const { controller, wrapper } = createHarness()
    const host = controller.transformPreviewHostRef.value!
    resizeHost(host, 200, 100)
    controller.handleViewportSizeChange({ width: 100, height: 50 })

    expect(controller.transformPreviewRendererStyle.value.transform).toBe('scale(0.5)')
    expect(controller.transformPreviewViewportStyle.value).toEqual({ width: '200px', height: '100px' })
    expect(controller.transformPreviewFrameStyle.value).toEqual({
      left: '75px',
      top: '37.5px',
      width: '50px',
      height: '25px',
    })
    expect(controller.isTransformPreviewFrameVisible.value).toBe(true)
    wrapper.unmount()
  })

  it('maps preview wheel coordinates into viewport coordinates', () => {
    const { controller, wrapper, zoomByWheelAt } = createHarness()
    resizeHost(controller.transformPreviewHostRef.value!, 200, 100)
    controller.handleViewportSizeChange({ width: 100, height: 50 })
    vi.spyOn(controller.transformPreviewViewportRef.value!, 'getBoundingClientRect')
      .mockReturnValue(rect(0, 0, 200, 100))

    controller.handlePreviewViewportWheel(new WheelEvent('wheel', {
      clientX: 100,
      clientY: 50,
      deltaY: 12,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
    }))

    expect(zoomByWheelAt).toHaveBeenCalledWith(12, WheelEvent.DOM_DELTA_PIXEL, 50, 25)
    wrapper.unmount()
  })

  it('moves the viewport through preview pointer dragging', () => {
    const { commits, controller, wrapper } = createHarness()
    resizeHost(controller.transformPreviewHostRef.value!, 200, 100)
    controller.handleViewportTransformChange({ x: 20, y: 10, scale: 1 })
    const target = document.createElement('button')
    Object.assign(target, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
    })
    const pointer = (clientX: number, clientY: number) => ({
      button: 0,
      pointerId: 3,
      clientX,
      clientY,
      currentTarget: target,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }) as unknown as PointerEvent

    controller.startPreviewViewportDrag(pointer(10, 10))
    controller.handlePreviewViewportDrag(pointer(20, 15))

    expect(commits[commits.length - 1]).toEqual({ x: 0, y: 0, scale: 1 })
    expect(controller.isPreviewViewportDragging.value).toBe(true)
    controller.stopPreviewViewportDrag(pointer(20, 15))
    expect(controller.isPreviewViewportDragging.value).toBe(false)
    wrapper.unmount()
  })

  it('fits once only after file loading and required geometry are ready', async () => {
    const { controller, faceSize, fitView, wrapper } = createHarness()
    controller.prepareForFileChange()
    controller.handleViewportSizeChange({ width: 1000, height: 800 })
    await nextTick()
    expect(fitView).not.toHaveBeenCalled()

    controller.completeFileLoad()
    await nextTick()
    expect(fitView).toHaveBeenCalledTimes(1)

    faceSize.value = { width: 850, height: 540 }
    controller.handleViewportSizeChange({ width: 900, height: 700 })
    await nextTick()
    expect(fitView).toHaveBeenCalledTimes(1)

    controller.prepareForFileChange()
    faceSize.value = null
    controller.completeFileLoad()
    await nextTick()
    expect(fitView).toHaveBeenCalledTimes(1)
    faceSize.value = { width: 540, height: 850 }
    controller.handleViewportSizeChange({ width: 800, height: 600 })
    await nextTick()
    expect(fitView).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('fits inside the visible region and exposes semantic zoom commands', () => {
    const {
      controller,
      fitView,
      leftSidebarElement,
      rightSidebarElement,
      wrapper,
      zoomBy,
    } = createHarness()
    vi.spyOn(controller.centerSpacerRef.value!, 'getBoundingClientRect')
      .mockReturnValue(rect(100, 50, 800, 600))
    vi.spyOn(leftSidebarElement.value!, 'getBoundingClientRect')
      .mockReturnValue(rect(0, 0, 320, 700))
    vi.spyOn(rightSidebarElement.value!, 'getBoundingClientRect')
      .mockReturnValue(rect(680, 0, 320, 700))

    controller.fitViewport()
    controller.zoomViewportOut()
    controller.zoomViewportIn()

    expect(fitView).toHaveBeenCalledWith({ left: 320, top: 50, width: 360, height: 600 })
    expect(zoomBy.mock.calls).toEqual([[0.8], [1.25]])
    wrapper.unmount()
  })

  it('disconnects its preview ResizeObserver on unmount', () => {
    const { controller, wrapper } = createHarness()
    expect(observe).toHaveBeenCalledWith(controller.transformPreviewHostRef.value)
    wrapper.unmount()
    expect(disconnect).toHaveBeenCalledOnce()
  })
})
