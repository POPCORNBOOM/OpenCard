import { describe, expect, it } from 'vitest'
import { setupGlobalTooltip } from './globalTooltip'

const LAYER_SIZE = { width: 100, height: 30 }

function createRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect
}

function stubRect(element: Element, left: number, top: number, width: number, height: number): void {
  element.getBoundingClientRect = () => createRect(left, top, width, height)
}

describe('globalTooltip placement', () => {
  it('follows the declared side, flips when it does not fit, and stays inside the viewport', () => {
    document.body.innerHTML = `
      <button id="plain" data-tooltip="Plain">Plain</button>
      <button id="bogus" data-tooltip="Bogus" data-tooltip-placement="sideways">Bogus</button>
      <div id="rail" data-tooltip-placement="right"><button id="railed" data-tooltip="Rail">Rail</button></div>
      <div id="rows" data-tooltip-placement="top">
        <button id="rowed" data-tooltip="Row">Row</button>
        <button id="row-tight" data-tooltip="Row tight">Row tight</button>
      </div>
      <button id="edge-right" data-tooltip="Edge right" data-tooltip-placement="right">Edge right</button>
      <button id="edge-bottom" data-tooltip="Edge bottom" data-tooltip-placement="bottom">Edge bottom</button>
    `
    setupGlobalTooltip()

    const layer = document.getElementById('oc-tooltip-layer') as HTMLDivElement
    stubRect(layer, 0, 0, LAYER_SIZE.width, LAYER_SIZE.height)

    const show = (id: string, left: number, top: number, width = 40, height = 24): void => {
      const element = document.getElementById(id)!
      stubRect(element, left, top, width, height)
      element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    }

    // No declaration: vertical placement, centred on the anchor, below it.
    show('plain', 200, 100)
    expect(layer.dataset.placement).toBe('bottom')
    expect(layer.style.left).toBe('170px')
    expect(layer.style.top).toBe('134px')

    // An unknown value keeps the default instead of inventing a side.
    show('bogus', 500, 100)
    expect(layer.dataset.placement).toBe('bottom')
    expect(layer.style.left).toBe('470px')

    // A declaration on an ancestor applies to the controls inside it.
    show('railed', 60, 300, 24, 24)
    expect(layer.dataset.placement).toBe('right')
    expect(layer.style.left).toBe('94px')
    expect(layer.style.top).toBe('297px')

    // A declared side that fits is used as-is.
    show('rowed', 400, 400, 120)
    expect(layer.dataset.placement).toBe('top')
    expect(layer.style.left).toBe('410px')
    expect(layer.style.top).toBe('360px')

    // No room above: the opposite side of the same axis wins before the other axis.
    show('row-tight', 400, 12, 120)
    expect(layer.dataset.placement).toBe('bottom')
    expect(layer.style.top).toBe('46px')

    // No room on the declared horizontal side: flip, then clamp into the viewport.
    show('edge-right', 980, 300, 24, 24)
    expect(layer.dataset.placement).toBe('left')
    expect(layer.style.left).toBe('870px')

    // No room below on a deliberately bottom-placed control near the window edge.
    show('edge-bottom', 200, 730)
    expect(layer.dataset.placement).toBe('top')
    expect(layer.style.top).toBe('690px')
  })
})
