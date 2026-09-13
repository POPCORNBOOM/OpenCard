import { beforeEach, describe, expect, it, vi } from 'vitest'

const notifications = vi.hoisted(() => ({ notifyWarning: vi.fn() }))
const output = vi.hoisted(() => ({ publishAppOutput: vi.fn() }))

vi.mock('../notifications/titlebarNotices', () => ({
  notifyWarning: notifications.notifyWarning,
}))

vi.mock('./appOutput', () => ({ publishAppOutput: output.publishAppOutput }))

import { reportCatalogWarnings } from './catalogWarningReporter'

const translate = (key: string, params?: Record<string, unknown>): string =>
  params ? `${key}:${JSON.stringify(params)}` : key

const report = (warnings: readonly { path: string; reason: string }[]): void => {
  reportCatalogWarnings({
    warnings,
    summaryKey: 'status.skipped',
    itemKey: 'status.skippedItem',
    translate,
  })
}

describe('reportCatalogWarnings', () => {
  beforeEach(() => {
    notifications.notifyWarning.mockClear()
    output.publishAppOutput.mockClear()
  })

  it('stays silent when nothing was skipped', () => {
    report([])

    expect(notifications.notifyWarning).not.toHaveBeenCalled()
    expect(output.publishAppOutput).not.toHaveBeenCalled()
  })

  it('sends one summary notice and one output entry per skipped entry', () => {
    report([
      { path: '/appdata/templates/alpha-pack', reason: 'Invalid manifest' },
      { path: '/appdata/templates/beta-pack', reason: 'Template packages cannot be symbolic links' },
    ])

    expect(output.publishAppOutput).toHaveBeenNthCalledWith(1, {
      severity: 'warning',
      message: 'status.skippedItem:{"name":"alpha-pack"}',
      detail: '/appdata/templates/alpha-pack: Invalid manifest',
    })
    expect(output.publishAppOutput).toHaveBeenNthCalledWith(2, {
      severity: 'warning',
      message: 'status.skippedItem:{"name":"beta-pack"}',
      detail: '/appdata/templates/beta-pack: Template packages cannot be symbolic links',
    })
    expect(notifications.notifyWarning).toHaveBeenCalledOnce()
    expect(notifications.notifyWarning).toHaveBeenCalledWith('status.skipped:{"count":2}')
  })

  it('reports a still-broken entry only once across repeated loads', () => {
    const warnings = [{ path: '/appdata/templates/gamma-pack', reason: 'Invalid manifest' }]

    report(warnings)
    report(warnings)

    expect(notifications.notifyWarning).toHaveBeenCalledOnce()
    expect(output.publishAppOutput).toHaveBeenCalledOnce()
  })

  it('reports only the entries that became unusable since the last load', () => {
    report([{ path: '/appdata/templates/delta-pack', reason: 'Invalid manifest' }])
    notifications.notifyWarning.mockClear()
    output.publishAppOutput.mockClear()

    report([
      { path: '/appdata/templates/delta-pack', reason: 'Invalid manifest' },
      { path: '/appdata/templates/epsilon-pack', reason: 'Invalid manifest' },
    ])

    expect(output.publishAppOutput).toHaveBeenCalledOnce()
    expect(output.publishAppOutput).toHaveBeenCalledWith(expect.objectContaining({
      detail: '/appdata/templates/epsilon-pack: Invalid manifest',
    }))
    expect(notifications.notifyWarning).toHaveBeenCalledWith('status.skipped:{"count":1}')
  })
})
