import { computed, ref } from 'vue'
import {
  type CardDocument,
} from '../../entities/card/model'
import { buildParentLookup, type ParentLookup } from '../../entities/card/tree'
import {
  normalizeCardDocument,
  serializeCardDocumentWithWarnings,
  type CardStorageWarning,
} from '../../entities/card/storage'
import { reportAppError } from '../logging/appErrorCatalog'
import type { HistoryOperationMeta } from '../editor-runtime/history/structuredHistory'

export type CdeDocumentChangeMode = 'typing' | 'action'

type UseCdeDocumentStateOptions = {
  emitModelValueUpdate: (content: string, history?: HistoryOperationMeta) => void
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
  const documentRevision = ref(0)

  const hasDocument = computed(() => Boolean(cardDoc.value))

  function serializeCurrentDocument(document: CardDocument): string {
    const serialized = serializeCardDocumentWithWarnings(document, {
      resolveCustomBlockPublicFieldKeys: options.resolveCustomBlockPublicFieldKeys,
    })
    storageWarnings.value = serialized.warnings
    return serialized.text
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

  function refreshDocumentState(structural = false) {
    if (!cardDoc.value) {
      if (structural) rebuildParentLookup()
      return
    }

    documentRevision.value += 1
    if (structural) rebuildParentLookup()
  }

  function applyDocumentContent(content: string, history?: HistoryOperationMeta) {
    const hasChanged = content !== rawContent.value
    if (hasChanged) {
      rawContent.value = content
      options.emitModelValueUpdate(content, history)
    }

    updateModifiedState(content)
  }

  function commitCurrentDocument(history: HistoryOperationMeta) {
    if (!cardDoc.value) {
      return false
    }

    const content = serializeCurrentDocument(cardDoc.value)
    if (content === rawContent.value) {
      updateModifiedState(content)
      return false
    }

    applyDocumentContent(content, history)
    return true
  }

  function markDirtyImmediately() {
    if (isModified.value) {
      return
    }

    isModified.value = true
    options.emitModified(true)
  }

  function markDocumentChanged(
    mode: CdeDocumentChangeMode = 'action',
    target = 'document',
    structural = false,
  ) {
    if (!hasDocument.value) {
      return
    }

    markDirtyImmediately()

    commitCurrentDocument(mode === 'typing'
      ? { mode: 'debounced', merge: { family: 'card-edit', target }, structural }
      : { mode: 'immediate', structural })
  }

  async function flushPendingChanges() {
    // Session history owns debounced grouping and is flushed by the editor host.
  }

  function setSavedContent(content: string) {
    savedContent.value = content
    updateModifiedState(content)
  }

  function loadRawDoc(content: string, saved = true) {
    rawContent.value = content
    if (saved) options.resetSelection()

    try {
      const parsed = JSON.parse(content) as unknown
      const normalized = normalizeCardDocument(parsed)
      cardDoc.value = normalized.document
      storageWarnings.value = normalized.warnings
      rebuildParentLookup()
      if (saved) setSavedContent(content)
      else updateModifiedState(content)
    } catch (e) {
      reportAppError('OC-E4003', e)
      cardDoc.value = null
      storageWarnings.value = []
      rebuildParentLookup()
      if (saved) setSavedContent(content)
      else updateModifiedState(content)
    }
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

  return {
    rawContent,
    cardDoc,
    storageWarnings,
    documentRevision,
    parentLookup,
    isModified,
    markDocumentChanged,
    refreshDocumentState,
    flushPendingChanges,
    loadRawDoc,
    saveFile,
  }
}
