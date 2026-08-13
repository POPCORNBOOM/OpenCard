import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStructuredHistory } from './structuredHistory'

type DocumentState = {
  title: string
  count: number
  items: string[]
}

function createHarness(entryLimit = 100, byteLimit?: number) {
  const contents: string[] = []
  const dirtyStates: boolean[] = []
  const history = createStructuredHistory<DocumentState>({
    initialState: { title: 'Initial', count: 0, items: [] },
    serialize: state => JSON.stringify(state),
    onContent: content => contents.push(content),
    onDirty: dirty => dirtyStates.push(dirty),
    entryLimit,
    byteLimit,
  })
  return { contents, dirtyStates, history }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('structured history', () => {
  it('applies reversible patches, branches, and tracks the savepoint by state identity', () => {
    const { history } = createHarness()
    history.transact({ mode: 'immediate' }, draft => { draft.count = 1 })
    history.transact({ mode: 'immediate' }, draft => { draft.count = 2 })
    expect(history.state.value.count).toBe(2)
    expect(history.dirty.value).toBe(true)

    history.markSaved()
    expect(history.dirty.value).toBe(false)
    history.undo()
    expect(history.state.value.count).toBe(1)
    expect(history.dirty.value).toBe(true)
    history.redo()
    expect(history.state.value.count).toBe(2)
    expect(history.dirty.value).toBe(false)

    history.undo()
    history.transact({ mode: 'immediate' }, draft => { draft.count = 3 })
    expect(history.canRedo.value).toBe(false)
    expect(history.state.value.count).toBe(3)
  })

  it('merges only matching debounced operations and publishes once per group', () => {
    vi.useFakeTimers()
    const { contents, history } = createHarness()
    history.transact({
      mode: 'debounced',
      merge: { family: 'property-input', target: 'document:title' },
    }, draft => { draft.title = 'A' })
    history.transact({
      mode: 'debounced',
      merge: { family: 'property-input', target: 'document:title' },
    }, draft => { draft.title = 'AB' })
    expect(contents).toHaveLength(0)

    vi.advanceTimersByTime(300)
    expect(contents).toHaveLength(1)
    history.undo()
    expect(history.state.value.title).toBe('Initial')

    history.transact({
      mode: 'debounced',
      merge: { family: 'property-input', target: 'document:title' },
    }, draft => { draft.title = 'Other' })
    history.transact({
      mode: 'debounced',
      merge: { family: 'property-input', target: 'document:count' },
    }, draft => { draft.count = 4 })
    expect(contents).toHaveLength(3)
    history.flush()
    history.undo()
    expect(history.state.value).toMatchObject({ title: 'Other', count: 0 })
  })

  it('flushes typing before an immediate action so they undo separately', () => {
    vi.useFakeTimers()
    const { history } = createHarness()
    history.transact({
      mode: 'debounced',
      merge: { family: 'property-input', target: 'document:title' },
    }, draft => { draft.title = 'Typed' })
    history.transact({ mode: 'immediate' }, draft => { draft.count = 1 })

    history.undo()
    expect(history.state.value).toMatchObject({ title: 'Typed', count: 0 })
    history.undo()
    expect(history.state.value).toMatchObject({ title: 'Initial', count: 0 })
  })

  it('commits or cancels a continuous transaction as one operation', () => {
    const { history } = createHarness()
    history.beginContinuous()
    history.updateContinuous(draft => { draft.count = 1 })
    history.updateContinuous(draft => { draft.count = 2 })
    history.commitContinuous()
    history.undo()
    expect(history.state.value.count).toBe(0)

    history.beginContinuous()
    history.updateContinuous(draft => { draft.count = 5 })
    history.cancelContinuous()
    expect(history.state.value.count).toBe(0)
  })

  it('trims by entry count and resets safely for an oversized operation', () => {
    const countLimited = createHarness(2).history
    for (let count = 1; count <= 3; count += 1) {
      countLimited.transact({ mode: 'immediate' }, draft => { draft.count = count })
    }
    countLimited.undo()
    countLimited.undo()
    expect(countLimited.state.value.count).toBe(1)
    expect(countLimited.canUndo.value).toBe(false)

    const byteLimited = createHarness(100, 16).history
    byteLimited.transact({ mode: 'immediate' }, draft => { draft.items.push('large-value') })
    expect(byteLimited.state.value.items).toEqual(['large-value'])
    expect(byteLimited.canUndo.value).toBe(false)
  })

  it('ignores semantic no-ops and applies a lower limit immediately', () => {
    const { history } = createHarness()
    expect(history.transact({ mode: 'immediate' }, draft => { draft.count = 0 })).toBe(false)
    expect(history.canUndo.value).toBe(false)
    for (let count = 1; count <= 4; count += 1) {
      history.transact({ mode: 'immediate' }, draft => { draft.count = count })
    }
    history.setEntryLimit(2)
    history.undo()
    history.undo()
    expect(history.state.value.count).toBe(2)
    expect(history.canUndo.value).toBe(false)
  })
})
