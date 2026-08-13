import { afterEach, describe, expect, it, vi } from 'vitest'
import { createContentHistory } from './contentHistory'

afterEach(() => vi.useRealTimers())

describe('content history', () => {
  it('stores minimal reversible text changes and branches', () => {
    const updates: Array<[string, boolean]> = []
    const history = createContentHistory({
      content: '{"value":0}',
      entryLimit: 100,
      onChange: (content, dirty) => updates.push([content, dirty]),
    })
    history.record('{"value":1}', { mode: 'immediate' })
    history.record('{"value":2}', { mode: 'immediate' })
    history.undo()
    expect(history.getContent()).toBe('{"value":1}')
    history.record('{"value":3}', { mode: 'immediate' })
    expect(history.canRedo.value).toBe(false)
    history.undo()
    history.undo()
    expect(history.getContent()).toBe('{"value":0}')
    expect(updates[updates.length - 1]).toEqual(['{"value":0}', false])
  })

  it('merges only the same family and target within the debounce window', () => {
    vi.useFakeTimers()
    const history = createContentHistory({ content: 'A', entryLimit: 100, onChange: vi.fn() })
    history.record('AB', { mode: 'debounced', merge: { family: 'input', target: 'title' } })
    history.record('ABC', { mode: 'debounced', merge: { family: 'input', target: 'title' } })
    history.record('ABCD', { mode: 'debounced', merge: { family: 'input', target: 'description' } })
    history.flush()
    history.undo()
    expect(history.getContent()).toBe('ABC')
    history.undo()
    expect(history.getContent()).toBe('A')
  })

  it('uses a saved content baseline during concurrent saves', () => {
    const history = createContentHistory({ content: 'A', entryLimit: 100, onChange: vi.fn() })
    history.record('B', { mode: 'immediate' })
    history.record('C', { mode: 'immediate' })
    history.markSaved('B')
    expect(history.dirty.value).toBe(true)
    history.undo()
    expect(history.getContent()).toBe('B')
    expect(history.dirty.value).toBe(false)
  })
})
