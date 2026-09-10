/**
 * 模块说明：
 * - 维护编辑会话状态 包括活动会话 草稿 脏状态 预览语义 与无地址会话保存流程
 * 职责边界：
 * - 只管理会话真相 不处理文件系统目录索引
 */
import { computed, nextTick, readonly, ref } from 'vue'
import type { IconToken, IconTone } from '../../../shared/ui/icon/iconRegistry'
import {
  CARD_DOCUMENT_SUFFIX,
  resolveEntryIcon,
  resolveFileType,
  resolveFileTypeById,
} from '../model/fileTypes'
import { fileSystemService } from '../services/fileSystemService'
import { resolveInstalledResourcePackageKey } from '../model/resourcePackage'
import { useProjectStore } from './projectStore'
import type {
  CardDesignerLayoutState,
  CardDesignerMode,
  CardDesignerViewState,
  EditorDiffUiState,
  EditorViewportTransform,
} from '../../editor-runtime/model/editorUiState'
import { taskScheduler } from '../../../utils/taskScheduler'
import {
  editorHistoryManager,
  resolveEditorHistoryKind,
} from '../../editor-runtime/history/editorHistoryManager'

const PROJECT_CONFIGURATION_AUTOSAVE_KEY_PREFIX = 'project-configuration-autosave:'
const CONTENTLESS_EDITOR_IDS = new Set(['image-preview', 'font-preview', 'package-manifest', 'custom-block-package', 'custom-block-manager', 'unsupported-file'])

function resolveOpenedSessionName(path: string, fileTypeId: string): string {
  if (fileTypeId === 'opencard-installed-package-manifest') {
    return resolveInstalledResourcePackageKey(path) ?? getPathBasename(path)
  }
  return getPathBasename(path)
}

export type SessionResourceKind = 'workspace' | 'external' | 'draft'
export type SessionSaveResult = 'saved' | 'cancelled' | 'skipped'
export type EditorSessionMode = 'edit' | 'diff'
/** Optional display presentation a caller may attach when opening a session. */
export type OpenSessionOptions = {
  preview?: boolean
  title?: string
  icon?: IconToken
  iconTone?: IconTone
}
export interface EditorSessionDiffState {
  beforeRevisionId: string | null
  afterRevisionId: string | null
  uiState?: EditorDiffUiState
}

export type EditorSession = {
  id: string
  resourceKind: SessionResourceKind
  path: string | null
  fileTypeId: string
  name: string
  /** Optional display label for the editor list. `name` stays the file or draft identity. */
  title?: string
  /** Optional display icon overriding the file type icon. */
  icon?: IconToken
  iconTone?: IconTone
  editorId: string
  savedContent: string
  draftContent: string
  isDirty: boolean
  isPreview: boolean
  mode?: EditorSessionMode
  diff?: EditorSessionDiffState
  uiState?: EditorSessionUiState
}

export type OpenedEditorItem = {
  key: string
  label: string
  /** Explicit display title, absent when the session name decides the label. */
  title?: string
  resourceKind: SessionResourceKind
  icon: IconToken
  iconTone?: IconTone
}

export type EditorSessionUiState = {
  cardDesigner?: {
    mode?: CardDesignerMode
    viewportTransform?: EditorViewportTransform
    layout?: CardDesignerLayoutState
    view?: CardDesignerViewState
  }
  imagePreview?: {
    viewportTransform?: EditorViewportTransform
    pixelated?: boolean
  }
}

type CreateDraftSessionOptions = {
  fileTypeId?: string
  name?: string
  title?: string
  icon?: IconToken
  iconTone?: IconTone
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

function resolveOpenCardDraftName(content: string, fallback: string): string {
  try {
    const document = JSON.parse(content) as { type?: unknown, name?: unknown }
    if (document.type !== 'card-document' || typeof document.name !== 'string') return fallback

    const fileName = document.name
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
      .replace(/[. ]+$/g, '')
    if (!fileName) return fallback
    return fileName.toLowerCase().endsWith(CARD_DOCUMENT_SUFFIX) ? fileName : `${fileName}${CARD_DOCUMENT_SUFFIX}`
  } catch {
    return fallback
  }
}

function isAbsolutePath(path: string): boolean {
  const normalizedPath = normalizePath(path)
  return /^[a-z]:\//i.test(normalizedPath) || normalizedPath.startsWith('/')
}

function projectConfigurationAutosaveKey(sessionId: string): string {
  return `${PROJECT_CONFIGURATION_AUTOSAVE_KEY_PREFIX}${sessionId}`
}

export function createDefaultOpenCardContent(displayName: string) {
  const documentName = stripFileExtension(displayName) || 'UNTITLED'
  return JSON.stringify({
    type: 'card-document',
    id: `card-document-${crypto.randomUUID()}`,
    name: documentName,
    version: '1.0.0',
    width: '540',
    height: '850',
    faces: {
      front: {
        type: 'card-face',
        id: `card-face-${crypto.randomUUID()}`,
        background: '#FFFFFF',
        children: [],
      },
      back: {
        type: 'card-face',
        id: `card-face-${crypto.randomUUID()}`,
        background: '#FFFFFF',
        children: [],
      },
    },
    instances: [],
  }, null, 2)
}

/** An explicit title tracks the session name, so a rename drops it and the name decides the label again. */
/** An explicit title tracks the session name, so a rename clears it and the name decides the label again. */
function resolvePublishedName(session: EditorSession, content: string): Pick<EditorSession, 'name' | 'title'> {
  if (session.resourceKind !== 'draft' || session.fileTypeId !== 'opencard') {
    return { name: session.name, title: session.title }
  }
  const name = resolveOpenCardDraftName(content, session.name)
  return { name, title: name === session.name ? session.title : undefined }
}

function buildDraftName(fileTypeId: string, existingNames: string[]) {  const fileType = resolveFileTypeById(fileTypeId)
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
    const fileTypeFromPath = resolveFileType(
      session.path,
      session.resourceKind === 'workspace' ? useProjectStore().projectPath.value : undefined,
    )
    if (!session.fileTypeId || fileTypeFromPath.id === session.fileTypeId) {
      return fileTypeFromPath
    }
  }

  return resolveFileTypeById(session.fileTypeId)
}

export function useEditorSessionStore() {
  const {
    projectPath,
    readFile,
    saveFile,
    saveProjectConfiguration,
    saveProjectFontRegistry,
    saveProjectIconRegistry,
    saveProjectDictionary,
  } = useProjectStore()
  let openedEditorItemCache: OpenedEditorItem[] = []

  function publishHistoryContent(sessionId: string, content: string, isDirty: boolean): void {
    sessions.value = sessions.value.map(session => session.id === sessionId
      ? {
          ...session,
          ...resolvePublishedName(session, content),
          draftContent: content,
          isDirty,
          isPreview: isDirty ? false : session.isPreview,
        }
      : session)
  }

  function initializeSessionHistory(session: EditorSession): void {
    editorHistoryManager.initialize(
      session.id,
      resolveEditorHistoryKind(session.editorId),
      session.draftContent,
      (content, isDirty) => publishHistoryContent(session.id, content, isDirty),
    )
  }

  const activeSession = computed(() =>
    sessions.value.find((session) => session.id === activeSessionId.value) ?? null
  )

  const openedEditorItems = computed<OpenedEditorItem[]>(() => {
    const previousByKey = new Map(openedEditorItemCache.map((item) => [item.key, item]))
    const nextItems = sessions.value.map((session) => {
      const fileType = resolveSessionFileType(session)
      const derivedIcon = session.resourceKind === 'workspace' && session.path
        ? resolveEntryIcon(session.path, false, false, projectPath.value)
        : { icon: fileType.icon, tone: fileType.iconTone }
      const nextItem: OpenedEditorItem = {
        key: session.id,
        label: session.isDirty ? `${session.name} *` : session.name,
        ...(session.title ? { title: session.title } : {}),
        resourceKind: session.resourceKind,
        icon: session.icon ?? derivedIcon.icon,
        iconTone: session.icon ? session.iconTone : derivedIcon.tone,
      }
      const previous = previousByKey.get(session.id)
      return previous
        && previous.label === nextItem.label
        && previous.title === nextItem.title
        && previous.resourceKind === nextItem.resourceKind
        && previous.icon === nextItem.icon
        && previous.iconTone === nextItem.iconTone
        ? previous
        : nextItem
    })

    if (nextItems.length === openedEditorItemCache.length
      && nextItems.every((item, index) => item === openedEditorItemCache[index])) {
      return openedEditorItemCache
    }
    openedEditorItemCache = nextItems
    return nextItems
  })

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

  /** An unspecified title means "use the session name again". */
  function setSessionTitle(sessionId: string, title: string | undefined): void {
    sessions.value = sessions.value.map(session => session.id === sessionId
      ? { ...session, title }
      : session)
  }

  /** An unspecified icon means "use the file type icon again". */
  function setSessionIcon(sessionId: string, icon: IconToken | undefined, iconTone: IconTone | undefined): void {
    sessions.value = sessions.value.map(session => session.id === sessionId
      ? { ...session, icon, iconTone }
      : session)
  }

  async function openSession(path: string, options?: OpenSessionOptions) {
    const normalizedPath = normalizePath(path)
    const preview = options?.preview ?? false
    const title = options?.title?.trim()
    const existingSession = sessions.value.find((session) => session.path === normalizedPath)
    if (existingSession) {
      if (!preview && existingSession.isPreview) {
        setSessionPreviewState(existingSession.id, false)
      }
      if (title !== existingSession.title) setSessionTitle(existingSession.id, title)
      if (options?.icon !== undefined) setSessionIcon(existingSession.id, options.icon, options.iconTone)

      activeSessionId.value = existingSession.id
      return existingSession
    }

    const resourceKind: SessionResourceKind = projectPath.value && (
      !isAbsolutePath(normalizedPath) || isPathInsideProject(normalizedPath, projectPath.value)
    )
      ? 'workspace'
      : 'external'
    const fileType = resolveFileType(
      normalizedPath,
      resourceKind === 'workspace' ? projectPath.value : undefined,
    )
    const content = CONTENTLESS_EDITOR_IDS.has(fileType.editorId)
      ? ''
      : resourceKind === 'workspace'
        ? await readFile(normalizedPath)
        : await fileSystemService.readFile(normalizedPath)

    const session: EditorSession = {
      id: crypto.randomUUID(),
      resourceKind,
      path: normalizedPath,
      fileTypeId: fileType.id,
      name: resolveOpenedSessionName(normalizedPath, fileType.id),
      ...(title ? { title } : {}),
      ...(options?.icon ? { icon: options.icon, iconTone: options.iconTone } : {}),
      editorId: fileType.editorId,
      savedContent: content,
      draftContent: content,
      isDirty: false,
          isPreview: preview,
          mode: 'edit',
    }

    const replacedPreviewSessionIds = preview
      ? sessions.value.filter((candidate) => candidate.isPreview).map(candidate => candidate.id)
      : []
    const nextSessions = preview
      ? sessions.value.filter((candidate) => !candidate.isPreview)
      : sessions.value

    sessions.value = [...nextSessions, session]
    initializeSessionHistory(session)
    activeSessionId.value = session.id
    if (preview) {
      await nextTick()
      await new Promise<void>(resolve => setTimeout(resolve, 250))
      editorHistoryManager.releaseMany(replacedPreviewSessionIds)
    }
    return session
  }

  async function openFile(path: string, options?: OpenSessionOptions) {
    return await openSession(path, options)
  }

  async function openPreviewFile(path: string, options?: OpenSessionOptions) {
    return await openSession(path, { preview: true, ...options })
  }

  function createDraftSession(options: CreateDraftSessionOptions = {}) {
    const fileTypeId = options.fileTypeId ?? 'opencard'
    const fileType = resolveFileTypeById(fileTypeId)
    const fallbackName = options.name ?? buildDraftName(fileTypeId, sessions.value.map((session) => session.name))
    const content = options.content ?? (fileType.id === 'opencard' ? createDefaultOpenCardContent(fallbackName) : '')
    const name = fileType.id === 'opencard'
      ? resolveOpenCardDraftName(content, fallbackName)
      : fallbackName

    const session: EditorSession = {
      id: crypto.randomUUID(),
      resourceKind: 'draft',
      path: null,
      fileTypeId: fileType.id,
      name,
      ...(options.title?.trim() ? { title: options.title.trim() } : {}),
      ...(options.icon ? { icon: options.icon, iconTone: options.iconTone } : {}),
      editorId: fileType.editorId,
      savedContent: content,
      draftContent: content,
      isDirty: false,
      isPreview: false,
      mode: 'edit',
    }

    sessions.value = [...sessions.value, session]
    initializeSessionHistory(session)
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
    if (editorHistoryManager.has(sessionId)) {
      editorHistoryManager.recordContent(sessionId, content)
      return
    }
    sessions.value = sessions.value.map((session) => {
      if (session.id !== sessionId) {
        return session
      }

      const isDirty = content !== session.savedContent
      return {
        ...session,
        ...resolvePublishedName(session, content),
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
          imagePreview: patch.imagePreview
            ? {
              ...session.uiState?.imagePreview,
              ...patch.imagePreview,
            }
            : session.uiState?.imagePreview,
        },
      }
    })
  }

  function setSessionMode(sessionId: string, mode: EditorSessionMode, diff?: EditorSessionDiffState): void {
    sessions.value = sessions.value.map(session => session.id === sessionId
      ? { ...session, mode, diff: mode === 'diff' ? diff ?? session.diff : session.diff }
      : session)
  }

  function updateSessionDiffUiState(sessionId: string, uiState: EditorDiffUiState): void {
    sessions.value = sessions.value.map(session => session.id === sessionId && session.diff
      ? { ...session, diff: { ...session.diff, uiState } }
      : session)
  }

  function closeSession(sessionId: string) {
    const index = sessions.value.findIndex((session) => session.id === sessionId)
    if (index === -1) {
      return
    }

    taskScheduler.cancel(projectConfigurationAutosaveKey(sessionId))
    editorHistoryManager.release(sessionId)

    const nextSessions = [...sessions.value]
    nextSessions.splice(index, 1)
    sessions.value = nextSessions

    if (activeSessionId.value !== sessionId) {
      return
    }

    const fallbackSession = nextSessions[index] ?? nextSessions[index - 1] ?? null
    activeSessionId.value = fallbackSession?.id ?? ''
  }

  function closeWorkspaceSessions() {
    for (const session of sessions.value) {
      if (session.resourceKind === 'workspace') {
        taskScheduler.cancel(projectConfigurationAutosaveKey(session.id))
      }
    }
    editorHistoryManager.releaseMany(sessions.value
      .filter(session => session.resourceKind === 'workspace')
      .map(session => session.id))
    const activeSessionWasClosed = sessions.value.some(
      (session) => session.id === activeSessionId.value && session.resourceKind === 'workspace',
    )
    sessions.value = sessions.value.filter((session) => session.resourceKind !== 'workspace')

    if (activeSessionWasClosed) {
      activeSessionId.value = sessions.value[sessions.value.length - 1]?.id ?? ''
    }
  }

  function detachWorkspaceSessions(oldProjectRoot: string) {
    const normalizedRoot = normalizePath(oldProjectRoot)
    if (!normalizedRoot) return

    sessions.value = sessions.value.map((session) => {
      if (session.resourceKind !== 'workspace') {
        return session
      }

      taskScheduler.cancel(projectConfigurationAutosaveKey(session.id))
      return {
        ...session,
        resourceKind: 'external',
        path: session.path && !isAbsolutePath(session.path)
          ? normalizePath(`${normalizedRoot}/${session.path}`)
          : session.path,
      }
    })
  }

  function closeSessionsByPath(path: string) {
    const normalizedPath = normalizePath(path)
    const closedSessionIds = new Set(
      sessions.value
        .filter((session) => session.path && isSameOrDescendantPath(session.path, normalizedPath))
        .map((session) => session.id),
    )
    if (closedSessionIds.size === 0) return

    for (const sessionId of closedSessionIds) {
      taskScheduler.cancel(projectConfigurationAutosaveKey(sessionId))
    }
    editorHistoryManager.releaseMany([...closedSessionIds])

    const activeSessionWasClosed = closedSessionIds.has(activeSessionId.value)
    sessions.value = sessions.value.filter((session) => !closedSessionIds.has(session.id))
    if (activeSessionWasClosed) {
      activeSessionId.value = sessions.value[sessions.value.length - 1]?.id ?? ''
    }
  }

  async function writeContentByResourceKind(resourceKind: SessionResourceKind, path: string, content: string) {
    if (resourceKind === 'workspace') {
      await saveFile(path, content)
      return
    }

    await fileSystemService.writeFile(path, content)
  }

  async function saveSession(sessionId: string, targetPath?: string): Promise<SessionSaveResult> {
    taskScheduler.cancel(projectConfigurationAutosaveKey(sessionId))
    const session = sessions.value.find((candidate) => candidate.id === sessionId)
    if (!session) {
      return 'skipped'
    }

    if (CONTENTLESS_EDITOR_IDS.has(session.editorId)) {
      return 'skipped'
    }

    const normalizedTargetPath = targetPath ? normalizePath(targetPath) : null
    let nextPath = normalizedTargetPath ?? session.path
    let nextResourceKind = normalizedTargetPath
      ? (isPathInsideProject(normalizedTargetPath, projectPath.value) ? 'workspace' : 'external')
      : session.resourceKind

    if (!nextPath) {
      const fileType = resolveSessionFileType(session)
      const selectedPath = await fileSystemService.pickSavePath({
        defaultPath: projectPath.value ? `${normalizePath(projectPath.value)}/${session.name}` : session.name,
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

    if (nextResourceKind === 'draft') {
      nextResourceKind = isPathInsideProject(nextPath, projectPath.value) ? 'workspace' : 'external'
    }

    const nextFileType = resolveFileType(
      nextPath,
      nextResourceKind === 'workspace' ? projectPath.value : undefined,
    )
    const structuredProjectSavers = {
      'opencard-project-profile': saveProjectConfiguration,
      'opencard-font-registry': saveProjectFontRegistry,
      'opencard-icon-registry': saveProjectIconRegistry,
      'opencard-dictionary': saveProjectDictionary,
    } as const
    const structuredSaver = nextResourceKind === 'workspace'
      ? structuredProjectSavers[nextFileType.id as keyof typeof structuredProjectSavers]
      : undefined
    const savedContent = structuredSaver
      ? await structuredSaver(nextPath, session.draftContent)
      : session.draftContent

    if (!structuredSaver) {
      await writeContentByResourceKind(nextResourceKind, nextPath, savedContent)
    }

    const nextFileTypeId = nextFileType.id === 'plaintext'
      ? session.fileTypeId
      : nextFileType.id

    sessions.value = sessions.value.map((candidate) =>
      candidate.id === sessionId
        ? (() => {
          const hasNewerDraft = candidate.draftContent !== session.draftContent
          const draftContent = hasNewerDraft ? candidate.draftContent : savedContent
          return {
            ...candidate,
            path: nextPath,
            resourceKind: nextResourceKind,
            name: getPathBasename(nextPath),
            title: undefined,
            fileTypeId: nextFileTypeId,
            editorId: resolveFileTypeById(nextFileTypeId).editorId,
            savedContent,
            draftContent,
            isDirty: draftContent !== savedContent,
          }
        })()
        : candidate
    )
    editorHistoryManager.markSaved(sessionId, savedContent)

    return 'saved'
  }

  async function saveActiveSession(): Promise<SessionSaveResult> {
    if (!activeSessionId.value) {
      return 'skipped'
    }

    return await saveSession(activeSessionId.value)
  }

  async function saveDirtySessions(): Promise<string[]> {
    const dirtySessions = sessions.value
      .filter(session => session.isDirty && Boolean(session.path) && session.resourceKind !== 'draft')
    await Promise.all(dirtySessions.map(session => saveSession(session.id)))
    return dirtySessions.map(session => session.name)
  }

  async function refreshSessionFromDisk(sessionId: string) {
    const session = sessions.value.find((candidate) => candidate.id === sessionId)
    if (!session || !session.path) {
      return
    }

    if (CONTENTLESS_EDITOR_IDS.has(session.editorId) || session.resourceKind === 'draft') {
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
    editorHistoryManager.syncExternalContent(sessionId, content, true)
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
      const nextFileType = resolveFileType(nextPath, projectPath.value)
      return {
        ...session,
        path: nextPath,
        name: getPathBasename(nextPath),
        title: undefined,
        fileTypeId: nextFileType.id,
        editorId: nextFileType.editorId,
      }
    })
  }

  return {
    sessions: readonly(sessions),
    activeSessionId: readonly(activeSessionId),
    activeSession,
    openedEditorItems,
    openFile,
    openPreviewFile,
    createDraftSession,
    activateSession,
    activatePath,
    updateDraftContent,
    setSessionDirtyState,
    updateSessionUiState,
    updateSessionDiffUiState,
    setSessionMode,
    closeSession,
    closeWorkspaceSessions,
    detachWorkspaceSessions,
    closeSessionsByPath,
    saveSession,
    saveActiveSession,
    saveDirtySessions,
    refreshSessionFromDisk,
    refreshActiveSessionFromDisk,
    remapSessionPaths,
  }
}
