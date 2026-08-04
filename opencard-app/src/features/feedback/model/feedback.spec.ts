import { describe, expect, it } from 'vitest'
import {
  createFeedbackSubmission,
  FEEDBACK_LIMITS,
  sanitizeDiagnosticText,
} from './feedback'

const environment = { appVersion: '0.2.13', locale: 'zh-CN', platform: 'Windows' }

describe('feedback model', () => {
  it('builds a bounded suggestion without diagnostics', () => {
    const submission = createFeedbackSubmission({
      kind: 'suggestion',
      message: `  ${'x'.repeat(FEEDBACK_LIMITS.message + 20)}  `,
      contact: ' user@example.com ',
      includeDiagnostics: false,
    }, environment, {
      errorMessage: 'must not be included',
    }, {
      reportId: 'report-1',
      submittedAt: '2026-07-31T00:00:00.000Z',
    })

    expect(submission).toMatchObject({
      schemaVersion: 1,
      reportId: 'report-1',
      submittedAt: '2026-07-31T00:00:00.000Z',
      kind: 'suggestion',
      contact: 'user@example.com',
      environment,
    })
    expect(submission.message).toHaveLength(FEEDBACK_LIMITS.message)
    expect(submission.diagnostics).toBeUndefined()
  })

  it('redacts local identity and credentials from diagnostics', () => {
    const diagnostic = [
      'C:\\Users\\Alice\\Cards\\secret.ocdocument',
      '/home/bob/projects/opencard/file.ts',
      'https://alice:password@example.com/report?token=secret&safe=yes',
      'alice@example.com',
    ].join('\n')

    expect(sanitizeDiagnosticText(diagnostic)).toBe([
      '<local-path>',
      '<local-path>',
      'https://<credentials>@example.com/report?token=<redacted>&safe=yes',
      '<email>',
    ].join('\n'))
  })

  it('keeps only the newest bounded log lines when diagnostics are approved', () => {
    const logs = Array.from({ length: FEEDBACK_LIMITS.logLines + 5 }, (_, index) => (
      `${index}: C:\\Users\\Alice\\${'x'.repeat(FEEDBACK_LIMITS.logLine + 20)}`
    ))
    const submission = createFeedbackSubmission({
      kind: 'bug',
      message: 'The editor stopped responding.',
      includeDiagnostics: true,
    }, environment, { logs }, { reportId: 'report-2' })

    expect(submission.diagnostics?.logs).toHaveLength(FEEDBACK_LIMITS.logLines)
    expect(submission.diagnostics?.logs?.[0]).toContain('5: <local-path>')
    expect(submission.diagnostics?.logs?.every(line => line.length <= FEEDBACK_LIMITS.logLine)).toBe(true)
  })

  it('rejects an empty message', () => {
    expect(() => createFeedbackSubmission({
      kind: 'bug',
      message: '   ',
      includeDiagnostics: false,
    }, environment)).toThrow('feedback message is required')
  })
})
