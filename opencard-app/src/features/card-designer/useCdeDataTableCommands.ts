/**
 * Coordinates Data Table field-selection configuration with injected Block field commands.
 * Owns document-write transactions only; projection, UI, selection, and Cell caches stay outside.
 */
import { computed, type Ref } from 'vue'
import type { AdditionalFieldKeyError, CardDocument } from '../../entities/card/model'
import type { PropertyFieldType } from '../../entities/card/schema'

type CdeDataTableChangeMode = 'typing' | 'action'

type BlockFieldTarget = {
  cardId: string
  blockId: string
  fieldKey: string
}

type BlockFieldCreateTarget = BlockFieldTarget & {
  fieldType: PropertyFieldType
  title?: string
}

export type CdeDataTableFieldCreatePayload = {
  blockId: string
  fieldKey: string
  fieldType: PropertyFieldType
  title?: string
}

type UseCdeDataTableCommandsOptions = {
  cardDoc: Readonly<Ref<CardDocument | null>>
  documentRevision: Readonly<Ref<number>>
  blueprintCardId: string
  refreshDocumentState: () => void
  markDocumentChanged: (mode?: CdeDataTableChangeMode) => void
  updateBlockField: (
    target: BlockFieldTarget,
    value: unknown,
    mode: CdeDataTableChangeMode,
  ) => boolean
  resetBlockField: (target: BlockFieldTarget) => boolean
  createBlockField: (
    target: BlockFieldCreateTarget,
  ) => AdditionalFieldKeyError | 'invalid-target' | null
  deleteBlockField: (target: BlockFieldTarget) => boolean
}

export function useCdeDataTableCommands(options: UseCdeDataTableCommandsOptions) {
  const fieldSelection = computed(() => {
    options.documentRevision.value
    return normalizeFieldSelection(options.cardDoc.value?.dataTable?.blocks)
  })

  function includeBlock(blockId: string): boolean {
    if (!blockId || hasOwn(fieldSelection.value, blockId)) return false
    return commitFieldSelection({ ...fieldSelection.value, [blockId]: [] })
  }

  function removeBlock(blockId: string): boolean {
    if (!hasOwn(fieldSelection.value, blockId)) return false
    const next = { ...fieldSelection.value }
    delete next[blockId]
    return commitFieldSelection(next)
  }

  function includeField(blockId: string, fieldKey: string): boolean {
    if (!blockId || !fieldKey) return false
    const current = fieldSelection.value[blockId] ?? []
    if (current.includes(fieldKey)) return false
    return commitFieldSelection({
      ...fieldSelection.value,
      [blockId]: [...current, fieldKey],
    })
  }

  function excludeField(blockId: string, fieldKey: string): boolean {
    const current = fieldSelection.value[blockId]
    if (!current?.includes(fieldKey)) return false
    return commitFieldSelection({
      ...fieldSelection.value,
      [blockId]: current.filter(candidate => candidate !== fieldKey),
    })
  }

  function updateCell(payload: BlockFieldTarget & { value: unknown }): boolean {
    return options.updateBlockField(payload, payload.value, 'typing')
  }

  function resetCell(payload: BlockFieldTarget): boolean {
    return options.resetBlockField(payload)
  }

  function createField(
    payload: CdeDataTableFieldCreatePayload,
  ): AdditionalFieldKeyError | 'invalid-target' | null {
    const previous = fieldSelection.value
    if (payload.blockId && payload.fieldKey) {
      const current = previous[payload.blockId] ?? []
      writeFieldSelection({
        ...previous,
        [payload.blockId]: current.includes(payload.fieldKey)
          ? current
          : [...current, payload.fieldKey],
      })
    }
    const result = options.createBlockField({
      cardId: options.blueprintCardId,
      ...payload,
    })
    if (result) {
      writeFieldSelection(previous)
      options.refreshDocumentState()
    }
    return result
  }

  function deleteField(blockId: string, fieldKey: string): boolean {
    const previous = fieldSelection.value
    const current = previous[blockId]
    if (current?.includes(fieldKey)) {
      writeFieldSelection({
        ...previous,
        [blockId]: current.filter(candidate => candidate !== fieldKey),
      })
    }
    const deleted = options.deleteBlockField({
      cardId: options.blueprintCardId,
      blockId,
      fieldKey,
    })
    if (!deleted) {
      writeFieldSelection(previous)
      options.refreshDocumentState()
    }
    return deleted
  }

  function commitFieldSelection(value: Readonly<Record<string, readonly string[]>>): boolean {
    if (!writeFieldSelection(value)) return false
    options.refreshDocumentState()
    options.markDocumentChanged('action')
    return true
  }

  function writeFieldSelection(value: Readonly<Record<string, readonly string[]>>): boolean {
    const document = options.cardDoc.value
    if (!document) return false
    const blocks = normalizeFieldSelection(value)
    if (Object.keys(blocks).length === 0) delete document.dataTable
    else document.dataTable = { blocks }
    return true
  }

  return {
    createField,
    deleteField,
    excludeField,
    fieldSelection,
    includeBlock,
    includeField,
    removeBlock,
    resetCell,
    updateCell,
  }
}

function normalizeFieldSelection(
  value: Readonly<Record<string, readonly string[]>> | null | undefined,
): Record<string, string[]> {
  return Object.fromEntries(Object.entries(value ?? {}).flatMap(([blockId, fieldKeys]) => {
    if (!blockId || !Array.isArray(fieldKeys)) return []
    return [[blockId, Array.from(new Set(fieldKeys.filter(fieldKey => Boolean(fieldKey))))]]
  }))
}

function hasOwn(record: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}
