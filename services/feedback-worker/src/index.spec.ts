import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import worker, { issueBody, validateSubmission } from './index'
import { createAppJwt } from './githubClient'
import { createReceipt } from './receiptStore'

const validSubmission = {
  schemaVersion: 1,
  reportId: '6e18e221-4c8a-4c90-8234-b2aa60654f70',
  submittedAt: '2026-07-31T00:00:00.000Z',
  kind: 'bug',
  message: 'The editor stopped responding.',
  reproduction: 'Open a card and resize a column.',
  environment: {
    appVersion: '0.2.13',
    locale: 'zh-CN',
    platform: 'Windows',
  },
  diagnostics: {
    errorMessage: 'Resize failed',
  },
} as const

afterEach(() => {
  vi.restoreAllMocks()
})

function createMemoryReceiptDb() {
  const rows = new Map<unknown, Record<string, unknown>>()
  return {
    db: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              async run() {
                if (!sql.includes('INSERT INTO feedback_receipts')) throw new Error('Unexpected write')
                rows.set(values[0], {
                  report_id: values[0],
                  token_digest: values[1],
                  issue_number: values[2],
                  submitted_at: values[3],
                })
                return { success: true }
              },
              async first() {
                return rows.get(values[0]) ?? null
              },
            }
          },
        }
      },
    } as never,
  }
}

function createWorkerEnv(receiptsDb: D1Database) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  return {
    ALLOWED_ORIGINS: 'https://tauri.localhost',
    FEEDBACK_RATE_LIMIT: { limit: async () => ({ success: true }) },
    RECEIPTS_DB: receiptsDb,
    GITHUB_APP_ID: '12345',
    GITHUB_INSTALLATION_ID: '67890',
    GITHUB_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    GITHUB_OWNER: 'owner',
    GITHUB_REPO: 'reports',
  } as never
}

describe('feedback worker validation', () => {
  it('accepts a bounded problem report', () => {
    expect(validateSubmission(validSubmission)).toEqual(validSubmission)
  })

  it('rejects diagnostics attached to suggestions', () => {
    expect(() => validateSubmission({
      ...validSubmission,
      kind: 'suggestion',
    })).toThrow('unexpected_diagnostics')
  })

  it('rejects oversized or malformed values', () => {
    expect(() => validateSubmission({
      ...validSubmission,
      message: 'x'.repeat(8_001),
    })).toThrow('invalid_message')
    expect(() => validateSubmission({
      ...validSubmission,
      submittedAt: 'not-a-date',
    })).toThrow('invalid_submitted_at')
  })

  it('renders diagnostics as escaped text in a private issue', () => {
    const body = issueBody(validateSubmission({
      ...validSubmission,
      diagnostics: { errorMessage: '</pre><script>alert(1)</script>' },
    }))
    expect(body).toContain('&lt;/pre&gt;&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(body).not.toContain('</pre><script>')
    expect(body).toContain('Report ID: <code>6e18e221-4c8a-4c90-8234-b2aa60654f70</code>')
  })

  it('renders user-authored fields as text instead of executable issue markdown', () => {
    const body = issueBody(validateSubmission({
      ...validSubmission,
      message: '@maintainers <img src=x>',
    }))
    expect(body).toContain('@maintainers &lt;img src=x&gt;')
    expect(body).not.toContain('<img src=x>')
  })

  it('rejects report identifiers that could escape the private issue marker', () => {
    expect(() => validateSubmission({
      ...validSubmission,
      reportId: '--> @maintainers',
    })).toThrow('invalid_report_id')
  })
})

describe('feedback worker boundary', () => {
  const env = {
    ALLOWED_ORIGINS: 'https://tauri.localhost',
    FEEDBACK_RATE_LIMIT: { limit: async () => ({ success: true }) },
  } as never

  it('rejects unknown origins before processing a body', async () => {
    const response = await worker.fetch(new Request('https://worker.example/feedback', {
      method: 'POST',
      headers: { Origin: 'https://attacker.example' },
      body: JSON.stringify(validSubmission),
    }), env)
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'origin_not_allowed' })
  })

  it('returns CORS headers only for configured origins', async () => {
    const response = await worker.fetch(new Request('https://worker.example/feedback', {
      method: 'OPTIONS',
      headers: { Origin: 'https://tauri.localhost' },
    }), env)
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://tauri.localhost')
  })

  it('rejects non-JSON requests before consuming rate-limit or upstream resources', async () => {
    const response = await worker.fetch(new Request('https://worker.example/feedback', {
      method: 'POST',
      headers: { Origin: 'https://tauri.localhost', 'Content-Type': 'text/plain' },
      body: 'not json',
    }), env)
    expect(response.status).toBe(415)
    await expect(response.json()).resolves.toEqual({ error: 'unsupported_media_type' })
  })

  it('returns only authorized user-facing status and official response fields', async () => {
    const { db } = createMemoryReceiptDb()
    const receiptToken = await createReceipt(db, {
      reportId: validSubmission.reportId,
      issueNumber: 42,
      submittedAt: validSubmission.submittedAt,
    })
    const env = createWorkerEnv(db)
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/access_tokens')) return Response.json({ token: 'installation-token' })
      if (url.endsWith('/issues/42')) {
        return Response.json({
          state: 'open',
          labels: [],
          comments: 2,
          created_at: validSubmission.submittedAt,
          updated_at: '2026-08-01T01:00:00.000Z',
          private_repository_detail: 'must not leak',
        })
      }
      if (url.includes('/issues/42/comments')) {
        return Response.json([
          {
            body: 'Internal discussion',
            updated_at: '2026-08-01T02:00:00.000Z',
            author_association: 'OWNER',
          },
          {
            body: '问题已修复，请更新后重试。',
            updated_at: '2026-08-01T03:00:00.000Z',
            author_association: 'NONE',
            performed_via_github_app: { id: 12345 },
          },
        ])
      }
      throw new Error(`Unexpected request: ${url}`)
    }))

    const response = await worker.fetch(new Request(`https://worker.example/feedback/${validSubmission.reportId}`, {
      method: 'GET',
      headers: {
        Origin: 'https://tauri.localhost',
        Authorization: `Bearer ${receiptToken}`,
      },
    }), env)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      reportId: validSubmission.reportId,
      status: 'answered',
      submittedAt: validSubmission.submittedAt,
      updatedAt: '2026-08-01T03:00:00.000Z',
      officialResponse: {
        text: '问题已修复，请更新后重试。',
        updatedAt: '2026-08-01T03:00:00.000Z',
      },
    })
  })

  it('resolves multiple authorized receipts with one batch request', async () => {
    const secondReportId = '00000000-0000-4000-8000-000000000001'
    const { db } = createMemoryReceiptDb()
    const firstToken = await createReceipt(db, {
      reportId: validSubmission.reportId,
      issueNumber: 42,
      submittedAt: validSubmission.submittedAt,
    })
    const secondToken = await createReceipt(db, {
      reportId: secondReportId,
      issueNumber: 43,
      submittedAt: validSubmission.submittedAt,
    })
    const env = createWorkerEnv(db)
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/access_tokens')) return Response.json({ token: 'installation-token' })
      const issueNumber = url.endsWith('/issues/42') ? 42 : url.endsWith('/issues/43') ? 43 : null
      if (issueNumber) {
        return Response.json({
          state: 'open',
          labels: [],
          comments: 0,
          created_at: validSubmission.submittedAt,
          updated_at: '2026-08-01T01:00:00.000Z',
        })
      }
      throw new Error(`Unexpected request: ${url}`)
    }))

    const response = await worker.fetch(new Request('https://worker.example/feedback/status', {
      method: 'POST',
      headers: { Origin: 'https://tauri.localhost', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receipts: [
          { reportId: validSubmission.reportId, receiptToken: firstToken },
          { reportId: secondReportId, receiptToken: secondToken },
        ],
      }),
    }), env)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      statuses: [
        { reportId: validSubmission.reportId, status: 'received' },
        { reportId: secondReportId, status: 'received' },
      ],
    })
  })

  it('does not reveal whether a report exists when the receipt is invalid', async () => {
    const { db } = createMemoryReceiptDb()
    const env = createWorkerEnv(db)
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)

    const response = await worker.fetch(new Request(`https://worker.example/feedback/${validSubmission.reportId}`, {
      method: 'GET',
      headers: {
        Origin: 'https://tauri.localhost',
        Authorization: `Bearer ${'A'.repeat(43)}`,
      },
    }), env)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'invalid_receipt' })
    expect(upstream).not.toHaveBeenCalled()
  })
})

describe('GitHub App authentication', () => {
  it.each(['pkcs1', 'pkcs8'] as const)('signs a JWT from a GitHub-compatible %s private key', async (format) => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const pem = privateKey.export({ type: format, format: 'pem' }).toString()
    const token = await createAppJwt('12345', pem)
    expect(token.split('.')).toHaveLength(3)
  })
})
