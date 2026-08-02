import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appConsoleEntries,
  clearAppConsoleEntries,
  installAppConsoleCapture,
  uninstallAppConsoleCapture,
} from './appConsole'
import { reportAppError } from './appErrorCatalog'

describe('appConsole', () => {
  beforeEach(() => {
    uninstallAppConsoleCapture()
    clearAppConsoleEntries()
  })

  afterEach(() => {
    uninstallAppConsoleCapture()
    vi.restoreAllMocks()
  })

  it('mirrors every console severity while preserving the native console calls', () => {
    const nativeDebug = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
    const nativeLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const nativeInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const nativeWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const nativeError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    installAppConsoleCapture()

    console.debug('debug value')
    console.log('log value', { count: 2 })
    console.info('info value')
    console.warn('warn value')
    console.error(new Error('error value'))

    expect(appConsoleEntries.value.map(entry => entry.severity))
      .toEqual(['debug', 'log', 'info', 'warn', 'error'])
    expect(appConsoleEntries.value[1]!.message).toContain('"count": 2')
    expect(appConsoleEntries.value[4]!.message).toContain('Error: error value')
    expect(appConsoleEntries.value[4]!.errorCode).toBe('OC-E1001')
    expect(nativeDebug).toHaveBeenCalledWith('debug value')
    expect(nativeLog).toHaveBeenCalledWith('log value', { count: 2 })
    expect(nativeInfo).toHaveBeenCalledWith('info value')
    expect(nativeWarn).toHaveBeenCalledWith('warn value')
    expect(nativeError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('preserves a structured application error code and diagnostic details', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    installAppConsoleCapture()

    reportAppError('OC-E2003', { path: 'missing.opencard' })

    expect(appConsoleEntries.value[0]).toMatchObject({
      severity: 'error',
      errorCode: 'OC-E2003',
    })
    expect(appConsoleEntries.value[0]!.message).toContain('missing.opencard')
  })

  it('does not wrap the console more than once when installed repeatedly', () => {
    const nativeLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    installAppConsoleCapture()
    installAppConsoleCapture()

    console.log('once')

    expect(appConsoleEntries.value).toHaveLength(1)
    expect(nativeLog).toHaveBeenCalledTimes(1)
  })

  it('formats circular values and keeps only the newest bounded history', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    installAppConsoleCapture()
    const circular: { self?: unknown } = {}
    circular.self = circular
    console.log(circular)
    expect(appConsoleEntries.value[0]!.message).toContain('[Circular]')

    for (let index = 0; index < 1_005; index += 1) console.log(index)
    expect(appConsoleEntries.value).toHaveLength(1_000)
    expect(appConsoleEntries.value[0]!.message).toBe('5')
    expect(appConsoleEntries.value[999]!.message).toBe('1004')
  })
})
