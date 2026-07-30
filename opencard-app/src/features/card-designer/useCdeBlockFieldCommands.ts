import type { Ref } from 'vue'
import {
  createBlockAdditionalField,
  deleteBlockAdditionalField,
  isCardStoredValue,
  setCardFieldValue,
  type AdditionalFieldKeyError,
  type CardBlock,
  type CardDocument,
} from '../../entities/card/model'
import {
  getDefault,
  getTypePropertyEditorSchema,
  type PropertyFieldType,
} from '../../entities/card/schema'
import { isBlockContainer } from '../../entities/card/tree'
import { isInstanceBlockFieldOverridable } from '../../entities/card/instance'
import { resetInstanceOverrideField } from './cdeInstanceOverride'
import type { CdeDocumentChangeMode } from './useCdeDocumentState'

export type CdeBlockFieldTarget = {
  cardId: string
  blockId: string
  fieldKey: string
}

export type CdeBlockFieldCreateTarget = CdeBlockFieldTarget & {
  fieldType: PropertyFieldType
  title?: string
}

type UseCdeBlockFieldCommandsOptions = {
  cardDoc: Readonly<Ref<CardDocument | null>>
  blueprintCardId: string
  refreshDocumentState: () => void
  markDocumentChanged: (mode?: CdeDocumentChangeMode) => void
}

export function findCdeBlock(document: CardDocument, blockId: string): CardBlock | null {
  function visit(block: CardBlock): CardBlock | null {
    if (block.id === blockId) return block
    if (!isBlockContainer(block)) return null
    for (const child of block.children) {
      const match = visit(child.block)
      if (match) return match
    }
    return null
  }

  for (const face of Object.values(document.faces)) {
    for (const child of face.children) {
      const match = visit(child.block)
      if (match) return match
    }
  }
  return null
}

export function useCdeBlockFieldCommands(options: UseCdeBlockFieldCommandsOptions) {
  function resolveTarget(target: CdeBlockFieldTarget) {
    const document = options.cardDoc.value
    const block = document ? findCdeBlock(document, target.blockId) : null
    const instance = target.cardId === options.blueprintCardId
      ? null
      : document?.instances?.find(candidate => candidate.id === target.cardId) ?? null
    return { document, block, instance }
  }

  function updateField(
    target: CdeBlockFieldTarget,
    value: unknown,
    mode: CdeDocumentChangeMode = 'typing',
  ): boolean {
    const { block, instance } = resolveTarget(target)
    if (!block || !isCardStoredValue(value)) return false

    if (target.cardId === options.blueprintCardId) {
      const record = block as unknown as Record<string, unknown>
      if (!setCardFieldValue(record, target.fieldKey, value)) record[target.fieldKey] = value
      if (block.type === 'image-block' && target.fieldKey === 'image') delete record.imagePath
    } else {
      if (!instance || !isInstanceBlockFieldOverridable(target.fieldKey)) return false
      const overrides = instance.data[block.id] ?? (instance.data[block.id] = {})
      overrides[target.fieldKey] = value
    }

    options.refreshDocumentState()
    options.markDocumentChanged(mode)
    return true
  }

  function resetField(target: CdeBlockFieldTarget): boolean {
    const { block, instance } = resolveTarget(target)
    if (!block) return false

    if (target.cardId === options.blueprintCardId) {
      const record = block as unknown as Record<string, unknown>
      const defaultValue = getDefault(block.type, target.fieldKey)
      if (defaultValue === undefined) delete record[target.fieldKey]
      else record[target.fieldKey] = defaultValue
      if (block.type === 'image-block' && target.fieldKey === 'image') delete record.imagePath
    } else {
      if (!instance || !resetInstanceOverrideField(instance.data, block.id, target.fieldKey)) return false
    }

    options.refreshDocumentState()
    options.markDocumentChanged('action')
    return true
  }

  function createField(target: CdeBlockFieldCreateTarget): AdditionalFieldKeyError | 'invalid-target' | null {
    if (target.cardId !== options.blueprintCardId) return 'invalid-target'
    const { block } = resolveTarget(target)
    if (!block) return 'invalid-target'
    const error = createBlockAdditionalField(block, target.fieldKey, target.fieldType, target.title)
    if (error) return error
    options.refreshDocumentState()
    options.markDocumentChanged('action')
    return null
  }

  function deleteField(target: CdeBlockFieldTarget): boolean {
    if (target.cardId !== options.blueprintCardId) return false
    const { document, block } = resolveTarget(target)
    if (!document || !block) return false

    if (block.additionalFieldDefinition?.[target.fieldKey]) {
      deleteBlockAdditionalField(document, block, target.fieldKey)
    } else {
      const definition = getTypePropertyEditorSchema(block.type)[target.fieldKey]
      const record = block as unknown as Record<string, unknown>
      if (!definition || definition.required === true || definition.isReadonly === true
        || !Object.prototype.hasOwnProperty.call(record, target.fieldKey)) return false
      delete record[target.fieldKey]
      for (const instance of document.instances ?? []) {
        resetInstanceOverrideField(instance.data, block.id, target.fieldKey)
      }
    }

    options.refreshDocumentState()
    options.markDocumentChanged('action')
    return true
  }

  return { updateField, resetField, createField, deleteField }
}
