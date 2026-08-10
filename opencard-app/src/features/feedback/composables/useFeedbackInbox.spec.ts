import { describe, expect, it, vi } from 'vitest'
import {
  createFeedbackReceiptStore,
  MemoryFeedbackReceiptPersistence,
  type FeedbackReceiptRecord,
} from '../services/feedbackReceiptStore'
import { createFeedbackInbox } from './useFeedbackInbox'

const dueAt = '2026-08-01T01:00:00.000Z'
const baseRecord = {
  reportId: 'report-1',
  receiptToken: 'receipt-1',
  kind: 'suggestion' as const,
  summary: 'Improve navigation',
  submittedAt: '2026-08-01T00:00:00.000Z',
  status: 'received' as const,
  updatedAt: '2026-08-01T00:00:00.000Z',
  nextCheckAt: dueAt,
}

function createStore(record: FeedbackReceiptRecord = baseRecord) {
  return createFeedbackReceiptStore(new MemoryFeedbackReceiptPersistence({
    schemaVersion: 1,
    records: [record],
  }))
}

describe('feedback inbox', () => {
  it('checks due receipts without opening feedback history and exposes unread replies', async () => {
    const store = createStore()
    const response = { text: 'Done', updatedAt: '2026-08-01T02:00:00.000Z' }
    const getStatuses = vi.fn(async () => [{
      reportId: baseRecord.reportId,
      status: 'answered' as const,
      submittedAt: baseRecord.submittedAt,
      updatedAt: response.updatedAt,
      officialResponse: response,
    }])
    const inbox = createFeedbackInbox({
      store,
      getStatuses,
      now: () => Date.parse(dueAt),
    })

    await inbox.start()

    expect(getStatuses).toHaveBeenCalledWith([{
      reportId: baseRecord.reportId,
      receiptToken: baseRecord.receiptToken,
    }])
    expect(inbox.unreadReplyCount.value).toBe(1)
    await inbox.markResponseRead(baseRecord.reportId, response.updatedAt)
    expect(inbox.unreadReplyCount.value).toBe(0)
    inbox.dispose()
  })

  it('uses one timer for the earliest future check and clears it on dispose', async () => {
    let now = Date.parse('2026-08-01T00:00:00.000Z')
    const scheduled: { callback: (() => void) | null } = { callback: null }
    const timerToken = 7 as unknown as ReturnType<typeof setTimeout>
    const setTimer = vi.fn((callback: () => void) => {
      scheduled.callback = callback
      return timerToken
    })
    const clearTimer = vi.fn()
    const getStatuses = vi.fn(async () => [{
      reportId: baseRecord.reportId,
      status: 'received' as const,
      submittedAt: baseRecord.submittedAt,
      updatedAt: baseRecord.updatedAt,
    }])
    const inbox = createFeedbackInbox({
      store: createStore(),
      getStatuses,
      now: () => now,
      setTimer,
      clearTimer,
    })

    await inbox.start()
    expect(getStatuses).not.toHaveBeenCalled()
    expect(setTimer).toHaveBeenCalledOnce()

    now = Date.parse(dueAt)
    scheduled.callback?.()
    await vi.waitFor(() => expect(getStatuses).toHaveBeenCalledOnce())
    inbox.dispose()
    expect(clearTimer).toHaveBeenCalled()
  })

  it('skips closed receipts even during a forced refresh', async () => {
    const getStatuses = vi.fn()
    const inbox = createFeedbackInbox({
      store: createStore({ ...baseRecord, status: 'closed', nextCheckAt: undefined }),
      getStatuses,
    })

    await inbox.refresh(true)

    expect(getStatuses).not.toHaveBeenCalled()
  })
})
