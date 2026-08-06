import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import enUS from '../../locales/en-US'
import ImagePreviewEditor from './ImagePreviewEditor.vue'

vi.mock('../../features/workspace/store/projectStore', () => ({
  useProjectStore: () => ({
    resolveAssetSrc: (path: string) => `asset://${path}`,
  }),
}))

class ResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(): void {
    this.callback([{
      contentRect: {
        width: 800,
        height: 600,
      },
    } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }

  disconnect(): void {}
}

async function dispatchPointer(
  element: HTMLElement,
  type: string,
  values: Record<string, number>,
): Promise<void> {
  const event = new Event(type, { bubbles: true, cancelable: true })
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(event, key, { value })
  }
  element.dispatchEvent(event)
  await nextTick()
}

describe('ImagePreviewEditor', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses fit-to-window as scale 1 and emits keyboard pan transforms', async () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
    const wrapper = mount(ImagePreviewEditor, {
      props: { filePath: 'assets/example.png' },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      },
    })
    const image = wrapper.get('img').element as HTMLImageElement
    Object.defineProperty(image, 'naturalWidth', { value: 1000 })
    Object.defineProperty(image, 'naturalHeight', { value: 500 })
    await wrapper.get('img').trigger('load')

    expect(wrapper.get('.oc-viewport-controls__scale').text()).toBe('77%')
    expect(wrapper.get('.image-preview-editor__image').classes()).not.toContain('is-pixelated')

    const pixelatedToggle = wrapper.get('button[aria-label="Pixelated"]')
    expect(pixelatedToggle.attributes('aria-pressed')).toBe('false')
    await pixelatedToggle.trigger('click')
    expect(wrapper.emitted('update:pixelated')).toEqual([[true]])

    await wrapper.setProps({ pixelated: true })
    expect(wrapper.get('.image-preview-editor__image').classes()).toContain('is-pixelated')
    expect(pixelatedToggle.attributes('aria-pressed')).toBe('true')

    await wrapper.get('.image-preview-editor').trigger('keydown', { key: 'ArrowLeft' })
    const panEmits = wrapper.emitted('update-viewport-transform') ?? []
    expect(panEmits[panEmits.length - 1]).toEqual([{
      x: 32,
      y: 0,
      scale: 1,
    }])

    await wrapper.get('[aria-label="适应窗口"]').trigger('click')
    const resetEmits = wrapper.emitted('update-viewport-transform') ?? []
    expect(resetEmits[resetEmits.length - 1]).toEqual([{
      x: 0,
      y: 0,
      scale: 1,
    }])

    const viewport = wrapper.get<HTMLElement>('.image-preview-editor')
    Object.defineProperties(viewport.element, {
      setPointerCapture: { value: vi.fn() },
      hasPointerCapture: { value: vi.fn(() => true) },
      releasePointerCapture: { value: vi.fn() },
    })
    await dispatchPointer(viewport.element, 'pointerdown', { button: 0, pointerId: 7, clientX: 100, clientY: 100 })
    await dispatchPointer(viewport.element, 'pointermove', { pointerId: 7, clientX: 130, clientY: 120 })
    await dispatchPointer(viewport.element, 'pointerup', { pointerId: 7, clientX: 130, clientY: 120 })

    const dragEmits = wrapper.emitted('update-viewport-transform') ?? []
    expect(dragEmits[dragEmits.length - 1]).toEqual([{
      x: 30,
      y: 20,
      scale: 1,
    }])
  })
})
