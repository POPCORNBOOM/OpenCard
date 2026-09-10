import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appOutputEntries, clearAppOutputEntries, publishAppOutput } from './appOutput'
import { reportAppError } from './appErrorCatalog'

describe('appOutput', () => {
  beforeEach(() => {
    clearAppOutputEntries()
    vi.restoreAllMocks()
  })

  it('stores only what a module explicitly publishes', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    console.log('module noise')
    console.warn('unhandled warning')
    console.error(new Error('unhandled failure'))
    expect(appOutputEntries.value).toHaveLength(0)

    publishAppOutput({ severity: 'success', message: '已安装 2 个包' })
    expect(appOutputEntries.value).toMatchObject([
      { severity: 'success', message: '已安装 2 个包' },
    ])
    expect(appOutputEntries.value[0]!.timestamp).toBeTypeOf('number')
  })

  it('ignores empty messages and keeps the newest bounded history', () => {
    publishAppOutput({ severity: 'info', message: '   ' })
    expect(appOutputEntries.value).toHaveLength(0)

    for (let index = 0; index < 1_005; index += 1) {
      publishAppOutput({ severity: 'info', message: `entry ${index}` })
    }
    expect(appOutputEntries.value).toHaveLength(1_000)
    expect(appOutputEntries.value[0]!.message).toBe('entry 5')
    expect(appOutputEntries.value[999]!.message).toBe('entry 1004')
  })

  it('publishes a classified error entry with a one-line detail and still logs to the console', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    reportAppError('OC-E3017', { key: 'github-alice-my-theme', error: 'download failed' })

    expect(appOutputEntries.value).toHaveLength(1)
    expect(appOutputEntries.value[0]).toMatchObject({ severity: 'error', code: 'OC-E3017' })
    expect(appOutputEntries.value[0]!.detail).toBe('{ "key": "github-alice-my-theme", "error": "download failed" }')
    expect(appOutputEntries.value[0]!.message).toContain('OC-E3017')
    expect(consoleError).toHaveBeenCalledOnce()
  })

  it('publishes a classified error entry without a detail when nothing else is known', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    reportAppError('OC-E5001')

    expect(appOutputEntries.value[0]).toMatchObject({ severity: 'error', code: 'OC-E5001' })
    expect(appOutputEntries.value[0]!.detail).toBeUndefined()
  })
})
