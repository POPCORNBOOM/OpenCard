import { describe, expect, it } from 'vitest'
import { orderedPair } from './orderedPair'

type Item = { id: string; value: string }

const item = (id: string, value = id): Item => ({ id, value })
const identity = (value: Item) => value.id

describe('orderedPair', () => {
  it('uses right-side order as the skeleton for matches, additions, and reorders', () => {
    const a = item('a', 'old a')
    const b = item('b', 'old b')
    const currentB = item('b', 'new b')
    const currentC = item('c', 'new c')
    const currentA = item('a', 'new a')

    expect(orderedPair([a, b], [currentB, currentC, currentA], identity)).toEqual([
      {
        status: 'matched',
        leftItem: b,
        leftIndex: 1,
        rightItem: currentB,
        rightIndex: 0,
      },
      {
        status: 'right-only',
        leftItem: null,
        leftIndex: null,
        rightItem: currentC,
        rightIndex: 1,
      },
      {
        status: 'matched',
        leftItem: a,
        leftIndex: 0,
        rightItem: currentA,
        rightIndex: 2,
      },
    ])
  })

  it('inserts historical-only items before the next surviving neighbor first', () => {
    const removedFirst = item('removed-first')
    const a = item('a')
    const removedOne = item('removed-one')
    const removedTwo = item('removed-two')
    const b = item('b')
    const currentB = item('b', 'current b')
    const currentA = item('a', 'current a')

    const result = orderedPair(
      [removedFirst, a, removedOne, removedTwo, b],
      [currentB, currentA],
      identity,
    )

    expect(result.map(entry => entry.leftItem?.id ?? entry.rightItem?.id)).toEqual([
      'removed-one',
      'removed-two',
      'b',
      'removed-first',
      'a',
    ])
    expect(result.map(entry => entry.status)).toEqual([
      'left-only',
      'left-only',
      'matched',
      'left-only',
      'matched',
    ])
    expect(result.slice(0, 2).map(entry => entry.leftIndex)).toEqual([2, 3])
  })

  it('inserts trailing historical-only items after the previous surviving neighbor', () => {
    const a = item('a')
    const removedOne = item('removed-one')
    const removedTwo = item('removed-two')
    const currentA = item('a', 'current a')

    const result = orderedPair([a, removedOne, removedTwo], [currentA], identity)

    expect(result.map(entry => entry.leftItem?.id)).toEqual(['a', 'removed-one', 'removed-two'])
    expect(result.map(entry => entry.status)).toEqual(['matched', 'left-only', 'left-only'])
  })

  it('appends historical-only items in historical order when no neighbor survives', () => {
    const oldOne = item('old-one')
    const oldTwo = item('old-two')
    const newOne = item('new-one')

    const result = orderedPair([oldOne, oldTwo], [newOne], identity)

    expect(result.map(entry => entry.leftItem?.id ?? entry.rightItem?.id)).toEqual([
      'new-one',
      'old-one',
      'old-two',
    ])
    expect(result.map(entry => entry.status)).toEqual(['right-only', 'left-only', 'left-only'])
  })

  it('does not pair different identities with identical display content', () => {
    const historical = item('historical-id', 'Same display name')
    const current = item('current-id', 'Same display name')

    expect(orderedPair([historical], [current], identity)).toEqual([
      {
        status: 'right-only',
        leftItem: null,
        leftIndex: null,
        rightItem: current,
        rightIndex: 0,
      },
      {
        status: 'left-only',
        leftItem: historical,
        leftIndex: 0,
        rightItem: null,
        rightIndex: null,
      },
    ])
  })

  it.each([
    ['left', [item('duplicate'), item('duplicate')], [item('current')]],
    ['right', [item('historical')], [item('duplicate'), item('duplicate')]],
  ])('returns ambiguous when the %s side contains a duplicate identity', (_side, left, right) => {
    expect(orderedPair(left, right, identity)).toEqual([{
      status: 'ambiguous',
      leftItem: null,
      leftIndex: null,
      rightItem: null,
      rightIndex: null,
    }])
  })

  it('does not modify either input', () => {
    const left = Object.freeze([Object.freeze(item('a')), Object.freeze(item('removed'))])
    const right = Object.freeze([Object.freeze(item('added')), Object.freeze(item('a'))])
    const leftSnapshot = JSON.stringify(left)
    const rightSnapshot = JSON.stringify(right)

    orderedPair(left, right, identity)

    expect(JSON.stringify(left)).toBe(leftSnapshot)
    expect(JSON.stringify(right)).toBe(rightSnapshot)
  })
})
