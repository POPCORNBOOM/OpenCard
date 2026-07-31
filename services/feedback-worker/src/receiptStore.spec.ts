import { describe, expect, it } from 'vitest'
import { createReceipt, findAuthorizedReceipt } from './receiptStore'

type StoredRow = {
  report_id: string
  token_digest: string
  issue_number: number
  submitted_at: string
}

function createMemoryDb() {
  let row: StoredRow | null = null
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async run() {
              if (!sql.includes('INSERT INTO feedback_receipts')) throw new Error('Unexpected write')
              row = {
                report_id: String(values[0]),
                token_digest: String(values[1]),
                issue_number: Number(values[2]),
                submitted_at: String(values[3]),
              }
              return { success: true }
            },
            async first() {
              if (!sql.includes('FROM feedback_receipts')) throw new Error('Unexpected read')
              return row && row.report_id === values[0] ? row : null
            },
          }
        },
      }
    },
  } as never
  return { db, getRow: () => row }
}

describe('feedback receipt store', () => {
  it('stores only a digest and authorizes the returned token', async () => {
    const { db, getRow } = createMemoryDb()
    const receiptToken = await createReceipt(db, {
      reportId: '6e18e221-4c8a-4c90-8234-b2aa60654f70',
      issueNumber: 42,
      submittedAt: '2026-07-31T00:00:00.000Z',
    })

    expect(receiptToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(getRow()?.token_digest).toMatch(/^[0-9a-f]{64}$/)
    expect(getRow()?.token_digest).not.toBe(receiptToken)
    await expect(findAuthorizedReceipt(
      db,
      '6e18e221-4c8a-4c90-8234-b2aa60654f70',
      receiptToken,
    )).resolves.toEqual({
      reportId: '6e18e221-4c8a-4c90-8234-b2aa60654f70',
      issueNumber: 42,
      submittedAt: '2026-07-31T00:00:00.000Z',
    })
  })

  it('does not authorize malformed, wrong, or cross-report tokens', async () => {
    const { db } = createMemoryDb()
    const receiptToken = await createReceipt(db, {
      reportId: '6e18e221-4c8a-4c90-8234-b2aa60654f70',
      issueNumber: 42,
      submittedAt: '2026-07-31T00:00:00.000Z',
    })

    await expect(findAuthorizedReceipt(db, '6e18e221-4c8a-4c90-8234-b2aa60654f70', 'invalid')).resolves.toBeNull()
    await expect(findAuthorizedReceipt(db, '6e18e221-4c8a-4c90-8234-b2aa60654f70', 'A'.repeat(43))).resolves.toBeNull()
    await expect(findAuthorizedReceipt(db, '00000000-0000-4000-8000-000000000000', receiptToken)).resolves.toBeNull()
  })
})
