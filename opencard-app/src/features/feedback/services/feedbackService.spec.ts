import { describe, expect, it, vi } from 'vitest'
import packageMetadata from '../../../../package.json'
import type { FeedbackSubmission } from '../model/feedback'
import {
  createFeedbackEnvironment,
  FeedbackServiceError,
  getFeedbackStatus,
  getFeedbackStatuses,
  isFeedbackServiceConfigured,
  submitFeedback,
} from './feedbackService'

const submission: FeedbackSubmission = {
  schemaVersion: 1,
  reportId: 'report-1',
  submittedAt: '2026-07-31T00:00:00.000Z',
  kind: 'suggestion',
  message: 'Add keyboard navigation.',
  environment: { appVersion: '0.2.13', locale: 'zh-CN', platform: 'Windows' },
}

describe('feedback service', () => {
  it('accepts only secure endpoints and localhost development endpoints', () => {
    expect(isFeedbackServiceConfigured('https://feedback.example.com')).toBe(true)
    expect(isFeedbackServiceConfigured('http://localhost:8787')).toBe(true)
    expect(isFeedbackServiceConfigured('http://feedback.example.com')).toBe(false)
    expect(isFeedbackServiceConfigured('not-a-url')).toBe(false)
  })

  it('submits the bounded payload and verifies the returned report id', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      reportId: 'report-1',
      receiptToken: 'receipt-token',
      status: 'received',
      submittedAt: submission.submittedAt,
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }))

    await expect(submitFeedback(submission, {
      endpoint: 'https://feedback.example.com',
      fetch: fetchMock,
    })).resolves.toEqual({
      reportId: 'report-1',
      receiptToken: 'receipt-token',
      status: 'received',
      submittedAt: submission.submittedAt,
    })

    expect(fetchMock).toHaveBeenCalledWith('https://feedback.example.com', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(submission),
    }))
  })

  it('queries a report with its receipt token and validates the public projection', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      reportId: 'report-1',
      status: 'answered',
      submittedAt: submission.submittedAt,
      updatedAt: '2026-08-01T03:00:00.000Z',
      officialResponse: {
        text: 'Fixed in the latest version.',
        updatedAt: '2026-08-01T03:00:00.000Z',
      },
      issueNumber: 12,
    }))

    await expect(getFeedbackStatus('report-1', 'receipt-token', {
      endpoint: 'https://feedback.example.com/feedback',
      fetch: fetchMock,
    })).resolves.toEqual({
      reportId: 'report-1',
      status: 'answered',
      submittedAt: submission.submittedAt,
      updatedAt: '2026-08-01T03:00:00.000Z',
      officialResponse: {
        text: 'Fixed in the latest version.',
        updatedAt: '2026-08-01T03:00:00.000Z',
      },
    })

    expect(fetchMock).toHaveBeenCalledWith('https://feedback.example.com/feedback/report-1', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Authorization: 'Bearer receipt-token' }),
    }))
  })

  it('queries multiple receipts through one batch request', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      statuses: [
        {
          reportId: 'report-1',
          status: 'received',
          submittedAt: submission.submittedAt,
          updatedAt: submission.submittedAt,
        },
        {
          reportId: 'report-2',
          status: 'answered',
          submittedAt: submission.submittedAt,
          updatedAt: '2026-08-01T03:00:00.000Z',
        },
      ],
    }))

    const receipts = [
      { reportId: 'report-1', receiptToken: 'receipt-1' },
      { reportId: 'report-2', receiptToken: 'receipt-2' },
    ]
    await expect(getFeedbackStatuses(receipts, {
      endpoint: 'https://feedback.example.com/feedback',
      fetch: fetchMock,
    })).resolves.toHaveLength(2)

    expect(fetchMock).toHaveBeenCalledWith('https://feedback.example.com/feedback/status', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ receipts }),
    }))
  })

  it('reports a missing endpoint without attempting a request', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    await expect(submitFeedback(submission, { endpoint: '', fetch: fetchMock })).rejects.toMatchObject({
      code: 'unavailable',
    } satisfies Partial<FeedbackServiceError>)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('distinguishes rejected requests from network failures', async () => {
    await expect(submitFeedback(submission, {
      endpoint: 'https://feedback.example.com',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 })),
    })).rejects.toMatchObject({ code: 'rejected' })

    await expect(submitFeedback(submission, {
      endpoint: 'https://feedback.example.com',
      fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline')),
    })).rejects.toMatchObject({ code: 'network' })
  })

  it('uses application metadata and a privacy-limited platform value', () => {
    expect(createFeedbackEnvironment('zh-CN')).toEqual({
      appVersion: packageMetadata.version,
      locale: 'zh-CN',
      platform: navigator.platform || 'unknown',
    })
  })
})
