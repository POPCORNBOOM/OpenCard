import type {
  EditorNavigationResult,
  SessionIssueNavigationRequest,
  SessionNavigationToken,
} from '../../editor-runtime/model/editorIssue'

type EditorNavigator = {
  navigate?: (token: SessionNavigationToken) => Promise<EditorNavigationResult> | EditorNavigationResult
}

export async function navigateWorkspaceIssue(
  request: SessionIssueNavigationRequest,
  options: {
    hasSession: (sessionId: string) => boolean
    activateSession: (sessionId: string) => void
    waitForEditorMount: () => Promise<void>
    getActiveSessionId: () => string | null
    getEditorNavigator: () => EditorNavigator | null
  },
): Promise<void> {
  if (!options.hasSession(request.sessionId)) return

  options.activateSession(request.sessionId)
  await options.waitForEditorMount()
  if (options.getActiveSessionId() !== request.sessionId) return

  await options.getEditorNavigator()?.navigate?.(request.token)
}
