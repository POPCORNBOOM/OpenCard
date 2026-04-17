import { ref } from 'vue'
import {
  buildParentLookup,
  toViewDoc,
  type CardDocument,
  type ParentLookup,
} from '../entities/card/model'

type UseCdeDocumentStateOptions = {
  emitModelValueUpdate: (content: string) => void
  emitModified: (modified: boolean) => void
  emitSave: () => void
  resetSelection: () => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isCardDocumentShape(value: unknown): value is CardDocument {
  if (!isRecord(value)) {
    return false
  }

  if (value.type !== 'card-document') {
    return false
  }

  if (typeof value.id !== 'string') {
    return false
  }

  if (typeof value.name !== 'string') {
    return false
  }

  if (value.version !== 1) {
    return false
  }

  if (!isFiniteNumber(value.width) || !isFiniteNumber(value.height)) {
    return false
  }

  if (!Array.isArray(value.children)) {
    return false
  }

  if (value.instances !== undefined && !Array.isArray(value.instances)) {
    return false
  }

  return true
}

function materializeDocumentForEditing(parsed: unknown): CardDocument {
  if (isCardDocumentShape(parsed)) {
    return parsed
  }

  console.warn('[cde] loadRawDoc: invalid document shape, fallback to materialized view document')
  return toViewDoc(parsed)
}

export function useCdeDocumentState(options: UseCdeDocumentStateOptions) {
  const rawContent = ref('')
  const cardDoc = ref<CardDocument | null>(null)
  const parentLookup = ref<ParentLookup>(new Map())
  const isModified = ref(false)

  function syncDocumentContent() {
    if (!cardDoc.value) {
      return
    }

    const content = JSON.stringify(cardDoc.value, null, 2)
    if (content === rawContent.value) {
      return
    }

    rawContent.value = content
    options.emitModelValueUpdate(content)
  }

  function markDocumentChanged() {
    isModified.value = true
    options.emitModified(true)
    syncDocumentContent()
  }

  function loadRawDoc(content: string) {
    rawContent.value = content
    options.resetSelection()

    try {
      const parsed = JSON.parse(content) as unknown
      const nextDocument = materializeDocumentForEditing(parsed)
      cardDoc.value = nextDocument
      parentLookup.value = buildParentLookup(nextDocument)
      isModified.value = false
      options.emitModified(false)
    } catch (e) {
      console.error('读取 .opencard 文件失败:', e)
      cardDoc.value = null
      parentLookup.value = new Map()
      isModified.value = false
      options.emitModified(false)
    }
  }

  async function saveFile() {
    if (!cardDoc.value) return
    try {
      const content = JSON.stringify(cardDoc.value, null, 2)
      rawContent.value = content
      isModified.value = false
      options.emitModelValueUpdate(content)
      options.emitModified(false)
      options.emitSave()
    } catch (e) {
      console.error('保存失败:', e)
    }
  }

  return {
    rawContent,
    cardDoc,
    parentLookup,
    isModified,
    syncDocumentContent,
    markDocumentChanged,
    loadRawDoc,
    saveFile,
  }
}
