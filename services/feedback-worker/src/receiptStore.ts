const RECEIPT_TOKEN_BYTES = 32
const receiptTokenPattern = /^[A-Za-z0-9_-]{43}$/

type FeedbackReceiptRow = {
  report_id: string
  token_digest: string
  issue_number: number
  submitted_at: string
}

export type FeedbackReceipt = {
  reportId: string
  issueNumber: number
  submittedAt: string
}

export async function createReceipt(
  db: D1Database,
  input: FeedbackReceipt,
): Promise<string> {
  const receiptToken = generateReceiptToken()
  const tokenDigest = await digestReceiptToken(receiptToken)

  await db.prepare(`
    INSERT INTO feedback_receipts (report_id, token_digest, issue_number, submitted_at)
    VALUES (?, ?, ?, ?)
  `).bind(input.reportId, tokenDigest, input.issueNumber, input.submittedAt).run()

  return receiptToken
}

export async function findAuthorizedReceipt(
  db: D1Database,
  reportId: string,
  receiptToken: string,
): Promise<FeedbackReceipt | null> {
  if (!receiptTokenPattern.test(receiptToken)) return null

  const row = await db.prepare(`
    SELECT report_id, token_digest, issue_number, submitted_at
    FROM feedback_receipts
    WHERE report_id = ?
  `).bind(reportId).first<FeedbackReceiptRow>()
  if (!row) return null

  const providedDigest = await digestReceiptToken(receiptToken)
  if (!timingSafeDigestEqual(providedDigest, row.token_digest)) return null

  return {
    reportId: row.report_id,
    issueNumber: row.issue_number,
    submittedAt: row.submitted_at,
  }
}

function generateReceiptToken(): string {
  const bytes = new Uint8Array(RECEIPT_TOKEN_BYTES)
  crypto.getRandomValues(bytes)
  return base64Url(bytes)
}

async function digestReceiptToken(receiptToken: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(receiptToken))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function timingSafeDigestEqual(provided: string, stored: string): boolean {
  const providedBytes = hexToBytes(provided)
  const storedBytes = hexToBytes(stored)
  if (!providedBytes || !storedBytes) return false
  let difference = 0
  for (let index = 0; index < providedBytes.length; index += 1) {
    difference |= providedBytes[index]! ^ storedBytes[index]!
  }
  return difference === 0
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null
  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}
