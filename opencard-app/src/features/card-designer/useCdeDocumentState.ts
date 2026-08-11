import { computed, ref } from 'vue'
import { useManualRefHistory } from '@vueuse/core'
import {
  type CardDocument,
} from '../../entities/card/model'
import { buildParentLookup, type ParentLookup } from '../../entities/card/tree'
import {
  normalizeCardDocument,
  serializeCardDocument,
  type CardStorageWarning,
} from '../../entities/card/storage'
import { reportAppError } from '../logging/appErrorCatalog'

const TYPING_DEBOUNCE_MS = 300
export type CdeDocumentChangeMode = 'typing' | 'action'

type UseCdeDocumentStateOptions = {
  emitModelValueUpdate: (content: string) => void
  emitModified: (modified: boolean) => void
  emitSave: () => void
  resetSelection: () => void
  resolveCustomBlockPublicFieldKeys?: (customBlockKey: string) => readonly string[] | undefined
}

export function useCdeDocumentState(options: UseCdeDocumentStateOptions) {
  const rawContent = ref('')
  const cardDoc = ref<CardDocument | null>(null)
  const storageWarnings = ref<readonly CardStorageWarning[]>([])
  const parentLookup = ref<ParentLookup>(new Map())
  const isModified = ref(false)
  const savedContent = ref('')
  const historyDepth = ref(0)
  const hasPendingTypingCommit = ref(false)
  const documentRevision = ref(0)
  let typingTimer: ReturnType<typeof setTimeout> | null = null

  const {
    canUndo: historyCanUndo,
    canRedo: historyCanRedo,
    undo: historyUndo,
    redo: historyRedo,
    clear: clearHistory,
    commit: commitHistory,
  } = useManualRefHistory<CardDocument | null, string>(cardDoc, {
    capacity: 100,
    dump: (value) => value ? serializeCurrentDocument(value) : 'null',
    parse: (value) => {
      const parsed = JSON.parse(value) as unknown
      return parsed === null ? null : normalizeCardDocument(parsed).document
    },
  })
  const canUndo = computed(() => historyCanUndo.value && historyDepth.value > 0)
  const canRedo = computed(() => historyCanRedo.value)

  const hasDocument = computed(() => Boolean(cardDoc.value))

  function serializeCurrentDocument(document: CardDocument): string {
    return serializeCardDocument(document, {
      resolveCustomBlockPublicFieldKeys: options.resolveCustomBlockPublicFieldKeys,
    })
  }

  function updateModifiedState(nextContent: string) {
    const nextIsModified = nextContent !== savedContent.value
    if (nextIsModified === isModified.value) {
      return
    }

    isModified.value = nextIsModified
    options.emitModified(nextIsModified)
  }

  function rebuildParentLookup() {
    parentLookup.value = cardDoc.value ? buildParentLookup(cardDoc.value) : new Map()
  }

  function refreshDocumentState() {
    if (!cardDoc.value) {
      rebuildParentLookup()
      return
    }

    documentRevision.value += 1
    rebuildParentLookup()
  }

  function applyDocumentContent(content: string) {
    const hasChanged = content !== rawContent.value
    if (hasChanged) {
      rawContent.value = content
      options.emitModelValueUpdate(content)
    }

    updateModifiedState(content)
  }

  function syncDocumentContent() {
    if (!cardDoc.value) {
      return
    }

    const content = serializeCurrentDocument(cardDoc.value)
    applyDocumentContent(content)
  }

  function clearTypingTimer() {
    if (typingTimer === null) {
      return
    }

    clearTimeout(typingTimer)
    typingTimer = null
  }

  function commitCurrentDocument() {
    if (!cardDoc.value) {
      return false
    }

    const content = serializeCurrentDocument(cardDoc.value)
    if (content === rawContent.value) {
      updateModifiedState(content)
      return false
    }

    commitHistory()
    historyDepth.value += 1
    applyDocumentContent(content)
    return true
  }

  function flushPendingChangesSync() {
    const hasPending = hasPendingTypingCommit.value
    clearTypingTimer()

    if (!hasPending) {
      return false
    }

    hasPendingTypingCommit.value = false
    return commitCurrentDocument()
  }

  function scheduleTypingCommit() {
    hasPendingTypingCommit.value = true
    clearTypingTimer()
    typingTimer = setTimeout(() => {
      typingTimer = null
      if (!hasPendingTypingCommit.value) {
        return
      }

      hasPendingTypingCommit.value = false
      commitCurrentDocument()
    }, TYPING_DEBOUNCE_MS)
  }

  function markDirtyImmediately() {
    if (isModified.value) {
      return
    }

    isModified.value = true
    options.emitModified(true)
  }

  function markDocumentChanged(mode: CdeDocumentChangeMode = 'action') {
    if (!hasDocument.value) {
      return
    }

    markDirtyImmediately()

    if (mode === 'typing') {
      scheduleTypingCommit()
      return
    }

    const committedPendingChange = flushPendingChangesSync()
    if (!committedPendingChange) {
      commitCurrentDocument()
    }
  }

  async function flushPendingChanges() {
    flushPendingChangesSync()
  }

  function resetDocumentHistory() {
    clearHistory()
    commitHistory()
    historyDepth.value = 0
  }

  function setSavedContent(content: string) {
    savedContent.value = content
    updateModifiedState(content)
  }

  function loadRawDoc(content: string) {
    clearTypingTimer()
    hasPendingTypingCommit.value = false
    rawContent.value = content
    options.resetSelection()

    try {
      const parsed = JSON.parse(content) as unknown
      const normalized = normalizeCardDocument(parsed)
      cardDoc.value = normalized.document
      storageWarnings.value = normalized.warnings
      rebuildParentLookup()
      setSavedContent(content)
      resetDocumentHistory()
    } catch (e) {
      reportAppError('OC-E4003', e)
      cardDoc.value = null
      storageWarnings.value = []
      rebuildParentLookup()
      setSavedContent(content)
      clearHistory()
      historyDepth.value = 0
    }
  }

  async function undo() {
    await flushPendingChanges()
    if (!canUndo.value) {
      return
    }

    historyUndo()
    historyDepth.value = Math.max(0, historyDepth.value - 1)
    rebuildParentLookup()
    syncDocumentContent()
  }

  async function redo() {
    await flushPendingChanges()
    if (!canRedo.value) {
      return
    }

    historyRedo()
    historyDepth.value += 1
    rebuildParentLookup()
    syncDocumentContent()
  }

  async function saveFile() {
    if (!cardDoc.value) return
    try {
      await flushPendingChanges()
      const content = serializeCurrentDocument(cardDoc.value)
      rawContent.value = content
      setSavedContent(content)
      options.emitModelValueUpdate(content)
      options.emitSave()
    } catch (e) {
      reportAppError('OC-E4004', e)
    }
  }

  function dispose() {
    // Disposal is the final handoff boundary for a session-backed editor.
    flushPendingChangesSync()
  }

  return {
    rawContent,
    cardDoc,
    storageWarnings,
    documentRevision,
    parentLookup,
    isModified,
    canUndo,
    canRedo,
    syncDocumentContent,
    markDocumentChanged,
    refreshDocumentState,
    flushPendingChanges,
    undo,
    redo,
    loadRawDoc,
    saveFile,
    dispose,
  }
}
