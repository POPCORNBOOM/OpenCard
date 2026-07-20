import { computed, type ComputedRef, type Ref } from 'vue'
import type {
  CardBlock,
  CardDocument,
  CardInstanceRecord,
  FlowContainerLocationInfo,
  PropertyEditorInput,
  SimpleContainerLocationInfo,
} from '../entities/card/model'
import {
  createBlockCustomField,
  deleteBlockCustomField,
  getCustomFieldPropertyDefinition,
  setCardFieldValue,
} from '../entities/card/model'
import {
  customFieldDatatypes,
  getDefault,
  resolveNulls,
  type PropertyEditorSchemaOverride,
  type CustomFieldDatatype,
} from '../entities/card/schema'
import { resetInstanceOverrideField } from './cdeInstanceOverride'
import type { CdeDocumentChangeMode } from './useCdeDocumentState'

type CardLocationInfo = SimpleContainerLocationInfo | FlowContainerLocationInfo

export type CdePropertySortMode = 'category' | 'alphabetical'

export type CdePropertyMutation = {
  key: string
  fieldKey: string
  value: unknown
}

export type CdePropertyResetMutation = {
  key: string
  fieldKey: string
}

export type CdeCustomFieldCreateMutation = {
  key: string
  fieldKey: string
  title?: string
  datatype: CustomFieldDatatype
}

export type CdeCustomFieldDeleteMutation = {
  key: string
  fieldKey: string
}

type UseCdePropertyPanelStateOptions = {
  cardDoc: Readonly<Ref<CardDocument | null>>
  selectedLocation: Readonly<ComputedRef<CardLocationInfo | null>>
  selectedBlock: Readonly<ComputedRef<CardBlock | null>>
  selectedCard: Readonly<ComputedRef<CardInstanceRecord | null>>
  selectedCardId: Readonly<Ref<string | null>>
  documentRevision: Readonly<Ref<number>>
  blueprintCardId: string
  refreshDocumentState: () => void
  markDocumentChanged: (mode?: CdeDocumentChangeMode) => void
}

export function useCdePropertyPanelState(options: UseCdePropertyPanelStateOptions) {
  const selectedDocumentEditorRecord = computed<Record<string, unknown> & { type?: string } | null>(() => {
    options.documentRevision.value
    if (!options.cardDoc.value) {
      return null
    }

    return resolveNulls(
      'card-document',
      options.cardDoc.value as unknown as Record<string, unknown>,
    ) as Record<string, unknown> & { type?: string }
  })

  const selectedInstanceEditorRecord = computed<Record<string, unknown> & { type?: string } | null>(() => {
    options.documentRevision.value
    if (options.selectedCardId.value === options.blueprintCardId || !options.selectedCard.value) {
      return null
    }

    return resolveNulls(
      'card-instance',
      options.selectedCard.value as unknown as Record<string, unknown>,
    ) as Record<string, unknown> & { type?: string }
  })

  const selectedLayout = computed<CardLocationInfo | null>(() => {
    options.documentRevision.value
    return options.selectedLocation.value
  })

  const selectedBlockEditorRecord = computed<Record<string, unknown> & { type?: string } | null>(() => {
    options.documentRevision.value
    const block = options.selectedBlock.value
    if (!block) {
      return null
    }

    const customValues = Object.fromEntries(
      Object.entries(block.customFields ?? {}).map(([fieldKey, definition]) => [fieldKey, definition.value]),
    )

    if (options.selectedCardId.value === options.blueprintCardId || !options.selectedCard.value) {
      return {
        ...resolveNulls(
        block.type,
        block as Record<string, unknown>,
        ),
        ...customValues,
      } as Record<string, unknown> & { type?: string }
    }

    const blockOverrides = options.selectedCard.value.data[block.id] ?? {}
    return {
      ...resolveNulls(block.type, {
        ...block,
        ...blockOverrides,
      }),
      ...customValues,
      ...Object.fromEntries(Object.keys(block.customFields ?? {})
        .filter((fieldKey) => Object.prototype.hasOwnProperty.call(blockOverrides, fieldKey))
        .map((fieldKey) => [fieldKey, blockOverrides[fieldKey]])),
    } as Record<string, unknown> & { type?: string }
  })

  const blockInputOverride = computed<PropertyEditorSchemaOverride | undefined>(() => {
    options.documentRevision.value
    const block = options.selectedBlock.value
    if (!block) {
      return undefined
    }

    const instanceBlockData = options.selectedCardId.value !== options.blueprintCardId
      ? options.selectedCard.value?.data[block.id]
      : undefined

    const overrideEntries: Array<readonly [string, PropertyEditorSchemaOverride[string]]> = []
    for (const [fieldKey, definition] of Object.entries(block.customFields ?? {})) {
      overrideEntries.push([fieldKey, {
        ...getCustomFieldPropertyDefinition(definition),
        resettable: Object.prototype.hasOwnProperty.call(instanceBlockData ?? {}, fieldKey),
      }])
    }
    for (const fieldKey of Object.keys(instanceBlockData ?? {})) {
      if (block.customFields?.[fieldKey]) continue
      overrideEntries.push([fieldKey, { resettable: true }])
    }

    if (overrideEntries.length === 0) {
      return undefined
    }

    return Object.fromEntries(overrideEntries)
  })

  const propertyInputs = computed<PropertyEditorInput[]>(() => {
    const inputs: PropertyEditorInput[] = []
    const selectedBlock = options.selectedBlock.value
    const layout = selectedLayout.value
    const cardDoc = options.cardDoc.value
    const selectedCard = options.selectedCard.value

    if (selectedBlockEditorRecord.value && selectedBlock) {
      inputs.push({
        key: selectedBlock.id,
        title: selectedBlock.name?.trim() || selectedBlock.id,
        record: selectedBlockEditorRecord.value,
        override: blockInputOverride.value,
        fieldLabels: Object.fromEntries(
          Object.entries(selectedBlock.customFields ?? {})
            .map(([fieldKey, definition]) => [fieldKey, definition.title ?? fieldKey]),
        ),
        customFields: {
          keys: Object.keys(selectedBlock.customFields ?? {}),
          canCreate: options.selectedCardId.value === options.blueprintCardId,
          occupiedKeys: [
            ...Object.keys(selectedBlockEditorRecord.value),
            ...Object.keys(selectedBlock.customFields ?? {}),
          ],
          allowedDatatypes: customFieldDatatypes,
          deleteImpactByKey: Object.fromEntries(
            Object.keys(selectedBlock.customFields ?? {}).map((fieldKey) => [
              fieldKey,
              cardDoc?.instances.filter((instance) => (
                Object.prototype.hasOwnProperty.call(instance.data[selectedBlock.id] ?? {}, fieldKey)
              )).length ?? 0,
            ]),
          ),
        },
      })
      if (layout) {
        inputs.push({
          key: layout.id,
          title: 'Layout',
          record: layout as Record<string, unknown> & { type?: string },
        })
      }
      return inputs
    }
    if (selectedInstanceEditorRecord.value && selectedCard) {
      inputs.push({
        key: selectedCard.id,
        title: '实例',
        record: selectedInstanceEditorRecord.value,
      })
    }
    if (selectedDocumentEditorRecord.value && cardDoc) {
      inputs.push({
        key: cardDoc.id,
        title: '蓝图',
        record: selectedDocumentEditorRecord.value,
      })
    }



    return inputs
  })

  function isSelectedLayoutKey(key: string): boolean {
    const layout = selectedLayout.value
    return Boolean(layout && layout.id === key)
  }

  function isSelectedDocumentKey(key: string): boolean {
    const cardDoc = options.cardDoc.value
    return Boolean(cardDoc && cardDoc.id === key)
  }

  function isSelectedInstanceKey(key: string): boolean {
    const selectedCard = options.selectedCard.value
    if (!selectedCard || options.selectedCardId.value === options.blueprintCardId) {
      return false
    }
    return selectedCard.id === key
  }

  function isSelectedBlockKey(key: string): boolean {
    const block = options.selectedBlock.value
    return Boolean(block && block.id === key)
  }

  function updateLayoutField(fieldKey: string, value: unknown, mode: CdeDocumentChangeMode): boolean {
    const layout = selectedLayout.value
    if (!layout) {
      return false
    }

    ; (layout as Record<string, unknown>)[fieldKey] = value
    options.refreshDocumentState()
    options.markDocumentChanged(mode)
    return true
  }

  function updateDocumentField(fieldKey: string, value: unknown, mode: CdeDocumentChangeMode): boolean {
    const cardDoc = options.cardDoc.value
    if (!cardDoc) {
      return false
    }

    ; (cardDoc as Record<string, unknown>)[fieldKey] = value
    options.refreshDocumentState()
    options.markDocumentChanged(mode)
    return true
  }

  function updateInstanceField(fieldKey: string, value: unknown, mode: CdeDocumentChangeMode): boolean {
    const selectedCard = options.selectedCard.value
    if (!selectedCard || options.selectedCardId.value === options.blueprintCardId) {
      return false
    }

    ; (selectedCard as Record<string, unknown>)[fieldKey] = value
    options.refreshDocumentState()
    options.markDocumentChanged(mode)
    return true
  }

  function updateInstanceOverrideField(fieldKey: string, value: unknown, mode: CdeDocumentChangeMode): boolean {
    const block = options.selectedBlock.value
    const selectedCard = options.selectedCard.value
    if (!block || options.selectedCardId.value === options.blueprintCardId || !selectedCard) {
      return false
    }

    const instanceBlockData = selectedCard.data[block.id] ?? (selectedCard.data[block.id] = {})
    instanceBlockData[fieldKey] = value
    options.refreshDocumentState()
    options.markDocumentChanged(mode)
    return true
  }

  function updateBlueprintBlockField(
    fieldKey: string,
    value: unknown,
    mode: CdeDocumentChangeMode,
    clearLegacyImagePath: boolean,
  ): boolean {
    const block = options.selectedBlock.value
    if (!block) {
      return false
    }

    if (block.customFields?.[fieldKey]) {
      setCardFieldValue(block as unknown as Record<string, unknown>, fieldKey, value)
    } else {
      ; (block as unknown as Record<string, unknown>)[fieldKey] = value
    }
    if (clearLegacyImagePath && block.type === 'image-block' && fieldKey === 'image') {
      delete (block as Record<string, unknown>).imagePath
    }

    options.refreshDocumentState()
    options.markDocumentChanged(mode)
    return true
  }

  function updateProperty({
    key,
    fieldKey,
    value,
  }: CdePropertyMutation) {
    if (isSelectedLayoutKey(key)) {
      updateLayoutField(fieldKey, value, 'typing')
      return
    }

    if (isSelectedDocumentKey(key)) {
      updateDocumentField(fieldKey, value, 'typing')
      return
    }

    if (isSelectedInstanceKey(key)) {
      updateInstanceField(fieldKey, value, 'typing')
      return
    }

    if (!isSelectedBlockKey(key)) {
      return
    }

    if (updateInstanceOverrideField(fieldKey, value, 'typing')) {
      return
    }

    updateBlueprintBlockField(fieldKey, value, 'typing', true)
  }

  function addProperty({
    key,
    fieldKey,
    value,
  }: CdePropertyMutation) {
    if (isSelectedLayoutKey(key)) {
      updateLayoutField(fieldKey, value, 'action')
      return
    }

    if (isSelectedDocumentKey(key)) {
      updateDocumentField(fieldKey, value, 'action')
      return
    }

    if (isSelectedInstanceKey(key)) {
      updateInstanceField(fieldKey, value, 'action')
      return
    }

    if (!isSelectedBlockKey(key)) {
      return
    }

    if (updateInstanceOverrideField(fieldKey, value, 'action')) {
      return
    }

    updateBlueprintBlockField(fieldKey, value, 'action', false)
  }

  function resetLayoutField(fieldKey: string): boolean {
    const layout = selectedLayout.value
    if (!layout) {
      return false
    }

    const layoutType = typeof layout.type === 'string' ? layout.type : undefined
    const defaultValue = getDefault(layoutType, fieldKey)
    if (defaultValue === undefined) {
      delete (layout as Record<string, unknown>)[fieldKey]
    } else {
      ; (layout as Record<string, unknown>)[fieldKey] = defaultValue
    }

    options.refreshDocumentState()
    options.markDocumentChanged('action')
    return true
  }

  function resetDocumentField(fieldKey: string): boolean {
    const cardDoc = options.cardDoc.value
    if (!cardDoc) {
      return false
    }

    const defaultValue = getDefault('card-document', fieldKey)
    if (defaultValue === undefined) {
      delete (cardDoc as Record<string, unknown>)[fieldKey]
    } else {
      ; (cardDoc as Record<string, unknown>)[fieldKey] = defaultValue
    }

    options.refreshDocumentState()
    options.markDocumentChanged('action')
    return true
  }

  function resetInstanceField(fieldKey: string): boolean {
    const selectedCard = options.selectedCard.value
    if (!selectedCard || options.selectedCardId.value === options.blueprintCardId) {
      return false
    }

    const defaultValue = getDefault('card-instance', fieldKey)
    if (defaultValue === undefined) {
      delete (selectedCard as Record<string, unknown>)[fieldKey]
    } else {
      ; (selectedCard as Record<string, unknown>)[fieldKey] = defaultValue
    }

    options.refreshDocumentState()
    options.markDocumentChanged('action')
    return true
  }

  function resetBlockField(fieldKey: string): boolean {
    const block = options.selectedBlock.value
    if (!block) {
      return false
    }

    if (options.selectedCardId.value !== options.blueprintCardId && options.selectedCard.value) {
      const didResetOverride = resetInstanceOverrideField(options.selectedCard.value.data, block.id, fieldKey)
      if (!didResetOverride) {
        return false
      }

      options.refreshDocumentState()
      options.markDocumentChanged('action')
      return true
    }

    const defaultValue = getDefault(block.type, fieldKey)
    if (defaultValue === undefined) {
      delete (block as Record<string, unknown>)[fieldKey]
    } else {
      ; (block as Record<string, unknown>)[fieldKey] = defaultValue
    }

    if (block.type === 'image-block' && fieldKey === 'image') {
      delete (block as Record<string, unknown>).imagePath
    }

    options.refreshDocumentState()
    options.markDocumentChanged('action')
    return true
  }

  function resetProperty({
    key,
    fieldKey,
  }: CdePropertyResetMutation) {
    if (isSelectedLayoutKey(key)) {
      resetLayoutField(fieldKey)
      return
    }

    if (isSelectedDocumentKey(key)) {
      resetDocumentField(fieldKey)
      return
    }

    if (isSelectedInstanceKey(key)) {
      resetInstanceField(fieldKey)
      return
    }

    if (isSelectedBlockKey(key)) {
      resetBlockField(fieldKey)
    }
  }

  function createCustomField({ key, fieldKey, title, datatype }: CdeCustomFieldCreateMutation) {
    const block = options.selectedBlock.value
    if (!block || block.id !== key || options.selectedCardId.value !== options.blueprintCardId) {
      return 'invalid-target' as const
    }
    const error = createBlockCustomField(block, fieldKey, datatype, title)
    if (error) return error
    options.refreshDocumentState()
    options.markDocumentChanged('action')
    return null
  }

  function deleteCustomField({ key, fieldKey }: CdeCustomFieldDeleteMutation): boolean {
    const block = options.selectedBlock.value
    const document = options.cardDoc.value
    if (!block || !document || block.id !== key || options.selectedCardId.value !== options.blueprintCardId) {
      return false
    }
    deleteBlockCustomField(document, block, fieldKey)
    options.refreshDocumentState()
    options.markDocumentChanged('action')
    return true
  }

  return {
    selectedLayout,
    propertyInputs,
    updateProperty,
    addProperty,
    resetProperty,
    createCustomField,
    deleteCustomField,
  }
}
