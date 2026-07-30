import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFloatingMenu } from './useFloatingMenu'

describe('useFloatingMenu context menus', () => {
  const menu = useFloatingMenu()

  beforeEach(() => menu.closeMenu())

  it('anchors a pointer menu at the cursor and prevents the native menu', () => {
    const target = document.createElement('button')
    const event = new MouseEvent('contextmenu', { clientX: 24, clientY: 48 })
    Object.defineProperty(event, 'currentTarget', { value: target })
    const preventDefault = vi.spyOn(event, 'preventDefault')

    expect(menu.openContextMenu({
      event,
      items: [{ key: 'rename', title: 'Rename' }],
    })).toBe(true)

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(menu.state.value.anchor).toMatchObject({ x: 24, y: 48, width: 0, height: 0 })
    expect(menu.state.value.placement).toBe('bottom-start')
    expect(menu.state.value.focusOnOpen).toBe(true)
  })

  it('leaves the native menu available when there are no actions', () => {
    const event = new MouseEvent('contextmenu', { cancelable: true })
    const preventDefault = vi.spyOn(event, 'preventDefault')

    expect(menu.openContextMenu({ event, items: [] })).toBe(false)
    expect(preventDefault).not.toHaveBeenCalled()
    expect(menu.state.value.isOpen).toBe(false)
  })

  it('replaces the active menu and closes before routing a selection', () => {
    const first = vi.fn()
    const second = vi.fn()
    menu.openMenu({ anchor: new DOMRect(), items: [{ key: 'first' }], onSelect: first })
    menu.openMenu({ anchor: new DOMRect(), items: [{ key: 'second' }], onSelect: second })

    menu.selectMenuItem('second')

    expect(menu.state.value.isOpen).toBe(false)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('second')
  })
})
