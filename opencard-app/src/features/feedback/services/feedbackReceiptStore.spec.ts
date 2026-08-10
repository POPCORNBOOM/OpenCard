import { describe, expect, it } from 'vitest'
import type { FeedbackSubmission } from '../model/feedback'
import {
  createFeedbackReceiptStore,
  MemoryFeedbackReceiptPersistence,
} from './feedbackReceiptStore'

const submission: FeedbackSubmission = {
  schemaVersion: 1,
  reportId: 'report-1',
  submittedAt: '2026-08-01T00:00:00.000Z',
  kind: 'suggestion',
  message: '\n  Improve keyboard navigation.\nMore detail.',
  environment: { appVersion: '0.2.13', locale: 'en-US', platform: 'Windows' },
}

describe('feedback receipt store', () => {
  it('persists only the local summary and receipt required to query a report', async () => {
    const persistence = new MemoryFeedbackReceiptPersistence()
    const store = createFeedbackReceiptStore(persistence)

    await store.add(submission, {
      reportId: submission.reportId,
      receiptToken: 'secret-receipt',
      status: 'received',
      submittedAt: submission.submittedAt,
    })

    await expect(store.list()).resolves.toMatchObject([{
      reportId: 'report-1',
      receiptToken: 'secret-receipt',
      kind: 'suggestion',
      summary: 'Improve keyboard navigation.',
      submittedAt: submission.submittedAt,
      status: 'received',
      updatedAt: submission.submittedAt,
      nextCheckAt: expect.any(String),
    }])
    expect(JSON.stringify(await persistence.load())).not.toContain('More detail.')
  })

  it('applies a successful status refresh and deletes only the local record', async () => {
    const persistence = new MemoryFeedbackReceiptPersistence()
    const store = createFeedbackReceiptStore(persistence)
    await store.add(submission, {
      reportId: submission.reportId,
      receiptToken: 'secret-receipt',
      status: 'received',
      submittedAt: submission.submittedAt,
    })

    await store.applyStatus({
      reportId: submission.reportId,
      status: 'answered',
      submittedAt: submission.submittedAt,
      updatedAt: '2026-08-01T02:00:00.000Z',
      officialResponse: {
        text: 'This is now fixed.',
        updatedAt: '2026-08-01T02:00:00.000Z',
      },
    }, '2026-08-01T02:01:00.000Z')

    await expect(store.list()).resolves.toMatchObject([{
      status: 'answered',
      lastSyncedAt: '2026-08-01T02:01:00.000Z',
      officialResponse: { text: 'This is now fixed.' },
    }])

    await store.remove(submission.reportId)
    await expect(store.list()).resolves.toEqual([])
  })

  it('drops malformed entries without losing valid receipts', async () => {
    const persistence = new MemoryFeedbackReceiptPersistence({
      schemaVersion: 1,
      records: [
        { reportId: 'broken' },
        {
          reportId: 'report-2',
          receiptToken: 'receipt-2',
          kind: 'bug',
          summary: 'A valid report',
          submittedAt: submission.submittedAt,
          status: 'received',
          updatedAt: submission.submittedAt,
        },
      ],
    })

    await expect(createFeedbackReceiptStore(persistence).list()).resolves.toMatchObject([{
      reportId: 'report-2',
      status: 'received',
    }])
  })

  it('backs off failed refreshes without scheduling beyond one hour', async () => {
    const store = createFeedbackReceiptStore(new MemoryFeedbackReceiptPersistence())
    await store.add(submission, {
      reportId: submission.reportId,
      receiptToken: 'secret-receipt',
      status: 'received',
      submittedAt: submission.submittedAt,
    })
    const failedAt = '2026-08-01T03:00:00.000Z'

    await store.markRefreshFailed([submission.reportId], failedAt, () => 1)
    expect(Date.parse((await store.list())[0]!.nextCheckAt!) - Date.parse(failedAt)).toBe(18 * 60_000)
    await store.markRefreshFailed([submission.reportId], failedAt, () => 1)
    expect(Date.parse((await store.list())[0]!.nextCheckAt!) - Date.parse(failedAt)).toBe(36 * 60_000)
    await store.markRefreshFailed([submission.reportId], failedAt, () => 1)
    const record = (await store.list())[0]!
    expect(record.failureCount).toBe(3)
    expect(Date.parse(record.nextCheckAt!) - Date.parse(failedAt)).toBe(60 * 60_000)
  })

  it('marks only the displayed response version as read', async () => {
    const store = createFeedbackReceiptStore(new MemoryFeedbackReceiptPersistence())
    await store.add(submission, {
      reportId: submission.reportId,
      receiptToken: 'secret-receipt',
      status: 'received',
      submittedAt: submission.submittedAt,
    })
    const firstResponse = { text: 'First reply', updatedAt: '2026-08-01T02:00:00.000Z' }
    await store.applyStatus({
      reportId: submission.reportId,
      status: 'answered',
      submittedAt: submission.submittedAt,
      updatedAt: firstResponse.updatedAt,
      officialResponse: firstResponse,
    })
    await store.markResponseRead(submission.reportId, firstResponse.updatedAt)
    expect((await store.list())[0]?.readResponseUpdatedAt).toBe(firstResponse.updatedAt)

    const updatedResponse = { text: 'Updated reply', updatedAt: '2026-08-01T03:00:00.000Z' }
    await store.applyStatus({
      reportId: submission.reportId,
      status: 'answered',
      submittedAt: submission.submittedAt,
      updatedAt: updatedResponse.updatedAt,
      officialResponse: updatedResponse,
    })
    await store.markResponseRead(submission.reportId, firstResponse.updatedAt)
    expect((await store.list())[0]).toMatchObject({
      officialResponse: updatedResponse,
      readResponseUpdatedAt: firstResponse.updatedAt,
    })
  })
})
