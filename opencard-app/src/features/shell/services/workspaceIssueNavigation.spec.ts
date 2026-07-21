import { describe, expect, it, vi } from 'vitest'
import { navigateWorkspaceIssue } from './workspaceIssueNavigation'

const request = {
  sessionId: 'session-b',
  token: { protocol: 'card-designer', version: 1 },
} as const

describe('navigateWorkspaceIssue', () => {
  it('activates the source session, waits for its editor, and forwards the opaque token', async () => {
    let activeSessionId = 'session-a'
    const navigate = vi.fn().mockResolvedValue('success')
    const activateSession = vi.fn((sessionId: string) => { activeSessionId = sessionId })
    const waitForEditorMount = vi.fn().mockResolvedValue(undefined)

    await navigateWorkspaceIssue(request, {
      hasSession: () => true,
      activateSession,
      waitForEditorMount,
      getActiveSessionId: () => activeSessionId,
      getEditorNavigator: () => ({ navigate }),
    })

    expect(activateSession).toHaveBeenCalledWith('session-b')
    expect(waitForEditorMount).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledWith(request.token)
  })

  it('silently ignores closed sessions', async () => {
    const activateSession = vi.fn()
    const navigate = vi.fn()

    await navigateWorkspaceIssue(request, {
      hasSession: () => false,
      activateSession,
      waitForEditorMount: async () => {},
      getActiveSessionId: () => null,
      getEditorNavigator: () => ({ navigate }),
    })

    expect(activateSession).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not navigate when activation did not produce the requested active session', async () => {
    const navigate = vi.fn()

    await navigateWorkspaceIssue(request, {
      hasSession: () => true,
      activateSession: () => {},
      waitForEditorMount: async () => {},
      getActiveSessionId: () => 'session-a',
      getEditorNavigator: () => ({ navigate }),
    })

    expect(navigate).not.toHaveBeenCalled()
  })
})
