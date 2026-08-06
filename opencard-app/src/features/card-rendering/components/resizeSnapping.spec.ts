import { describe, expect, it } from 'vitest'
import { snapMoveRect, snapResizeRect, type ResizeSnapTarget } from './resizeSnapping'

const parent: ResizeSnapTarget = {
  id: 'parent',
  kind: 'parent',
  rect: { left: 0, top: 0, width: 400, height: 300 },
}
const sibling: ResizeSnapTarget = {
  id: 'sibling',
  kind: 'sibling',
  rect: { left: 200, top: 120, width: 80, height: 60 },
}

describe('resizeSnapping', () => {
  it('snaps moving left/right and top/bottom edges independently', () => {
    expect(snapMoveRect({
      rect: { left: 97, top: 3, width: 100, height: 60 },
      targets: [parent, sibling],
      enterDistance: 4,
      releaseDistance: 7,
    })).toMatchObject({
      rect: { left: 100, top: 0, width: 100, height: 60 },
      locks: {
        x: { movingEdge: 'right', targetEdge: 'left', target: { id: 'sibling' } },
        y: { movingEdge: 'top', targetEdge: 'top', target: { id: 'parent' } },
      },
    })
  })

  it('keeps move snapping until the raw pointer rectangle crosses the release distance', () => {
    const initial = snapMoveRect({
      rect: { left: 97, top: 40, width: 100, height: 60 },
      targets: [sibling],
      enterDistance: 4,
      releaseDistance: 7,
    })
    const held = snapMoveRect({
      rect: { left: 107, top: 40, width: 100, height: 60 },
      targets: [sibling],
      enterDistance: 4,
      releaseDistance: 7,
      previousLocks: initial.locks,
    })
    const released = snapMoveRect({
      rect: { left: 108, top: 40, width: 100, height: 60 },
      targets: [sibling],
      enterDistance: 4,
      releaseDistance: 7,
      previousLocks: initial.locks,
    })

    expect(held.rect.left).toBe(100)
    expect(released.rect.left).toBe(108)
    expect(released.locks.x).toBeUndefined()
  })

  it('snaps only the active corner edges to the nearest target edges', () => {
    expect(snapResizeRect({
      rect: { left: 50, top: 40, width: 147, height: 77 },
      handle: 'rb',
      targets: [parent, sibling],
      enterDistance: 4,
      releaseDistance: 7,
      minSize: 24,
    })).toMatchObject({
      rect: { left: 50, top: 40, width: 150, height: 80 },
      locks: {
        x: { movingEdge: 'right', targetEdge: 'left', target: { id: 'sibling' } },
        y: { movingEdge: 'bottom', targetEdge: 'top', target: { id: 'sibling' } },
      },
    })
  })

  it('keeps a previous lock inside the wider release distance', () => {
    const initial = snapResizeRect({
      rect: { left: 50, top: 40, width: 147, height: 80 },
      handle: 'r',
      targets: [sibling],
      enterDistance: 4,
      releaseDistance: 7,
      minSize: 24,
    })
    const held = snapResizeRect({
      rect: { left: 50, top: 40, width: 155, height: 80 },
      handle: 'r',
      targets: [sibling],
      enterDistance: 4,
      releaseDistance: 7,
      previousLocks: initial.locks,
      minSize: 24,
    })

    expect(held.rect.width).toBe(150)
    expect(held.locks.x?.target.id).toBe('sibling')
  })

  it('prefers the same edge and then the parent when candidates are tied', () => {
    const tiedSibling: ResizeSnapTarget = {
      id: 'same-position',
      kind: 'sibling',
      rect: { left: 0, top: 100, width: 400, height: 40 },
    }
    const result = snapResizeRect({
      rect: { left: 50, top: 40, width: 347, height: 80 },
      handle: 'r',
      targets: [tiedSibling, parent],
      enterDistance: 4,
      releaseDistance: 7,
      minSize: 24,
    })

    expect(result.rect.width).toBe(350)
    expect(result.locks.x).toMatchObject({ targetEdge: 'right', target: { id: 'parent' } })
  })

  it('does not snap through the minimum selection size', () => {
    const result = snapResizeRect({
      rect: { left: 195, top: 40, width: 28, height: 80 },
      handle: 'l',
      targets: [sibling],
      enterDistance: 6,
      releaseDistance: 9,
      minSize: 24,
    })

    expect(result.rect).toEqual({ left: 195, top: 40, width: 28, height: 80 })
    expect(result.locks.x).toBeUndefined()
  })
})
