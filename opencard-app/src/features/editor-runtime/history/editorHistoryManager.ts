/** Owns undo/redo runtime state for every open editor session. */
import { computed, reactive, ref, type ComputedRef } from 'vue'
import type * as Monaco from 'monaco-editor'
import { createContentHistory, type ContentHistoryPort } from './contentHistory'
import type { HistoryOperationMeta } from './structuredHistory'

export type EditorHistoryKind = 'structured' | 'monaco' | 'none'

export function resolveEditorHistoryKind(editorId: string): EditorHistoryKind {
  if (editorId === 'monaco') return 'monaco'
  if (editorId === 'card-designer'
    || editorId === 'project-config'
    || editorId === 'font-registry'
    || editorId === 'icon-registry'
    || editorId === 'custom-block-registry'
    || editorId === 'dictionary') return 'structured'
  return 'none'
}

export type EditorHistoryState = {
  canUndo: boolean
  canRedo: boolean
}

export type EditorHistoryPort = {
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  undo: () => Promise<void>
  redo: () => Promise<void>
  flush: () => Promise<void>
}

type SessionHistory = {
  kind: EditorHistoryKind
  content?: ContentHistoryPort
  model?: Monaco.editor.ITextModel
  modelListener?: Monaco.IDisposable
  savedAlternativeVersionId?: number
  viewState?: Monaco.editor.ICodeEditorViewState | null
  updatingModel: boolean
  publish: (content: string, dirty: boolean) => void
  state: EditorHistoryState
}

const DEFAULT_OPERATION: HistoryOperationMeta = { mode: 'immediate' }
const GLOBAL_HISTORY_BYTE_LIMIT = 128 * 1024 * 1024

class EditorHistoryManager {
  private sessions = new Map<string, SessionHistory>()
  private entryLimit = 100
  private revision = ref(0)
  private trimmingGlobalBudget = false

  initialize(
    sessionId: string,
    kind: EditorHistoryKind,
    content: string,
    publish: (content: string, dirty: boolean) => void,
  ): void {
    this.release(sessionId)
    const state = reactive<EditorHistoryState>({ canUndo: false, canRedo: false })
    const session: SessionHistory = { kind, publish, state, updatingModel: false }
    this.sessions.set(sessionId, session)
    if (kind === 'structured') {
      session.content = createContentHistory({
        content,
        entryLimit: this.entryLimit,
        onChange: publish,
        onStateChange: () => this.refreshState(sessionId),
      })
    }
    this.refreshState(sessionId)
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  kind(sessionId: string): EditorHistoryKind {
    return this.sessions.get(sessionId)?.kind ?? 'none'
  }

  state(sessionId: string | null | undefined): EditorHistoryState {
    this.revision.value
    return sessionId ? this.sessions.get(sessionId)?.state ?? EMPTY_HISTORY_STATE : EMPTY_HISTORY_STATE
  }

  stateRef(sessionId: Readonly<{ value: string | null | undefined }>): ComputedRef<EditorHistoryState> {
    return computed(() => this.state(sessionId.value))
  }

  recordContent(sessionId: string, content: string, meta: HistoryOperationMeta = DEFAULT_OPERATION): void {
    const session = this.sessions.get(sessionId)
    if (!session || session.kind === 'none') return
    if (session.content) {
      session.content.record(content, meta)
      return
    }
    if (session.model && session.model.getValue() !== content) this.replaceMonacoValue(session, content)
  }

  getMonacoModel(sessionId: string): Monaco.editor.ITextModel | null {
    return this.sessions.get(sessionId)?.model ?? null
  }

  attachMonacoModel(sessionId: string, model: Monaco.editor.ITextModel): void {
    const session = this.sessions.get(sessionId)
    if (!session || session.kind !== 'monaco') return
    session.modelListener?.dispose()
    session.model = model
    session.savedAlternativeVersionId = model.getAlternativeVersionId()
    session.modelListener = model.onDidChangeContent(() => {
      if (session.updatingModel || !session.model) return
      session.publish(
        session.model.getValue(),
        session.model.getAlternativeVersionId() !== session.savedAlternativeVersionId,
      )
      this.refreshState(sessionId)
    })
    this.refreshState(sessionId)
  }

  getMonacoViewState(sessionId: string): Monaco.editor.ICodeEditorViewState | null {
    return this.sessions.get(sessionId)?.viewState ?? null
  }

  setMonacoViewState(sessionId: string, viewState: Monaco.editor.ICodeEditorViewState | null): void {
    const session = this.sessions.get(sessionId)
    if (session?.kind === 'monaco') session.viewState = viewState
  }

  syncExternalContent(sessionId: string, content: string, saved: boolean): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    if (session.content) {
      if (saved) session.content.reset(content)
      else session.content.record(content, DEFAULT_OPERATION)
    } else if (session.model && session.model.getValue() !== content) {
      this.replaceMonacoValue(session, content)
    }
    if (saved && session.model) session.savedAlternativeVersionId = session.model.getAlternativeVersionId()
    this.refreshState(sessionId)
  }

  markSaved(sessionId: string, content: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.content?.markSaved(content)
    if (session.model) session.savedAlternativeVersionId = session.model.getAlternativeVersionId()
    this.refreshState(sessionId)
  }

  async undo(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return
    if (session.content) session.content.undo()
    else await session.model?.undo()
    this.refreshState(sessionId)
  }

  async redo(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return
    if (session.content) session.content.redo()
    else await session.model?.redo()
    this.refreshState(sessionId)
  }

  async flush(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    session?.content?.flush()
    this.refreshState(sessionId)
  }

  async flushMany(sessionIds: readonly string[]): Promise<void> {
    await Promise.all(sessionIds.map(sessionId => this.flush(sessionId)))
  }

  setEntryLimit(limit: number): void {
    this.entryLimit = limit
    for (const [sessionId, session] of this.sessions) {
      session.content?.setEntryLimit(limit)
      this.refreshState(sessionId)
    }
  }

  release(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.content?.dispose()
    session.modelListener?.dispose()
    session.model?.dispose()
    this.sessions.delete(sessionId)
    this.revision.value += 1
  }

  releaseMany(sessionIds: readonly string[]): void {
    for (const sessionId of sessionIds) this.release(sessionId)
  }

  private replaceMonacoValue(session: SessionHistory, content: string): void {
    if (!session.model) return
    session.updatingModel = true
    try {
      session.model.setValue(content)
    } finally {
      session.updatingModel = false
    }
  }

  private refreshState(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.state.canUndo = session.content?.canUndo.value ?? session.model?.canUndo() ?? false
    session.state.canRedo = session.content?.canRedo.value ?? session.model?.canRedo() ?? false
    this.revision.value += 1
    this.enforceGlobalBudget()
  }

  private enforceGlobalBudget(): void {
    if (this.trimmingGlobalBudget) return
    this.trimmingGlobalBudget = true
    try {
      while (true) {
        const candidates = [...this.sessions.values()]
          .flatMap(session => session.content ? [session.content] : [])
          .sort((left, right) => right.getByteSize() - left.getByteSize())
        const total = candidates.reduce((sum, history) => sum + history.getByteSize(), 0)
        if (total <= GLOBAL_HISTORY_BYTE_LIMIT || !candidates[0]?.dropOldest()) break
      }
    } finally {
      this.trimmingGlobalBudget = false
    }
  }
}

const EMPTY_HISTORY_STATE: EditorHistoryState = Object.freeze({ canUndo: false, canRedo: false })

export const editorHistoryManager = new EditorHistoryManager()
