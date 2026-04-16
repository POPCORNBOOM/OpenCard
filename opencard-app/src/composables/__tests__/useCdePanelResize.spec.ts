import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCdePanelResize } from '../useCdePanelResize'

function setClientSize(element: HTMLElement, width: number, height: number) {
  Object.defineProperty(element, 'clientWidth', {
    value: width,
    configurable: true,
  })

  Object.defineProperty(element, 'clientHeight', {
    value: height,
    configurable: true,
  })
}

describe('useCdePanelResize', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('clamps info-tree absolute height during drag resize', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    const panelResize = useCdePanelResize()
    const editorRoot = document.createElement('div')
    const rightPanel = document.createElement('div')
    setClientSize(editorRoot, 1200, 800)
    setClientSize(rightPanel, 320, 500)

    panelResize.editorRootRef.value = editorRoot
    panelResize.rightPanelRef.value = rightPanel
    panelResize.mountPanelResizeListeners()

    panelResize.startTreePanelResize({ clientX: 0, clientY: 0 } as MouseEvent)
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: -1000 }))
    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(panelResize.editorStyle.value['--card-editor-tree-panel-height']).toBe('140px')

    panelResize.startTreePanelResize({ clientX: 0, clientY: 0 } as MouseEvent)
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 0, clientY: 1000 }))
    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(panelResize.editorStyle.value['--card-editor-tree-panel-height']).toBe('314px')

    panelResize.unmountPanelResizeListeners()
  })
})
