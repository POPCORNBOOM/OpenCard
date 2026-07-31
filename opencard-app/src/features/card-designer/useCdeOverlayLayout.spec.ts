import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardDesignerLayoutState } from '../editor-runtime/model/editorUiState'
import { useCdeOverlayLayout } from './useCdeOverlayLayout'

type OverlayLayoutController = ReturnType<typeof useCdeOverlayLayout>

function createLayout(overrides: Partial<CardDesignerLayoutState> = {}): CardDesignerLayoutState {
  return {
    panels: {
      instanceExpanded: true,
      previewExpanded: true,
      structureExpanded: true,
      propertyExpanded: true,
    },
    leftTopHeight: null,
    rightTopHeight: null,
    ...overrides,
  }
}

function createHarness(initialLayout = createLayout()) {
  const layout = ref<CardDesignerLayoutState | undefined>(initialLayout)
  const commits: CardDesignerLayoutState[] = []
  let controller!: OverlayLayoutController
  const Host = defineComponent({
    setup() {
      const rootElement = ref<HTMLElement | null>(null)
      controller = useCdeOverlayLayout({
        layout,
        rootElement,
        commitLayout: value => commits.push(value),
      })
      return () => h('div', {
        ref: rootElement,
        style: controller.editorShellStyle.value,
      }, [
        h('aside', { ref: controller.leftSidebarRef }, [
          h('section', { class: 'card-design-editor__sidebar-panel' }),
        ]),
        h('aside', { ref: controller.rightSidebarRef }, [
          h('section', { class: 'card-design-editor__sidebar-panel' }),
        ]),
      ])
    },
  })
  const wrapper = mount(Host)
  return { commits, controller, layout, wrapper }
}

function mouseEvent(type: string, clientX = 0, clientY = 0): MouseEvent {
  return new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY })
}

let animationFrames: FrameRequestCallback[]

beforeEach(() => {
  animationFrames = []
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    animationFrames.push(callback)
    return animationFrames.length
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  vi.unstubAllGlobals()
})

function flushAnimationFrame(): void {
  animationFrames.shift()?.(0)
}

describe('useCdeOverlayLayout', () => {
  it('syncs persisted layout and emits complete snapshots for semantic commands', async () => {
    const { commits, controller, layout, wrapper } = createHarness(createLayout({
      panels: {
        instanceExpanded: false,
        previewExpanded: true,
        structureExpanded: false,
        propertyExpanded: false,
      },
      leftTopHeight: 100,
      rightTopHeight: 260,
    }))

    expect(controller.isInstancePanelExpanded.value).toBe(false)
    expect(controller.editorShellStyle.value['--card-editor-left-sidebar-rows']).toBe('auto minmax(0, 1fr)')

    controller.togglePanel('instance')
    expect(commits[commits.length - 1]).toEqual(createLayout({
      panels: {
        instanceExpanded: true,
        previewExpanded: true,
        structureExpanded: false,
        propertyExpanded: false,
      },
      leftTopHeight: 160,
      rightTopHeight: 260,
    }))

    expect(controller.ensurePanelsExpanded(['structure', 'property'])).toBe(true)
    expect(commits[commits.length - 1]?.panels).toMatchObject({
      structureExpanded: true,
      propertyExpanded: true,
    })

    layout.value = createLayout({ panels: { ...createLayout().panels, previewExpanded: false } })
    await wrapper.vm.$nextTick()
    expect(controller.isPreviewPanelExpanded.value).toBe(false)
    wrapper.unmount()
  })

  it('mirrors width dragging and snaps both sidebars at the collapse threshold', () => {
    const { controller, wrapper } = createHarness()
    const root = wrapper.element as HTMLElement

    controller.startOverlayResize('left', mouseEvent('mousedown', 0))
    document.dispatchEvent(mouseEvent('mousemove', -120))
    expect(root.style.getPropertyValue('--card-editor-left-sidebar-visible-width')).toBe('200px')
    document.dispatchEvent(mouseEvent('mouseup', -120))
    flushAnimationFrame()
    expect(root.style.getPropertyValue('--card-editor-left-sidebar-visible-width')).toBe('0px')

    controller.startOverlayResize('right', mouseEvent('mousedown', 0))
    document.dispatchEvent(mouseEvent('mousemove', 120))
    expect(root.style.getPropertyValue('--card-editor-right-sidebar-visible-width')).toBe('200px')
    document.dispatchEvent(mouseEvent('mouseup', 120))
    flushAnimationFrame()
    expect(root.style.getPropertyValue('--card-editor-right-sidebar-visible-width')).toBe('0px')

    controller.startOverlayResize('left', mouseEvent('mousedown', 0))
    document.dispatchEvent(mouseEvent('mouseup', 0))
    flushAnimationFrame()
    expect(root.style.getPropertyValue('--card-editor-left-sidebar-visible-width')).toBe('280px')
    wrapper.unmount()
  })

  it('allows stack resizing only while both panels on that side are expanded', () => {
    const { controller, wrapper } = createHarness()
    const sidebar = controller.leftSidebarRef.value!
    const topPanel = sidebar.querySelector('.card-design-editor__sidebar-panel') as HTMLElement
    vi.spyOn(sidebar, 'getBoundingClientRect').mockReturnValue({ height: 600 } as DOMRect)
    vi.spyOn(topPanel, 'getBoundingClientRect').mockReturnValue({ height: 240 } as DOMRect)

    controller.togglePanel('instance')
    controller.startSidebarResize('left', mouseEvent('mousedown', 0, 0))
    expect(controller.activeResizeTarget.value).toBeNull()

    controller.togglePanel('instance')
    controller.startSidebarResize('left', mouseEvent('mousedown', 0, 0))
    document.dispatchEvent(mouseEvent('mousemove', 0, 80))
    expect(controller.activeResizeTarget.value).toBe('left-stack')
    expect((wrapper.element as HTMLElement).style.getPropertyValue('--card-editor-left-sidebar-rows'))
      .toBe('320px 8px minmax(220px, 1fr)')
    document.dispatchEvent(mouseEvent('mouseup', 0, 80))
    wrapper.unmount()
  })

  it('restores global pointer state and removes listeners when disposed', () => {
    document.body.style.cursor = 'crosshair'
    document.body.style.userSelect = 'text'
    const { controller, wrapper } = createHarness()
    const root = wrapper.element as HTMLElement

    controller.startOverlayResize('left', mouseEvent('mousedown', 0))
    document.dispatchEvent(mouseEvent('mousemove', -120))
    expect(document.body.style.cursor).toBe('col-resize')
    expect(document.body.style.userSelect).toBe('none')
    wrapper.unmount()

    expect(document.body.style.cursor).toBe('crosshair')
    expect(document.body.style.userSelect).toBe('text')
    expect(cancelAnimationFrame).toHaveBeenCalled()
    document.dispatchEvent(mouseEvent('mousemove', -120))
    expect(root.style.getPropertyValue('--card-editor-left-sidebar-visible-width')).toBe('200px')
  })
})
