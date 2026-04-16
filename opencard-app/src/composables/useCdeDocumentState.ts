import { ref } from 'vue'
import {
  buildParentLookup,
  type CardDocument,
  type ParentLookup,
} from '../core/Card'

type UseCdeDocumentStateOptions = {
  emitModelValueUpdate: (content: string) => void
  emitModified: (modified: boolean) => void
  emitSave: () => void
  resetSelection: () => void
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
      const parsed = JSON.parse(content) as CardDocument
      cardDoc.value = parsed
      parentLookup.value = buildParentLookup(parsed)
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
