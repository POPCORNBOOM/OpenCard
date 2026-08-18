import { afterEach, describe, expect, it, vi } from 'vitest'
import { setupGlobalTooltip } from './globalTooltip'

describe('globalTooltip', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('delays pointer tooltips but shows focus tooltips immediately and dismisses them', () => {
    vi.useFakeTimers()
    document.body.innerHTML = `
      <button id="first" data-tooltip="First tooltip">First</button>
      <button id="second" data-tooltip="Second tooltip">Second</button>
      <button id="rich" data-tooltip="[b]Before[/b][br][i]Now[/i] [code]copy[/code] [icon:action.copy] [key]Alt[/key]">Rich</button>
    `
    setupGlobalTooltip()

    const first = document.getElementById('first')!
    const second = document.getElementById('second')!
    const layer = document.getElementById('oc-tooltip-layer') as HTMLDivElement

    expect(layer.getAttribute('role')).toBe('tooltip')
    first.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    vi.advanceTimersByTime(349)
    expect(layer.hidden).toBe(true)

    second.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    vi.advanceTimersByTime(350)
    expect(layer.hidden).toBe(false)
    expect(layer.textContent).toBe('Second tooltip')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(layer.classList.contains('open')).toBe(false)
    expect(layer.getAttribute('aria-hidden')).toBe('true')

    first.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(layer.hidden).toBe(false)
    expect(layer.getAttribute('aria-hidden')).toBe('false')
    expect(layer.textContent).toBe('First tooltip')

    first.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(layer.classList.contains('open')).toBe(false)
    expect(layer.getAttribute('aria-hidden')).toBe('true')

    const rich = document.getElementById('rich')!
    rich.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(layer.textContent).toBe('BeforeNow copy  Alt')
    expect(layer.querySelector('strong')?.textContent).toBe('Before')
    expect(layer.querySelector('em')?.textContent).toBe('Now')
    expect(layer.querySelector('br')).not.toBeNull()
    expect(layer.querySelector('code')?.textContent).toBe('copy')
    expect(layer.querySelector('.oc-key')?.textContent).toBe('Alt')
    expect(layer.querySelector('.oc-inline-markup__icon path')).not.toBeNull()
  })
})
