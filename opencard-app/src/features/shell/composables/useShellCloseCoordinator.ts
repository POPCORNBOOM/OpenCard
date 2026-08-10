/** Coordinates guarded close requests without owning session or resource truth. */
import type { Ref } from 'vue'
import type {
  EditorSession,
  SessionSaveReceipt,
} from '../../workspace/store/editorSessionStore'
import type { ProjectCloseDestination } from '../shellPage'
import {
  useUnsavedSessionGuard,
  type UnsavedCloseIntent,
} from './useUnsavedSessionGuard'

type CloseResult = void | Promise<void>

type ShellCloseCompletions = {
  sessions: (sessionIds: readonly string[]) => CloseResult
  project: (destination: ProjectCloseDestination) => CloseResult
  trash: (path: string) => CloseResult
  application: () => CloseResult
  restoreFile: (entryId: string) => CloseResult
  restoreProject: (commitId: string) => CloseResult
}

type UseShellCloseCoordinatorOptions = {
  sessions: Readonly<Ref<readonly EditorSession[]>>
  flushAffectedSessions: (sessionIds: readonly string[]) => Promise<void>
  pickDraftDirectory: () => Promise<string | null>
  fileExists: (path: string) => Promise<boolean>
  saveSession: (sessionId: string, targetPath?: string) => Promise<SessionSaveReceipt>
  completions: ShellCloseCompletions
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function isSameOrDescendantPath(path: string, ancestor: string): boolean {
  const normalizedPath = normalizePath(path)
  const normalizedAncestor = normalizePath(ancestor)
  return normalizedPath === normalizedAncestor || normalizedPath.startsWith(`${normalizedAncestor}/`)
}

export function useShellCloseCoordinator(options: UseShellCloseCoordinatorOptions) {
  async function completeClose(intent: UnsavedCloseIntent): Promise<void> {
    if (intent.type === 'project') {
      await options.completions.project(intent.projectDestination ?? 'current')
      return
    }
    if (intent.type === 'app') {
      await options.completions.application()
      return
    }
    if (intent.type === 'trash') {
      if (!intent.path) throw new Error('trash close intent requires a path')
      await options.completions.trash(intent.path)
      return
    }
    if (intent.type === 'restore-file') {
      if (!intent.historyEntryId) throw new Error('file restore intent requires a history entry')
      await options.completions.restoreFile(intent.historyEntryId)
      return
    }
    if (intent.type === 'restore-project') {
      if (!intent.targetCommitId) throw new Error('project restore intent requires a target commit')
      await options.completions.restoreProject(intent.targetCommitId)
      return
    }
    await options.completions.sessions(intent.sessionIds)
  }

  const guard = useUnsavedSessionGuard({
    sessions: options.sessions,
    pickDraftDirectory: options.pickDraftDirectory,
    fileExists: options.fileExists,
    saveSession: options.saveSession,
    completeClose,
  })

  async function request(intent: UnsavedCloseIntent): Promise<void> {
    await options.flushAffectedSessions(intent.sessionIds)
    await guard.requestClose(intent)
  }

  async function requestSessionClose(sessionIds: readonly string[]): Promise<void> {
    await request({ type: 'sessions', sessionIds })
  }

  async function requestProjectClose(
    destination: ProjectCloseDestination = 'current',
  ): Promise<void> {
    await request({
      type: 'project',
      sessionIds: options.sessions.value
        .filter(session => session.resourceKind === 'workspace')
        .map(session => session.id),
      projectDestination: destination,
    })
  }

  async function requestPathTrash(path: string): Promise<void> {
    await request({
      type: 'trash',
      sessionIds: options.sessions.value
        .filter(session => session.path && isSameOrDescendantPath(session.path, path))
        .map(session => session.id),
      path,
    })
  }

  async function requestApplicationClose(): Promise<void> {
    await request({
      type: 'app',
      sessionIds: options.sessions.value.map(session => session.id),
    })
  }

  async function requestFileRestore(sessionId: string, historyEntryId: string): Promise<void> {
    await request({
      type: 'restore-file',
      sessionIds: [sessionId],
      historyEntryId,
    })
  }

  async function requestProjectRestore(targetCommitId: string): Promise<void> {
    await request({
      type: 'restore-project',
      sessionIds: options.sessions.value
        .filter(session => session.resourceKind === 'workspace')
        .map(session => session.id),
      targetCommitId,
    })
  }

  async function discardSingle(): Promise<void> {
    const row = guard.decisions.value[0]
    if (!row || guard.isBusy.value) return
    if (row.decision !== 'pending') guard.resetDecision(row.sessionId)
    guard.setRowSelected(row.sessionId, true)
    guard.markSelectedDiscard()
    await guard.confirm()
  }

  async function saveSingle(): Promise<void> {
    const row = guard.decisions.value[0]
    if (!row || guard.isBusy.value) return
    if (row.decision !== 'pending') guard.resetDecision(row.sessionId)
    guard.setRowSelected(row.sessionId, true)
    if (await guard.markSelectedSave()) await guard.confirm()
  }

  return {
    pendingIntent: guard.pendingIntent,
    decisions: guard.decisions,
    isOpen: guard.isOpen,
    isBusy: guard.isBusy,
    globalError: guard.globalError,
    selectedCount: guard.selectedCount,
    pendingCount: guard.pendingCount,
    saveCount: guard.saveCount,
    discardCount: guard.discardCount,
    allPendingSelected: guard.allPendingSelected,
    somePendingSelected: guard.somePendingSelected,
    canConfirm: guard.canConfirm,
    setRowSelected: guard.setRowSelected,
    setAllPendingSelected: guard.setAllPendingSelected,
    markSelectedDiscard: guard.markSelectedDiscard,
    markSelectedSave: guard.markSelectedSave,
    resetDecision: guard.resetDecision,
    confirm: guard.confirm,
    cancel: guard.cancel,
    requestSessionClose,
    requestProjectClose,
    requestPathTrash,
    requestApplicationClose,
    requestFileRestore,
    requestProjectRestore,
    discardSingle,
    saveSingle,
  }
}
