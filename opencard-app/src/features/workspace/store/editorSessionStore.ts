/**
 * 模块说明：
 * - 维护编辑会话状态 包括活动会话 草稿 脏状态 预览语义 与无地址会话保存流程
 * 职责边界：
 * - 只管理会话真相 不处理文件系统目录索引
 */
import { computed, readonly, ref } from 'vue'
import type { TreeItem } from '../../../shared/ui/tree/tree.types'
import { resolveEntryIcon, resolveFileType, resolveFileTypeById } from '../model/fileTypes'
import { fileSystemService } from '../services/fileSystemService'
import { useProjectStore } from './projectStore'

export type SessionResourceKind = 'workspace' | 'external' | 'untitled'
export type SessionSaveResult = 'saved' | 'cancelled' | 'skipped'

export type EditorSession = {
  id: string
  resourceKind: SessionResourceKind
  path: string | null
  fileTypeId: string
  name: string
  editorId: string
  savedContent: string
  draftContent: string
  isDirty: boolean
  isPreview: boolean
  uiState?: EditorSessionUiState
}

export type CardDesignerViewportTransform = {
  x: number
  y: number
  scale: number
}

export type EditorSessionUiState = {
  cardDesigner?: {
    viewportTransform?: CardDesignerViewportTransform
  }
}

type CreateUntitledSessionOptions = {
  fileTypeId?: string
  name?: string
  content?: string
}

const sessions = ref<EditorSession[]>([])
const activeSessionId = ref<string>('')

function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function getPathBasename(path: string) {
  const normalizedPath = normalizePath(path)
  const lastSlashIndex = normalizedPath.lastIndexOf('/')
  return lastSlashIndex === -1 ? normalizedPath : normalizedPath.slice(lastSlashIndex + 1)
}

function isSameOrDescendantPath(targetPath: string, ancestorPath: string) {
  const normalizedTargetPath = normalizePath(targetPath)
  const normalizedAncestorPath = normalizePath(ancestorPath)
  return normalizedTargetPath === normalizedAncestorPath || normalizedTargetPath.startsWith(`${normalizedAncestorPath}/`)
}

function isPathInsideProject(path: string, projectPath: string) {
  if (!projectPath) {
    return false
  }

  return isSameOrDescendantPath(path, projectPath)
}

function stripFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
}

function createDefaultOpenCardContent(displayName: string) {
  const documentName = stripFileExtension(displayName) || 'UNTITLED'
  return JSON.stringify({
    type: 'card-document',
    id: `card-document-${crypto.randomUUID()}`,
    name: documentName,
    version: '1.0.0',
    width: 540,
    height: 850,
    background: '#FFFFFF',
    children: [],
    instances: [],
  }, null, 2)
}

function buildUntitledName(fileTypeId: string, existingNames: string[]) {
  const fileType = resolveFileTypeById(fileTypeId)
  const extension = fileType.extensions?.[0]
  const suffix = extension ? `.${extension}` : ''
  const lowerCaseNames = new Set(existingNames.map((name) => name.toLowerCase()))

  let index = 1
  while (true) {
    const candidate = index === 1
      ? `UNTITLED${suffix}`
      : `UNTITLED-${index}${suffix}`
    if (!lowerCaseNames.has(candidate.toLowerCase())) {
      return candidate
    }
    index += 1
  }
}

function resolveSessionFileType(session: EditorSession) {
  if (session.path) {
    const fileTypeFromPath = resolveFileType(session.path)
    if (!session.fileTypeId || fileTypeFromPath.id === session.fileTypeId) {
      return fileTypeFromPath
    }
  }

  return resolveFileTypeById(session.fileTypeId)
}

export function useEditorSessionStore() {
  const { projectPath, readFile, saveFile } = useProjectStore()

  const activeSession = computed(() =>
    sessions.value.find((session) => session.id === activeSessionId.value) ?? null
  )

  const openedFileNodes = computed<TreeItem[]>(() =>
    sessions.value.map((session) => {
      const fileType = resolveSessionFileType(session)
      const entryIcon = session.resourceKind === 'workspace' && session.path
        ? resolveEntryIcon(session.path, false)
        : { icon: fileType.icon, tone: fileType.iconTone }

      return {
        key: session.id,
        name: session.isDirty ? `${session.name} *` : session.name,
        isExpandable: false,
        icon: entryIcon.icon,
        iconTone: entryIcon.tone,
        metadata: {
          sessionId: session.id,
          content: session.draftContent,
          isModified: session.isDirty,
        },
      }
    })
  )

  function setSessionPreviewState(sessionId: string, isPreview: boolean) {
    sessions.value = sessions.value.map((session) =>
      session.id === sessionId
        ? {
          ...session,
          isPreview,
        }
        : session
    )
  }

  async function openSession(path: string, options?: { preview?: boolean }) {
    const normalizedPath = normalizePath(path)
    const preview = options?.preview ?? false
    const existingSession = sessions.value.find((session) => session.path === normalizedPath)
    if (existingSession) {
      if (!preview && existingSession.isPreview) {
        setSessionPreviewState(existingSession.id, false)
      }

      activeSessionId.value = existingSession.id
      return existingSession
    }

    const fileType = resolveFileType(normalizedPath)
    const content = fileType.editorId === 'image-preview'
      ? ''
      : await readFile(normalizedPath)

    const session: EditorSession = {
      id: crypto.randomUUID(),
      resourceKind: 'workspace',
      path: normalizedPath,
      fileTypeId: fileType.id,
      name: getPathBasename(normalizedPath),
      editorId: fileType.editorId,
      savedContent: content,
      draftContent: content,
      isDirty: false,
      isPreview: preview,
    }

    const nextSessions = preview
      ? sessions.value.filter((candidate) => !candidate.isPreview)
      : sessions.value

    sessions.value = [...nextSessions, session]
    activeSessionId.value = session.id
    return session
  }

  async function openFile(path: string) {
    return await openSession(path)
  }

  async function openPreviewFile(path: string) {
    return await openSession(path, { preview: true })
  }

  function createUntitledSession(options: CreateUntitledSessionOptions = {}) {
    const fileTypeId = options.fileTypeId ?? 'opencard'
    const fileType = resolveFileTypeById(fileTypeId)
    const name = options.name ?? buildUntitledName(fileTypeId, sessions.value.map((session) => session.name))
    const content = options.content ?? (fileType.id === 'opencard' ? createDefaultOpenCardContent(name) : '')

    const session: EditorSession = {
      id: crypto.randomUUID(),
      resourceKind: 'untitled',
      path: null,
      fileTypeId: fileType.id,
      name,
      editorId: fileType.editorId,
      savedContent: content,
      draftContent: content,
      isDirty: false,
      isPreview: false,
    }

    sessions.value = [...sessions.value, session]
    activeSessionId.value = session.id
    return session
  }

  function activateSession(sessionId: string) {
    if (sessions.value.some((session) => session.id === sessionId)) {
      activeSessionId.value = sessionId
    }
  }

  function activatePath(path: string) {
    const normalizedPath = normalizePath(path)
    const session = sessions.value.find((candidate) => candidate.path === normalizedPath)
    if (session) {
      activeSessionId.value = session.id
    }
  }

  function updateDraftContent(sessionId: string, content: string) {
    sessions.value = sessions.value.map((session) => {
      if (session.id !== sessionId) {
        return session
      }

      const isDirty = content !== session.savedContent
      return {
        ...session,
        draftContent: content,
        isDirty,
        isPreview: isDirty ? false : session.isPreview,
      }
    }
    )
  }

  function setSessionDirtyState(sessionId: string, isDirty: boolean) {
    sessions.value = sessions.value.map((session) => {
      if (session.id !== sessionId) {
        return session
      }

      if (session.isDirty === isDirty) {
        return session
      }

      return {
        ...session,
        isDirty,
        isPreview: isDirty ? false : session.isPreview,
      }
    })
  }

  function updateSessionUiState(sessionId: string, patch: EditorSessionUiState) {
    sessions.value = sessions.value.map((session) => {
      if (session.id !== sessionId) {
        return session
      }

      return {
        ...session,
        uiState: {
          ...session.uiState,
          ...patch,
          cardDesigner: patch.cardDesigner
            ? {
              ...session.uiState?.cardDesigner,
              ...patch.cardDesigner,
            }
            : session.uiState?.cardDesigner,
        },
      }
    })
  }

  function closeSession(sessionId: string) {
    const index = sessions.value.findIndex((session) => session.id === sessionId)
    if (index === -1) {
      return
    }

    const nextSessions = [...sessions.value]
    nextSessions.splice(index, 1)
    sessions.value = nextSessions

    if (activeSessionId.value !== sessionId) {
      return
    }

    const fallbackSession = nextSessions[index] ?? nextSessions[index - 1] ?? null
    activeSessionId.value = fallbackSession?.id ?? ''
  }

  async function writeContentByResourceKind(resourceKind: SessionResourceKind, path: string, content: string) {
    if (resourceKind === 'workspace') {
      await saveFile(path, content)
      return
    }

    await fileSystemService.writeFile(path, content)
  }

  async function saveSession(sessionId: string): Promise<SessionSaveResult> {
    const session = sessions.value.find((candidate) => candidate.id === sessionId)
    if (!session) {
      return 'skipped'
    }

    if (session.editorId === 'image-preview') {
      return 'skipped'
    }

    let nextPath = session.path
    let nextResourceKind = session.resourceKind

    if (!nextPath) {
      const fileType = resolveSessionFileType(session)
      const selectedPath = await fileSystemService.pickSavePath({
        defaultPath: session.name,
        title: '保存文件',
        fileTypeName: fileType.id,
        extensions: fileType.extensions,
      })

      if (!selectedPath) {
        return 'cancelled'
      }

      nextPath = normalizePath(selectedPath)
      nextResourceKind = isPathInsideProject(nextPath, projectPath.value) ? 'workspace' : 'external'
    }

    if (nextResourceKind === 'untitled') {
      nextResourceKind = isPathInsideProject(nextPath, projectPath.value) ? 'workspace' : 'external'
    }

    await writeContentByResourceKind(nextResourceKind, nextPath, session.draftContent)

    const nextFileType = resolveFileType(nextPath)
    const nextFileTypeId = nextFileType.id === 'plaintext'
      ? session.fileTypeId
      : nextFileType.id

    sessions.value = sessions.value.map((candidate) =>
      candidate.id === sessionId
        ? {
          ...candidate,
          path: nextPath,
          resourceKind: nextResourceKind,
          name: getPathBasename(nextPath),
          fileTypeId: nextFileTypeId,
          editorId: resolveFileTypeById(nextFileTypeId).editorId,
          savedContent: candidate.draftContent,
          isDirty: false,
        }
        : candidate
    )

    return 'saved'
  }

  async function saveActiveSession(): Promise<SessionSaveResult> {
    if (!activeSessionId.value) {
      return 'skipped'
    }

    return await saveSession(activeSessionId.value)
  }

  async function refreshSessionFromDisk(sessionId: string) {
    const session = sessions.value.find((candidate) => candidate.id === sessionId)
    if (!session || !session.path) {
      return
    }

    if (session.editorId === 'image-preview' || session.resourceKind === 'untitled') {
      return
    }

    const content = session.resourceKind === 'workspace'
      ? await readFile(session.path)
      : await fileSystemService.readFile(session.path)

    sessions.value = sessions.value.map((candidate) =>
      candidate.id === sessionId
        ? {
          ...candidate,
          savedContent: content,
          draftContent: content,
          isDirty: false,
        }
        : candidate
    )
  }

  async function refreshActiveSessionFromDisk() {
    if (!activeSessionId.value) {
      return
    }

    await refreshSessionFromDisk(activeSessionId.value)
  }

  function remapSessionPaths(oldPath: string, newPath: string) {
    const normalizedOldPath = normalizePath(oldPath)
    const normalizedNewPath = normalizePath(newPath)

    sessions.value = sessions.value.map((session) => {
      if (session.resourceKind !== 'workspace' || !session.path) {
        return session
      }

      if (!isSameOrDescendantPath(session.path, normalizedOldPath)) {
        return session
      }

      const nextPath = normalizedNewPath + session.path.slice(normalizedOldPath.length)
      const nextFileType = resolveFileType(nextPath)
      return {
        ...session,
        path: nextPath,
        name: getPathBasename(nextPath),
        fileTypeId: nextFileType.id,
        editorId: nextFileType.editorId,
      }
    })
  }

  return {
    sessions: readonly(sessions),
    activeSessionId: readonly(activeSessionId),
    activeSession,
    openedFileNodes,
    openFile,
    openPreviewFile,
    createUntitledSession,
    activateSession,
    activatePath,
    updateDraftContent,
    setSessionDirtyState,
    updateSessionUiState,
    closeSession,
    saveSession,
    saveActiveSession,
    refreshSessionFromDisk,
    refreshActiveSessionFromDisk,
    remapSessionPaths,
  }
}
