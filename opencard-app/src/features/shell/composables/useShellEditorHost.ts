/** Adapts the active editor session to a registered editor without owning session truth. */
import { computed, ref, watch, type Component, type DeepReadonly, type Ref } from 'vue'
import UnsupportedFileEditor from '../../../components/editors/UnsupportedFileEditor.vue'
import MonacoEditor from '../../../components/editors/MonacoEditor.vue'
import { getOcTheme } from '../../../shared/ui/foundation'
import type { AppSettings } from '../../settings/model/appSettings'
import type {
  CardDesignerLayoutState,
  CardDesignerMode,
  CardDesignerViewState,
  EditorViewportTransform,
} from '../../editor-runtime/model/editorUiState'
import type {
  EditorNavigationResult,
  SessionNavigationToken,
} from '../../editor-runtime/model/editorIssue'
import { editorRegistry } from '../../editor-runtime/registry/editorRegistry'
import { resolveFileType, resolveFileTypeById } from '../../workspace/model/fileTypes'
import type {
  EditorSession,
  EditorSessionUiState,
  SessionSaveResult,
} from '../../workspace/store/editorSessionStore'
import type { ProjectProfile } from '../../workspace/model/projectMetadata'
import { reportAppError } from '../../logging/appErrorCatalog'
import { editorHistoryManager } from '../../editor-runtime/history/editorHistoryManager'
import type { HistoryOperationMeta } from '../../editor-runtime/history/structuredHistory'
import type { CardFaceKey } from '../../../entities/card/model'
import type { PreparedCardRender } from '../../card-rendering/renderPipeline'
import type { EditorComparisonInput } from '../../editor-runtime/registry/editorRegistry'

const VIEWPORT_TRANSFORM_PERSIST_DELAY_MS = 200

export type ShellEditorRef = {
  save?: () => Promise<void> | void
  flush?: () => Promise<void> | void
  undo?: () => Promise<void> | void
  redo?: () => Promise<void> | void
  canUndo?: boolean
  canRedo?: boolean
  navigate?: (token: SessionNavigationToken) => Promise<EditorNavigationResult> | EditorNavigationResult
  importDataTableWorkbook?: () => Promise<void> | void
  exportDataTableWorkbook?: () => Promise<void> | void
  dataTableWorkbookBusy?: boolean
  canExportDataTableWorkbook?: boolean
  getImageRenderSource?: () => { render: PreparedCardRender; activeFaceKey: CardFaceKey } | null
}

type SessionActions = {
  updateDraftContent: (sessionId: string, content: string) => void
  setSessionDirtyState: (sessionId: string, isDirty: boolean) => void
  updateSessionUiState: (sessionId: string, patch: EditorSessionUiState) => void
  saveActiveSession: () => Promise<SessionSaveResult>
}

type UseShellEditorHostOptions = {
  activeSession: Readonly<Ref<EditorSession | null>>
  projectPath: Readonly<Ref<string>>
  projectProfile: Readonly<Ref<ProjectProfile | null>>
  settings: Readonly<Ref<DeepReadonly<AppSettings>>>
  sessionActions: SessionActions
  comparison?: Readonly<Ref<EditorComparisonInput | null>>
}

const AUTO_SAVE_REGISTRY_EDITOR_IDS = new Set(['font-registry', 'icon-registry'])

type PendingViewportTransform = {
  sessionId: string
  editorId: 'card-designer' | 'image-preview'
  value: EditorViewportTransform
}

function getPathDirectory(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const separatorIndex = normalizedPath.lastIndexOf('/')
  return separatorIndex > 0 ? normalizedPath.slice(0, separatorIndex) : ''
}

function resolveSessionFileType(session: Pick<EditorSession, 'fileTypeId' | 'path'>) {
  const fileTypeFromId = resolveFileTypeById(session.fileTypeId)
  if (!session.path) return fileTypeFromId
  const fileTypeFromPath = resolveFileType(session.path)
  return fileTypeFromPath.id === session.fileTypeId ? fileTypeFromPath : fileTypeFromId
}

export function useShellEditorHost(options: UseShellEditorHostOptions) {
  const editorRef = ref<ShellEditorRef | null>(null)
  let viewportTransformPersistTimer: number | null = null
  let pendingViewportTransform: PendingViewportTransform | null = null
  let disposed = false

  function recordDraftContent(sessionId: string, value: string, history?: HistoryOperationMeta): void {
    const session = options.activeSession.value
    if (session?.mode === 'diff') return
    editorHistoryManager.recordContent(sessionId, value, history)
    if (session?.id === sessionId && AUTO_SAVE_REGISTRY_EDITOR_IDS.has(session.editorId)) {
      void options.sessionActions.saveActiveSession()
    }
  }

  const resourceRootPath = computed<string | null>(() => {
    const session = options.activeSession.value
    if (!session) return null
    if (session.resourceKind === 'workspace') return options.projectPath.value || null
    if (session.resourceKind === 'external' && session.path) return getPathDirectory(session.path) || null
    return null
  })

  const themeId = computed(() => (
    options.settings.value.appearance.theme === 'system'
      ? getOcTheme()
      : options.settings.value.appearance.theme
  ))
  const themeOverrides = computed(() => options.settings.value.appearance.themeOverrides[themeId.value])

  const component = computed<Component | null>(() => {
    const session = options.activeSession.value
    if (!session) return null
    const editor = editorRegistry.getEditor(session.editorId)
    const fileType = resolveSessionFileType(session)
    if (session.mode === 'diff' && editor && !editor.supportsDiff && fileType.language) return MonacoEditor
    return editor?.component ?? UnsupportedFileEditor
  })

  const historyState = computed(() => editorHistoryManager.state(options.activeSession.value?.id))
  const canUndo = computed(() => historyState.value.canUndo)
  const canRedo = computed(() => historyState.value.canRedo)

  const key = computed(() => {
    const session = options.activeSession.value
    if (!session) return 'none'
    const base = [session.id, session.path ?? `draft://${session.id}`, session.editorId]
    if (session.mode !== 'diff') return base.join('|')
    return [...base, 'diff', session.diff?.beforeRevisionId ?? '', session.diff?.afterRevisionId ?? ''].join('|')
  })

  const props = computed<Record<string, unknown>>(() => {
    const session = options.activeSession.value
    if (!session) return {}

    const sessionId = session.id
    const fileType = resolveSessionFileType(session)
    const filePath = session.path ?? `draft://${session.id}`
    const editor = editorRegistry.getEditor(session.editorId) ?? editorRegistry.getEditor('unsupported-file')
    if (session.mode === 'diff' && editor && !editor.supportsDiff && fileType.language) {
      return {
        sessionId,
        mode: 'diff',
        comparison: options.comparison?.value ?? undefined,
        modelValue: session.draftContent,
        language: fileType.language,
        themeId: themeId.value,
        themeOverrides: themeOverrides.value,
      }
    }
    if (editor && editor.id !== 'monaco') {
      const baseProps = {
        sessionId,
        mode: session.mode,
        comparison: options.comparison?.value ?? undefined,
        filePath,
        fileName: session.name,
        resourceRootPath: resourceRootPath.value,
        modelValue: session.draftContent,
        savedContent: session.savedContent,
        themeId: themeId.value,
        themeOverrides: themeOverrides.value,
        ...(session.mode === 'diff' ? {} : {
          'onUpdate:modelValue': (value: string, history?: HistoryOperationMeta) => {
            recordDraftContent(sessionId, value, history)
          },
        }),
      }

      if (editor.id === 'card-designer') {
        return {
          ...baseProps,
          fileName: session.name,
          resourceRootPath: resourceRootPath.value,
          remoteResourcePolicy: session.resourceKind === 'workspace'
            ? options.projectProfile.value?.remoteResources
            : undefined,
          cardDesignerMode: session.uiState?.cardDesigner?.mode ?? 'design',
          viewportTransform: session.uiState?.cardDesigner?.viewportTransform,
          cardDesignerLayout: session.uiState?.cardDesigner?.layout,
          cardDesignerView: session.uiState?.cardDesigner?.view,
          structureTreeSelectionBehavior:
            options.settings.value.workspace.structureTreeSelectionBehavior,
          structureTreeScrollToSelection:
            options.settings.value.workspace.structureTreeScrollToSelection,
          showSelectionPositionOnMove:
            options.settings.value.workspace.showSelectionPositionOnMove,
          showSelectionSizeOnResize:
            options.settings.value.workspace.showSelectionSizeOnResize,
          alignmentSnappingEnabledByDefault:
            options.settings.value.workspace.alignmentSnappingEnabledByDefault,
        }
      }

      if (editor.id === 'image-preview') {
        return {
          ...baseProps,
          viewportTransform: session.uiState?.imagePreview?.viewportTransform,
          pixelated: session.uiState?.imagePreview?.pixelated ?? false,
        }
      }

      return baseProps
    }

    return {
      sessionId,
      mode: session.mode,
      comparison: options.comparison?.value ?? undefined,
      modelValue: session.draftContent,
      savedContent: session.savedContent,
      ...(session.mode === 'diff' ? {} : {
        'onUpdate:modelValue': (value: string, history?: HistoryOperationMeta) => {
          recordDraftContent(sessionId, value, history)
        },
      }),
      language: fileType.language ?? 'plaintext',
      themeId: themeId.value,
      themeOverrides: themeOverrides.value,
    }
  })

  const isCardDesigner = computed(() => {
    const editorId = options.activeSession.value?.editorId
    return Boolean(editorId && editorRegistry.getEditor(editorId)?.id === 'card-designer')
  })

  const isDictionaryEditor = computed(() => {
    const editorId = options.activeSession.value?.editorId
    return Boolean(editorId && editorRegistry.getEditor(editorId)?.id === 'dictionary')
  })

  const hasDataTableWorkbook = computed(() => isCardDesigner.value || isDictionaryEditor.value)

  const cardDesignerMode = computed<CardDesignerMode>(() => (
    options.activeSession.value?.uiState?.cardDesigner?.mode ?? 'design'
  ))

  const dataTableWorkbookBusy = computed(() => (
    hasDataTableWorkbook.value && editorRef.value?.dataTableWorkbookBusy === true
  ))

  const canExportDataTableWorkbook = computed(() => (
    hasDataTableWorkbook.value && editorRef.value?.canExportDataTableWorkbook === true
  ))

  const canRenderCardImage = computed(() => (
    isCardDesigner.value && editorRef.value?.getImageRenderSource?.() != null
  ))

  function persistPendingViewportTransform(): void {
    if (viewportTransformPersistTimer !== null) {
      window.clearTimeout(viewportTransformPersistTimer)
      viewportTransformPersistTimer = null
    }

    const pending = pendingViewportTransform
    pendingViewportTransform = null
    if (!pending) return

    options.sessionActions.updateSessionUiState(
      pending.sessionId,
      pending.editorId === 'card-designer'
        ? { cardDesigner: { viewportTransform: pending.value } }
        : { imagePreview: { viewportTransform: pending.value } },
    )
  }

  function handleViewportTransform(value: EditorViewportTransform): void {
    const session = options.activeSession.value
    if (!session || (session.editorId !== 'card-designer' && session.editorId !== 'image-preview')) return

    if (pendingViewportTransform && pendingViewportTransform.sessionId !== session.id) {
      persistPendingViewportTransform()
    }
    pendingViewportTransform = { sessionId: session.id, editorId: session.editorId, value }
    if (viewportTransformPersistTimer !== null) window.clearTimeout(viewportTransformPersistTimer)
    viewportTransformPersistTimer = window.setTimeout(
      persistPendingViewportTransform,
      VIEWPORT_TRANSFORM_PERSIST_DELAY_MS,
    )
  }

  function handleCardDesignerLayout(value: CardDesignerLayoutState): void {
    const session = options.activeSession.value
    if (!session || session.editorId !== 'card-designer') return
    options.sessionActions.updateSessionUiState(session.id, { cardDesigner: { layout: value } })
  }

  function handleCardDesignerMode(value: CardDesignerMode): void {
    const session = options.activeSession.value
    if (!session || session.editorId !== 'card-designer') return
    options.sessionActions.updateSessionUiState(session.id, { cardDesigner: { mode: value } })
  }

  function handleCardDesignerView(value: CardDesignerViewState): void {
    const session = options.activeSession.value
    if (!session || session.editorId !== 'card-designer') return
    options.sessionActions.updateSessionUiState(session.id, { cardDesigner: { view: value } })
  }

  function handleImagePreviewPixelated(value: boolean): void {
    const session = options.activeSession.value
    if (!session || session.editorId !== 'image-preview') return
    options.sessionActions.updateSessionUiState(session.id, { imagePreview: { pixelated: value } })
  }

  function handleModified(modified: boolean): void {
    const session = options.activeSession.value
    if (session) options.sessionActions.setSessionDirtyState(session.id, modified)
  }

  async function handleSaveEvent(): Promise<void> {
    const sessionId = options.activeSession.value?.id
    if (!sessionId) return
    try {
      await editorHistoryManager.flush(sessionId)
      await options.sessionActions.saveActiveSession()
    } catch (error) {
      reportAppError('OC-E4002', error)
    }
  }

  async function save(): Promise<void> {
    const session = options.activeSession.value
    if (!session) return
    await editorHistoryManager.flush(session.id)
    if (editorRegistry.getEditor(session.editorId)?.id !== 'monaco'
      && editorRef.value?.save) {
      await editorRef.value.save()
      return
    }
    await options.sessionActions.saveActiveSession()
  }

  async function undo(): Promise<void> {
    const sessionId = options.activeSession.value?.id
    if (!sessionId || !canUndo.value) return
    await editorRef.value?.flush?.()
    await editorHistoryManager.undo(sessionId)
  }

  async function redo(): Promise<void> {
    const sessionId = options.activeSession.value?.id
    if (!sessionId || !canRedo.value) return
    await editorRef.value?.flush?.()
    await editorHistoryManager.redo(sessionId)
  }

  async function importDataTableWorkbook(): Promise<void> {
    if (!hasDataTableWorkbook.value || dataTableWorkbookBusy.value) return
    await editorRef.value?.importDataTableWorkbook?.()
  }

  async function exportDataTableWorkbook(): Promise<void> {
    if (!hasDataTableWorkbook.value || dataTableWorkbookBusy.value || !canExportDataTableWorkbook.value) return
    await editorRef.value?.exportDataTableWorkbook?.()
  }

  function getCardImageRenderSource() {
    return isCardDesigner.value ? editorRef.value?.getImageRenderSource?.() ?? null : null
  }

  async function flushAffectedSessions(sessionIds: readonly string[]): Promise<void> {
    const activeId = options.activeSession.value?.id
    if (activeId && sessionIds.includes(activeId)) await editorRef.value?.flush?.()
    await editorHistoryManager.flushMany(sessionIds)
  }

  const stopSessionWatch = watch(
    () => options.activeSession.value?.id ?? null,
    () => persistPendingViewportTransform(),
  )

  function dispose(): void {
    if (disposed) return
    disposed = true
    stopSessionWatch()
    persistPendingViewportTransform()
  }

  return {
    editorRef,
    component,
    key,
    props,
    resourceRootPath,
    isCardDesigner,
    isDictionaryEditor,
    canUndo,
    canRedo,
    cardDesignerMode,
    dataTableWorkbookBusy,
    canExportDataTableWorkbook,
    canRenderCardImage,
    handleViewportTransform,
    handleCardDesignerMode,
    handleCardDesignerLayout,
    handleCardDesignerView,
    handleImagePreviewPixelated,
    handleModified,
    handleSaveEvent,
    save,
    undo,
    redo,
    importDataTableWorkbook,
    exportDataTableWorkbook,
    getCardImageRenderSource,
    flushAffectedSessions,
    dispose,
  }
}
