import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))

import {
  fetchRemote,
  initializeRepository,
  inspectRepository,
  readHistory,
} from './gitService'

describe('gitService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.invoke.mockResolvedValue({ ok: true, value: null })
  })

  it('passes project-only commands through the shared boundary', async () => {
    await inspectRepository('D:/Cards/demo')

    expect(mocks.invoke).toHaveBeenCalledWith('git_inspect', {
      projectRoot: 'D:/Cards/demo',
    })
  })

  it('passes structured requests without flattening their fields', async () => {
    const request = { limit: 50, start: null }

    await readHistory('D:/Cards/demo', request)

    expect(mocks.invoke).toHaveBeenCalledWith('git_history', {
      projectRoot: 'D:/Cards/demo',
      request,
    })
  })

  it('uses the initialize command identity argument shape', async () => {
    const identity = { name: 'Card Author', email: 'author@example.com' }

    await initializeRepository('D:/Cards/demo', identity)

    expect(mocks.invoke).toHaveBeenCalledWith('git_initialize', {
      projectRoot: 'D:/Cards/demo',
      identity,
    })
  })

  it('passes a temporary token only to invoke without logging or serializing it', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const stringifySpy = vi.spyOn(JSON, 'stringify')
    const request = {
      remote: 'origin',
      refspecs: [],
      authentication: {
        type: 'https-token' as const,
        username: 'token',
        token: 'one-call-secret',
      },
    }

    await fetchRemote('D:/Cards/demo', request)

    expect(mocks.invoke).toHaveBeenCalledWith('git_fetch', {
      projectRoot: 'D:/Cards/demo',
      request,
    })
    expect(logSpy).not.toHaveBeenCalled()
    expect(stringifySpy).not.toHaveBeenCalled()
    logSpy.mockRestore()
    stringifySpy.mockRestore()
  })
})
