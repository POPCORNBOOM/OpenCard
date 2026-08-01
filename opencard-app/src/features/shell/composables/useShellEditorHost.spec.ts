import { nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MonacoEditor from '../../../components/editors/MonacoEditor.vue'
import { createDefaultAppSettings } from '../../settings/model/appSettings'
import type { EditorSession } from '../../workspace/store/editorSessionStore'
import { useShellEditorHost } from './useShellEditorHost'

vi.mock('../../../components/editors/MonacoEditor.vue', () => ({
  default: { name: 'MockMonacoEditor' },
}))

function createSession(patch: Partial<EditorSession> = {}): EditorSession {
  return {
    id: 'session-a',
    resourceKind: 'draft',
    path: null,
    fileTypeId: 'opencard',
    name: 'card.opencard',
    editorId: 'card-designer',
    savedContent: '{}',
    draftContent: '{}',
    isDirty: false,
    isPreview: false,
    ...patch,
  }
}

function createHost(session = createSession()) {
  const activeSession = ref<EditorSession | null>(session)
  const updateDraftContent = vi.fn()
  const setSessionDirtyState = vi.fn()
  const updateSessionUiState = vi.fn()
  const saveActiveSession = vi.fn(async () => 'saved' as const)
  const host = useShellEditorHost({
    activeSession,
    projectPath: ref('D:/project'),
    projectProfile: ref({
      remoteResources: { mode: 'allowlist', allowedHosts: ['images.example.com'] },
    }),
    settings: ref(createDefaultAppSettings()),
    sessionActions: {
      updateDraftContent,
      setSessionDirtyState,
      updateSessionUiState,
      saveActiveSession,
    },
  })
  return {
    host,
    activeSession,
    updateDraftContent,
    setSessionDirtyState,
    updateSessionUiState,
    saveActiveSession,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useShellEditorHost', () => {
  it('projects registered editor props and resource roots', () => {
    const workspace = createHost(createSession({
      resourceKind: 'workspace',
      path: 'D:/project/cards/card.opencard',
    }))

    expect(workspace.host.key.value).toBe('session-a|D:/project/cards/card.opencard|card-designer')
    expect(workspace.host.resourceRootPath.value).toBe('D:/project')
    expect(workspace.host.props.value).toMatchObject({
      filePath: 'D:/project/cards/card.opencard',
      fileName: 'card.opencard',
      cardDesignerMode: 'design',
      resourceRootPath: 'D:/project',
      remoteResourcePolicy: { mode: 'allowlist', allowedHosts: ['images.example.com'] },
      themeOverrides: {},
    })
    workspace.host.dispose()

    const external = createHost(createSession({
      resourceKind: 'external',
      path: 'D:/cards/card.opencard',
    }))
    expect(external.host.resourceRootPath.value).toBe('D:/cards')
    expect(external.host.props.value.remoteResourcePolicy).toBeUndefined()
    external.host.dispose()

    const draft = createHost()
    expect(draft.host.resourceRootPath.value).toBeNull()
    draft.host.dispose()

    const dataTable = createHost(createSession({
      uiState: { cardDesigner: { mode: 'data-table' } },
    }))
    expect(dataTable.host.cardDesignerMode.value).toBe('data-table')
    expect(dataTable.host.props.value.cardDesignerMode).toBe('data-table')
    dataTable.host.dispose()
  })

  it('falls back to Monaco and projects its language', () => {
    const { host } = createHost(createSession({
      fileTypeId: 'text',
      editorId: 'missing-editor',
      name: 'notes.txt',
      path: 'D:/notes.txt',
      resourceKind: 'external',
    }))

    expect(host.component.value).toBe(MonacoEditor)
    expect(host.props.value).toMatchObject({ language: 'plaintext', modelValue: '{}', themeOverrides: {} })
    host.dispose()
  })

  it('binds draft updates to the session that produced the props', () => {
    const { host, activeSession, updateDraftContent } = createHost()
    const update = host.props.value['onUpdate:modelValue'] as (value: string) => void

    activeSession.value = createSession({ id: 'session-b' })
    update('{"changed":true}')

    expect(updateDraftContent).toHaveBeenCalledWith('session-a', '{"changed":true}')
    host.dispose()
  })

  it('coalesces viewport updates and persists the latest value', () => {
    vi.useFakeTimers()
    const { host, updateSessionUiState } = createHost()

    host.handleViewportTransform({ x: 1, y: 2, scale: 1.1 })
    host.handleViewportTransform({ x: 3, y: 4, scale: 1.2 })
    vi.advanceTimersByTime(199)
    expect(updateSessionUiState).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(updateSessionUiState).toHaveBeenCalledTimes(1)
    expect(updateSessionUiState).toHaveBeenCalledWith('session-a', {
      cardDesigner: { viewportTransform: { x: 3, y: 4, scale: 1.2 } },
    })
    host.dispose()
  })

  it('flushes a pending viewport update when the active session changes', async () => {
    vi.useFakeTimers()
    const { host, activeSession, updateSessionUiState } = createHost()
    host.handleViewportTransform({ x: 8, y: 9, scale: 2 })

    activeSession.value = createSession({ id: 'session-b' })
    await nextTick()

    expect(updateSessionUiState).toHaveBeenCalledWith('session-a', {
      cardDesigner: { viewportTransform: { x: 8, y: 9, scale: 2 } },
    })
    vi.runAllTimers()
    expect(updateSessionUiState).toHaveBeenCalledTimes(1)
    host.dispose()
  })

  it('persists image viewport state and flushes it during dispose', () => {
    vi.useFakeTimers()
    const { host, updateSessionUiState } = createHost(createSession({
      fileTypeId: 'image',
      editorId: 'image-preview',
      name: 'cover.png',
    }))

    host.handleViewportTransform({ x: -4, y: 7, scale: 0.8 })
    host.dispose()
    host.dispose()
    vi.runAllTimers()

    expect(updateSessionUiState).toHaveBeenCalledTimes(1)
    expect(updateSessionUiState).toHaveBeenCalledWith('session-a', {
      imagePreview: { viewportTransform: { x: -4, y: 7, scale: 0.8 } },
    })
  })

  it('routes Card Designer mode, layout and view state to the active session', () => {
    const { host, updateSessionUiState } = createHost()
    const layout = {
      panels: {
        instanceExpanded: true,
        previewExpanded: false,
        structureExpanded: true,
        propertyExpanded: false,
      },
      leftTopHeight: 240,
      rightTopHeight: null,
    }
    const view = {
      activeFace: 'back' as const,
      clipToFace: true,
      selectedInstanceId: 'instance-1',
    }

    host.handleCardDesignerMode('data-table')
    host.handleCardDesignerLayout(layout)
    host.handleCardDesignerView(view)

    expect(updateSessionUiState).toHaveBeenNthCalledWith(1, 'session-a', {
      cardDesigner: { mode: 'data-table' },
    })
    expect(updateSessionUiState).toHaveBeenNthCalledWith(2, 'session-a', {
      cardDesigner: { layout },
    })
    expect(updateSessionUiState).toHaveBeenNthCalledWith(3, 'session-a', {
      cardDesigner: { view },
    })
    host.dispose()
  })

  it('routes save, flush, dirty, undo and redo through the editor boundary', async () => {
    const { host, setSessionDirtyState, saveActiveSession } = createHost()
    const save = vi.fn()
    const flush = vi.fn()
    const undo = vi.fn()
    const redo = vi.fn()
    host.editorRef.value = { save, flush, undo, redo, canUndo: true, canRedo: true }

    host.handleModified(true)
    await host.save()
    await host.flushAffectedSessions(['session-a'])
    await host.undo()
    await host.redo()

    expect(setSessionDirtyState).toHaveBeenCalledWith('session-a', true)
    expect(save).toHaveBeenCalledTimes(1)
    expect(saveActiveSession).not.toHaveBeenCalled()
    expect(flush).toHaveBeenCalledTimes(1)
    expect(undo).toHaveBeenCalledTimes(1)
    expect(redo).toHaveBeenCalledTimes(1)
    host.dispose()
  })

  it('projects and routes Card Designer workbook actions through a narrow editor boundary', async () => {
    const { host } = createHost()
    const importDataTableWorkbook = vi.fn()
    const exportDataTableWorkbook = vi.fn()
    host.editorRef.value = {
      importDataTableWorkbook,
      exportDataTableWorkbook,
      dataTableWorkbookBusy: false,
      canExportDataTableWorkbook: true,
    }

    expect(host.dataTableWorkbookBusy.value).toBe(false)
    expect(host.canExportDataTableWorkbook.value).toBe(true)
    await host.importDataTableWorkbook()
    await host.exportDataTableWorkbook()

    host.editorRef.value.dataTableWorkbookBusy = true
    await host.importDataTableWorkbook()
    await host.exportDataTableWorkbook()

    expect(importDataTableWorkbook).toHaveBeenCalledTimes(1)
    expect(exportDataTableWorkbook).toHaveBeenCalledTimes(1)
    host.dispose()
  })

  it('uses the session save path for Monaco editors', async () => {
    const { host, saveActiveSession } = createHost(createSession({
      fileTypeId: 'text',
      editorId: 'monaco',
      name: 'notes.txt',
    }))
    host.editorRef.value = { save: vi.fn() }

    await host.save()

    expect(saveActiveSession).toHaveBeenCalledTimes(1)
    host.dispose()
  })
})
