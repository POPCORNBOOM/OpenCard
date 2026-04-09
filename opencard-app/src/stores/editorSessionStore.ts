import { computed, readonly, ref } from 'vue'
import type { ITreeNode } from '../components/ui/TreeNode.vue'
import { resolveFileType } from '../core/files/fileTypes'
import { useProjectStore } from './projectStore'

export type EditorSession = {
  id: string
  path: string
  name: string
  editorId: string
  savedContent: string
  draftContent: string
  isDirty: boolean
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

export function useEditorSessionStore() {
  const { readFile, saveFile } = useProjectStore()

  const activeSession = computed(() =>
    sessions.value.find((session) => session.id === activeSessionId.value) ?? null
  )

  const openedFileNodes = computed<ITreeNode[]>(() =>
    sessions.value.map((session) => {
      const fileType = resolveFileType(session.path)
      return {
        key: session.path,
        name: session.isDirty ? `${session.name} *` : session.name,
        isExpandable: false,
        icon: fileType.icon,
        iconTone: fileType.iconTone,
        iconColor: fileType.iconColor,
        metadata: {
          sessionId: session.id,
          content: session.draftContent,
          isModified: session.isDirty,
        },
      }
    })
  )

  async function openFile(path: string) {
    const normalizedPath = normalizePath(path)
    const existingSession = sessions.value.find((session) => session.path === normalizedPath)
    if (existingSession) {
      activeSessionId.value = existingSession.id
      return existingSession
    }

    const content = await readFile(normalizedPath)
    const fileType = resolveFileType(normalizedPath)

    const session: EditorSession = {
      id: crypto.randomUUID(),
      path: normalizedPath,
      name: getPathBasename(normalizedPath),
      editorId: fileType.editorId,
      savedContent: content,
      draftContent: content,
      isDirty: false,
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
    sessions.value = sessions.value.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            draftContent: content,
            isDirty: content !== session.savedContent,
          }
        : session
    )
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

  async function saveSession(sessionId: string) {
    const session = sessions.value.find((candidate) => candidate.id === sessionId)
    if (!session) {
      return
    }

    await saveFile(session.path, session.draftContent)
    sessions.value = sessions.value.map((candidate) =>
      candidate.id === sessionId
        ? {
            ...candidate,
            savedContent: candidate.draftContent,
            isDirty: false,
          }
        : candidate
    )
  }

  async function saveActiveSession() {
    if (!activeSessionId.value) {
      return
    }

    await saveSession(activeSessionId.value)
  }

  async function refreshSessionFromDisk(sessionId: string) {
    const session = sessions.value.find((candidate) => candidate.id === sessionId)
    if (!session) {
      return
    }

    const content = await readFile(session.path)
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
      if (!isSameOrDescendantPath(session.path, normalizedOldPath)) {
        return session
      }

      const nextPath = normalizedNewPath + session.path.slice(normalizedOldPath.length)
      return {
        ...session,
        path: nextPath,
        name: getPathBasename(nextPath),
      }
    })
  }

  return {
    sessions: readonly(sessions),
    activeSessionId: readonly(activeSessionId),
    activeSession,
    openedFileNodes,
    openFile,
    activateSession,
    activatePath,
    updateDraftContent,
    closeSession,
    saveSession,
    saveActiveSession,
    refreshSessionFromDisk,
    refreshActiveSessionFromDisk,
    remapSessionPaths,
  }
}
