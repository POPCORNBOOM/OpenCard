import { describe, expect, it, vi } from 'vitest'
import { createCardVisualReadiness } from './cardRenderReadiness'

function createHarness() {
  let nextFrame = 1
  const callbacks = new Map<number, FrameRequestCallback>()
  const states: Array<{ revision: number; status: 'pending' | 'ready' }> = []
  const readiness = createCardVisualReadiness(
    state => states.push(state),
    callback => {
      const handle = nextFrame++
      callbacks.set(handle, callback)
      return handle
    },
    handle => callbacks.delete(handle),
  )
  return {
    readiness,
    states,
    flushFrame() {
      const pending = [...callbacks.entries()]
      callbacks.clear()
      for (const [, callback] of pending) callback(0)
    },
  }
}

describe('card visual readiness', () => {
  it('waits for every resource and a layout frame', async () => {
    const harness = createHarness()
    harness.readiness.reset()
    const first = harness.readiness.createSlot().begin()
    const second = harness.readiness.createSlot().begin()

    first.settle()
    await Promise.resolve()
    harness.flushFrame()
    expect(harness.states[harness.states.length - 1]?.status).toBe('pending')

    second.settle()
    await Promise.resolve()
    expect(harness.states[harness.states.length - 1]?.status).toBe('pending')
    harness.flushFrame()
    expect(harness.states[harness.states.length - 1]?.status).toBe('ready')
  })

  it('ignores an old ticket after a resource changes', async () => {
    const harness = createHarness()
    const slot = harness.readiness.createSlot()
    const oldTicket = slot.begin()
    const newTicket = slot.begin()

    oldTicket.settle()
    await Promise.resolve()
    harness.flushFrame()
    expect(harness.states[harness.states.length - 1]?.status).toBe('pending')

    newTicket.settle()
    await Promise.resolve()
    harness.flushFrame()
    expect(harness.states[harness.states.length - 1]?.status).toBe('ready')
  })

  it('allows failures to settle readiness', async () => {
    const harness = createHarness()
    const ticket = harness.readiness.createSlot().begin()
    ticket.settle()
    await Promise.resolve()
    harness.flushFrame()
    expect(harness.states[harness.states.length - 1]?.status).toBe('ready')
  })

  it('settles a resource that never finishes loading', async () => {
    vi.useFakeTimers()
    try {
      const harness = createHarness()
      harness.readiness.createSlot().begin()

      await vi.advanceTimersByTimeAsync(5_000)
      await Promise.resolve()
      harness.flushFrame()

      expect(harness.states[harness.states.length - 1]?.status).toBe('ready')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not notify after disposal', async () => {
    const notify = vi.fn()
    const readiness = createCardVisualReadiness(notify, () => 1, () => undefined)
    readiness.reset()
    readiness.dispose()
    await Promise.resolve()
    expect(notify).toHaveBeenCalledTimes(1)
  })
})
