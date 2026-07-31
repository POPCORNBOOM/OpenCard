import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { afterEach, describe, expect, it, vi } from 'vitest'
import enUS from '../../../locales/en-US'
import * as feedbackService from '../services/feedbackService'
import { feedbackReceiptStore, type FeedbackReceiptRecord } from '../services/feedbackReceiptStore'
import FeedbackHistoryDialog from './FeedbackHistoryDialog.vue'

const record: FeedbackReceiptRecord = {
  reportId: '6e18e221-4c8a-4c90-8234-b2aa60654f70',
  receiptToken: 'receipt-token',
  kind: 'suggestion',
  summary: 'Improve keyboard navigation.',
  submittedAt: '2026-08-01T00:00:00.000Z',
  status: 'received',
  updatedAt: '2026-08-01T00:00:00.000Z',
}

function mountDialog(props: { developerMode?: boolean } = {}) {
  return mount(FeedbackHistoryDialog, {
    props: { open: true, ...props },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      stubs: { Teleport: true },
    },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FeedbackHistoryDialog', () => {
  it('loads one local receipt and refreshes only its public status projection', async () => {
    const answeredRecord: FeedbackReceiptRecord = {
      ...record,
      status: 'answered',
      updatedAt: '2026-08-01T02:00:00.000Z',
      lastSyncedAt: '2026-08-01T02:01:00.000Z',
      officialResponse: { text: 'This is now fixed.', updatedAt: '2026-08-01T02:00:00.000Z' },
    }
    vi.spyOn(feedbackReceiptStore, 'list')
      .mockResolvedValueOnce([record])
      .mockResolvedValueOnce([answeredRecord])
    const applyStatuses = vi.spyOn(feedbackReceiptStore, 'applyStatuses').mockResolvedValue()
    const getStatuses = vi.spyOn(feedbackService, 'getFeedbackStatuses').mockResolvedValue([{
      reportId: record.reportId,
      status: 'answered',
      submittedAt: record.submittedAt,
      updatedAt: answeredRecord.updatedAt,
      officialResponse: answeredRecord.officialResponse,
    }])

    const wrapper = mountDialog()
    await flushPromises()

    expect(getStatuses).toHaveBeenCalledWith([{
      reportId: record.reportId,
      receiptToken: record.receiptToken,
    }])
    expect(applyStatuses).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Answered')
    expect(wrapper.text()).toContain('This is now fixed.')
    expect(wrapper.text()).not.toContain('receipt-token')
  })

  it('requires confirmation and deletes only the selected local record', async () => {
    vi.spyOn(feedbackReceiptStore, 'list')
      .mockResolvedValueOnce([record])
      .mockResolvedValueOnce([record])
      .mockResolvedValueOnce([])
    vi.spyOn(feedbackService, 'getFeedbackStatuses').mockRejectedValue(
      new feedbackService.FeedbackServiceError('network', 'offline'),
    )
    vi.spyOn(feedbackReceiptStore, 'markRefreshFailed').mockResolvedValue()
    const remove = vi.spyOn(feedbackReceiptStore, 'remove').mockResolvedValue()
    const wrapper = mountDialog()
    await flushPromises()

    await wrapper.findAll('button').find(button => button.text().includes('Delete Local Record'))!.trigger('click')
    expect(wrapper.text()).toContain('does not withdraw or delete')
    expect(remove).not.toHaveBeenCalled()

    const confirmationButtons = wrapper.findAll('.feedback-history__delete-confirm button')
    await confirmationButtons[confirmationButtons.length - 1]!.trigger('click')
    await flushPromises()

    expect(remove).toHaveBeenCalledWith(record.reportId)
    expect(wrapper.text()).toContain('No feedback records yet')
  })

  it('never sends closed receipts when refreshing the history', async () => {
    const closedRecord: FeedbackReceiptRecord = {
      ...record,
      reportId: 'closed-report',
      receiptToken: 'closed-token',
      status: 'closed',
    }
    vi.spyOn(feedbackReceiptStore, 'list')
      .mockResolvedValueOnce([closedRecord, record])
      .mockResolvedValueOnce([closedRecord, record])
    vi.spyOn(feedbackReceiptStore, 'applyStatuses').mockResolvedValue()
    const getStatuses = vi.spyOn(feedbackService, 'getFeedbackStatuses').mockResolvedValue([{
      reportId: record.reportId,
      status: 'received',
      submittedAt: record.submittedAt,
      updatedAt: record.updatedAt,
    }])

    mountDialog()
    await flushPromises()

    expect(getStatuses).toHaveBeenCalledWith([{
      reportId: record.reportId,
      receiptToken: record.receiptToken,
    }])
  })

  it('shows cached data without a request when no open receipt is due', async () => {
    vi.spyOn(feedbackReceiptStore, 'list').mockResolvedValue([{
      ...record,
      nextCheckAt: '2999-01-01T00:00:00.000Z',
    }])
    const getStatuses = vi.spyOn(feedbackService, 'getFeedbackStatuses')

    const wrapper = mountDialog()
    await flushPromises()

    expect(getStatuses).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain(record.summary)
    expect(wrapper.text()).not.toContain('Force Refresh')
  })

  it('allows developer mode to force one batch refresh before the schedule is due', async () => {
    const scheduledRecord = { ...record, nextCheckAt: '2999-01-01T00:00:00.000Z' }
    vi.spyOn(feedbackReceiptStore, 'list')
      .mockResolvedValueOnce([scheduledRecord])
      .mockResolvedValueOnce([scheduledRecord])
    vi.spyOn(feedbackReceiptStore, 'applyStatuses').mockResolvedValue()
    const getStatuses = vi.spyOn(feedbackService, 'getFeedbackStatuses').mockResolvedValue([{
      reportId: record.reportId,
      status: 'received',
      submittedAt: record.submittedAt,
      updatedAt: record.updatedAt,
    }])
    const wrapper = mountDialog({ developerMode: true })
    await flushPromises()
    expect(getStatuses).not.toHaveBeenCalled()

    await wrapper.findAll('button').find(button => button.text().includes('Force Refresh'))!.trigger('click')
    await flushPromises()

    expect(getStatuses).toHaveBeenCalledWith([{
      reportId: record.reportId,
      receiptToken: record.receiptToken,
    }])
  })
})
