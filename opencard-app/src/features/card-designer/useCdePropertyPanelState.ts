import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type {
  CardBlock,
  CardDocument,
  CardFace,
  CardInstanceRecord,
  FlowContainerLocationInfo,
  SimpleContainerLocationInfo,
} from '../../entities/card/model'
import type {
  PropertyEditorCategoryDefinition,
  PropertyEditorFieldDefinition,
  PropertyEditorInput,
  PropertyEditorSortMode,
} from '../../shared/ui/property-editor/propertyEditor.types'
import {
  createBlockAdditionalField,
  deleteBlockAdditionalField,
  getAdditionalFieldPropertyDefinition,
  isCardStoredValue,
  setCardFieldValue,
  validateAdditionalFieldKey,
  type AdditionalFieldKeyError,
} from '../../entities/card/model'
import {
  additionalFieldTypes,
  createPropertyDefaultValue,
  getDefault,
  getTypePropertyEditorSchema,
  propertyEditorCategoryDefinitions,
  resolveNulls,
  type EditorPropertyDefinition,
  type PropertyFieldType,
} from '../../entities/card/schema'
import { resetInstanceOverrideField } from './cdeInstanceOverride'
import type { CdeDocumentChangeMode } from './useCdeDocumentState'

type CardLocationInfo = SimpleContainerLocationInfo | FlowContainerLocationInfo

export type CdePropertySortMode = PropertyEditorSortMode

export type CdePropertyFieldDefinition = PropertyEditorFieldDefinition & {
  acceptsBinding?: false
  extensionsFilter?: readonly string[]
}

export type CdePropertyEditorInput = Omit<PropertyEditorInput, 'fields'> & {
  fields: Readonly<Record<string, CdePropertyFieldDefinition>>
}

export type CdePropertyMutation = {
  key: string
  fieldKey: string
  value: unknown
}

export type CdePropertyResetMutation = {
  key: string
  fieldKey: string
}

export type CdeAdditionalFieldCreateMutation = {
  key: string
  fieldKey: string
  title?: string
  fieldType: PropertyFieldType
}

export type CdeAdditionalFieldDeleteMutation = {
  key: string
  fieldKey: string
}

export type CdeAdditionalFieldType = (typeof additionalFieldTypes)[number]

export type CdeAdditionalFieldCreateDraft = {
  fieldKey: string
  fieldType: CdeAdditionalFieldType
  title: string
}

type UseCdePropertyPanelStateOptions = {
  cardDoc: Readonly<Ref<CardDocument | null>>
  activeFace: Readonly<Ref<CardFace | null>>
  selectedLocation: Readonly<ComputedRef<CardLocationInfo | null>>
  selectedBlock: Readonly<ComputedRef<CardBlock | null>>
  selectedCard: Readonly<ComputedRef<CardInstanceRecord | null>>
  selectedCardId: Readonly<Ref<string | null>>
  documentRevision: Readonly<Ref<number>>
  blueprintCardId: string
  refreshDocumentState: () => void
  markDocumentChanged: (mode?: CdeDocumentChangeMode) => void
  translate: (messageKey: string) => string
  hasMessage: (messageKey: string) => boolean
}

export function useCdePropertyPanelState(options: UseCdePropertyPanelStateOptions) {
  const additionalFieldCreateDialogOpen = ref(false)
  const additionalFieldCreateDraft = ref<CdeAdditionalFieldCreateDraft>({
    fieldKey: '',
    fieldType: additionalFieldTypes[0] ?? 'string',
    title: '',
  })
  const canCreateAdditionalField = computed(() => Boolean(
    options.selectedBlock.value
    && options.selectedCardId.value === options.blueprintCardId,
  ))
  const additionalFieldCreateError = computed<AdditionalFieldKeyError | 'invalid-target' | null>(() => {
    const block = options.selectedBlock.value
    if (!block || !canCreateAdditionalField.value) return 'invalid-target'
    if (!additionalFieldTypes.includes(additionalFieldCreateDraft.value.fieldType)) {
      return 'unsupported-field-type'
    }
    return validateAdditionalFieldKey(block, additionalFieldCreateDraft.value.fieldKey)
  })
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

  const selectedFaceEditorRecord = computed<Record<string, unknown> & { type?: string } | null>(() => {
    options.documentRevision.value
    if (!options.activeFace.value) return null
    return resolveNulls(
      'card-face',
      options.activeFace.value as unknown as Record<string, unknown>,
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

    if (options.selectedCardId.value === options.blueprintCardId || !options.selectedCard.value) {
      return resolveNulls(
        block.type,
        block as Record<string, unknown>,
      ) as Record<string, unknown> & { type?: string }
    }

    const blockOverrides = options.selectedCard.value.data[block.id] ?? {}
    return {
      ...resolveNulls(block.type, {
        ...block,
        ...blockOverrides,
      }),
    } as Record<string, unknown> & { type?: string }
  })

  const blockInputOverride = computed<Record<string, Partial<EditorPropertyDefinition>> | undefined>(() => {
    options.documentRevision.value
    const block = options.selectedBlock.value
    if (!block) {
      return undefined
    }

    const instanceBlockData = options.selectedCardId.value !== options.blueprintCardId
      ? options.selectedCard.value?.data[block.id]
      : undefined

    const overrideEntries: Array<readonly [string, Partial<EditorPropertyDefinition>]> = []
    for (const [fieldKey, definition] of Object.entries(block.additionalFieldDefinition ?? {})) {
      overrideEntries.push([fieldKey, {
        ...getAdditionalFieldPropertyDefinition(definition),
        resettable: Object.prototype.hasOwnProperty.call(instanceBlockData ?? {}, fieldKey),
      }])
    }
    for (const fieldKey of Object.keys(instanceBlockData ?? {})) {
      if (block.additionalFieldDefinition?.[fieldKey]) continue
      overrideEntries.push([fieldKey, { resettable: true }])
    }

    if (overrideEntries.length === 0) {
      return undefined
    }

    return Object.fromEntries(overrideEntries)
  })

  const propertyCategories = computed<ReadonlyMap<string, PropertyEditorCategoryDefinition>>(() =>
    new Map(Object.entries(propertyEditorCategoryDefinitions).map(([key, definition]) => [
      key,
      {
        title: resolveLocalizedText(`propertyEditor.categories.${key}`, key),
        icon: definition.icon,
      },
    ])),
  )

  function resolveLocalizedText(messageKey: string, fallback: string): string {
    return options.hasMessage(messageKey) ? options.translate(messageKey) : fallback
  }

  function resolveFieldTitle(fieldKey: string, definition: EditorPropertyDefinition): string {
    const displayKey = definition.displayFieldKey ?? fieldKey
    return resolveLocalizedText(`propertyEditor.fields.${displayKey}`, fieldKey)
  }

  function resolveFields(
    record: Readonly<Record<string, unknown>>,
    override?: Readonly<Record<string, Partial<EditorPropertyDefinition>>>,
    labels?: Readonly<Record<string, string>>,
    categorylessKeys: ReadonlySet<string> = new Set(),
  ): Record<string, CdePropertyFieldDefinition> {
    const typeName = typeof record.type === 'string' ? record.type : undefined
    const definitions: Record<string, EditorPropertyDefinition> = { ...getTypePropertyEditorSchema(typeName) }
    for (const [fieldKey, fieldOverride] of Object.entries(override ?? {})) {
      const base = definitions[fieldKey]
      if (base) {
        definitions[fieldKey] = { ...base, ...fieldOverride } as EditorPropertyDefinition
      } else if (fieldOverride.fieldType) {
        definitions[fieldKey] = fieldOverride as EditorPropertyDefinition
      }
    }
    for (const fieldKey of Object.keys(record)) {
      if (!definitions[fieldKey]) {
        definitions[fieldKey] = {
          fieldType: 'string',
          isReadonly: true,
        }
      }
    }

    return Object.fromEntries(Object.entries(definitions).map(([fieldKey, definition]) => [
      fieldKey,
      {
        ...definition,
        defaultValue: createPropertyDefaultValue(definition),
        title: labels?.[fieldKey] ?? resolveFieldTitle(fieldKey, definition),
        category: categorylessKeys.has(fieldKey) ? undefined : definition.categoryId,
        deletable: categorylessKeys.has(fieldKey)
          && options.selectedCardId.value === options.blueprintCardId,
        ...(definition.fieldType === 'string' && definition.autocomplete?.length
          ? {
              completion: {
                static: {
                  values: definition.autocomplete,
                  presentation: 'ghost' as const,
                },
              },
            }
          : {}),
      },
    ]))
  }

  const propertyInputs = computed<CdePropertyEditorInput[]>(() => {
    const inputs: CdePropertyEditorInput[] = []
    const selectedBlock = options.selectedBlock.value
    const layout = selectedLayout.value
    const cardDoc = options.cardDoc.value
    const selectedCard = options.selectedCard.value

    if (selectedBlockEditorRecord.value && selectedBlock) {
      inputs.push({
        key: selectedBlock.id,
        title: selectedBlock.name?.trim() || selectedBlock.id,
        record: selectedBlockEditorRecord.value,
        fields: resolveFields(
          selectedBlockEditorRecord.value,
          blockInputOverride.value,
          Object.entries(selectedBlock.additionalFieldDefinition ?? {})
            .reduce<Record<string, string>>((labels, [fieldKey, definition]) => {
              labels[fieldKey] = definition.title ?? fieldKey
              return labels
            }, {}),
          new Set(Object.keys(selectedBlock.additionalFieldDefinition ?? {})),
        ),
      })
      if (layout) {
        inputs.push({
          key: layout.id,
          title: 'Layout',
          record: layout as Record<string, unknown> & { type?: string },
          fields: resolveFields(layout as Record<string, unknown>),
        })
      }
      return inputs
    }
    if (selectedDocumentEditorRecord.value && cardDoc) {
      inputs.push({
        key: cardDoc.id,
        title: '蓝图',
        record: selectedDocumentEditorRecord.value,
        fields: resolveFields(selectedDocumentEditorRecord.value),
      })
    }
    const activeFace = options.activeFace.value
    if (selectedFaceEditorRecord.value && activeFace) {
      inputs.push({
        key: activeFace.id,
        title: '卡面',
        record: selectedFaceEditorRecord.value,
        fields: resolveFields(selectedFaceEditorRecord.value),
      })
    }
    if (selectedInstanceEditorRecord.value && selectedCard) {
      inputs.push({
        key: selectedCard.id,
        title: '实例',
        record: selectedInstanceEditorRecord.value,
        fields: resolveFields(selectedInstanceEditorRecord.value),
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

  function isSelectedFaceKey(key: string): boolean {
    return options.activeFace.value?.id === key
  }

  function isSelectedBlockKey(key: string): boolean {
    const block = options.selectedBlock.value
    return Boolean(block && block.id === key)
  }

  function updateLayoutField(fieldKey: string, value: unknown, mode: CdeDocumentChangeMode): boolean {
    const layout = selectedLayout.value
    if (!layout || !isCardStoredValue(value)) {
      return false
    }

    ; (layout as Record<string, unknown>)[fieldKey] = value
    options.refreshDocumentState()
    options.markDocumentChanged(mode)
    return true
  }

  function updateDocumentField(fieldKey: string, value: unknown, mode: CdeDocumentChangeMode): boolean {
    const cardDoc = options.cardDoc.value
    if (!cardDoc || !isCardStoredValue(value)) {
      return false
    }

    ; (cardDoc as Record<string, unknown>)[fieldKey] = value
    options.refreshDocumentState()
    options.markDocumentChanged(mode)
    return true
  }

  function updateInstanceField(fieldKey: string, value: unknown, mode: CdeDocumentChangeMode): boolean {
    const selectedCard = options.selectedCard.value
    if (!selectedCard || options.selectedCardId.value === options.blueprintCardId || !isCardStoredValue(value)) {
      return false
    }

    ; (selectedCard as Record<string, unknown>)[fieldKey] = value
    options.refreshDocumentState()
    options.markDocumentChanged(mode)
    return true
  }

  function updateFaceField(fieldKey: string, value: unknown, mode: CdeDocumentChangeMode): boolean {
    const face = options.activeFace.value
    if (!face || !isCardStoredValue(value)) return false
    ;(face as unknown as Record<string, unknown>)[fieldKey] = value
    options.refreshDocumentState()
    options.markDocumentChanged(mode)
    return true
  }

  function updateInstanceOverrideField(fieldKey: string, value: unknown, mode: CdeDocumentChangeMode): boolean {
    const block = options.selectedBlock.value
    const selectedCard = options.selectedCard.value
    if (!block || options.selectedCardId.value === options.blueprintCardId || !selectedCard || !isCardStoredValue(value)) {
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
    if (!block || !isCardStoredValue(value)) {
      return false
    }

    const record = block as unknown as Record<string, unknown>
    if (!setCardFieldValue(record, fieldKey, value)) record[fieldKey] = value
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

    if (isSelectedFaceKey(key)) {
      updateFaceField(fieldKey, value, 'typing')
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

    if (isSelectedFaceKey(key)) {
      updateFaceField(fieldKey, value, 'action')
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

  function resetFaceField(fieldKey: string): boolean {
    const face = options.activeFace.value
    if (!face) return false
    const defaultValue = getDefault('card-face', fieldKey)
    if (defaultValue === undefined) {
      delete (face as unknown as Record<string, unknown>)[fieldKey]
    } else {
      ;(face as unknown as Record<string, unknown>)[fieldKey] = defaultValue
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

    if (isSelectedFaceKey(key)) {
      resetFaceField(fieldKey)
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

  function createAdditionalField({ key, fieldKey, title, fieldType }: CdeAdditionalFieldCreateMutation) {
    const block = options.selectedBlock.value
    if (!block || block.id !== key || options.selectedCardId.value !== options.blueprintCardId) {
      return 'invalid-target' as const
    }
    const error = createBlockAdditionalField(block, fieldKey, fieldType, title)
    if (error) return error
    options.refreshDocumentState()
    options.markDocumentChanged('action')
    return null
  }

  function openAdditionalFieldCreateDialog(): boolean {
    if (!canCreateAdditionalField.value) return false
    additionalFieldCreateDraft.value = {
      fieldKey: '',
      fieldType: additionalFieldTypes[0] ?? 'string',
      title: '',
    }
    additionalFieldCreateDialogOpen.value = true
    return true
  }

  function closeAdditionalFieldCreateDialog(): void {
    additionalFieldCreateDialogOpen.value = false
  }

  function submitAdditionalFieldCreate(): AdditionalFieldKeyError | 'invalid-target' | null {
    const block = options.selectedBlock.value
    const error = additionalFieldCreateError.value
    if (!block || error) return error ?? 'invalid-target'
    const result = createAdditionalField({
      key: block.id,
      fieldKey: additionalFieldCreateDraft.value.fieldKey,
      fieldType: additionalFieldCreateDraft.value.fieldType,
      title: additionalFieldCreateDraft.value.title,
    })
    if (!result) closeAdditionalFieldCreateDialog()
    return result
  }

  function deleteAdditionalField({ key, fieldKey }: CdeAdditionalFieldDeleteMutation): boolean {
    const block = options.selectedBlock.value
    const document = options.cardDoc.value
    if (!block || !document || block.id !== key || options.selectedCardId.value !== options.blueprintCardId) {
      return false
    }
    deleteBlockAdditionalField(document, block, fieldKey)
    options.refreshDocumentState()
    options.markDocumentChanged('action')
    return true
  }

  return {
    selectedLayout,
    propertyInputs,
    propertyCategories,
    canCreateAdditionalField,
    additionalFieldCreateDialogOpen,
    additionalFieldCreateDraft,
    additionalFieldCreateError,
    additionalFieldTypeOptions: additionalFieldTypes,
    updateProperty,
    addProperty,
    resetProperty,
    createAdditionalField,
    openAdditionalFieldCreateDialog,
    closeAdditionalFieldCreateDialog,
    submitAdditionalFieldCreate,
    deleteAdditionalField,
  }
}
