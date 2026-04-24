import { computed, type ComputedRef, type Ref } from 'vue'
import type {
  CardBlock,
  CardInstanceRecord,
  CardTreeNodeMetadata,
  PropertyEditorInput,
} from '../entities/card/model'
import {
  getDefault,
  resolveNulls,
  type PropertyEditorSchemaOverride,
} from '../entities/card/schema'
import type { ITreeNode } from '../shared/ui/tree/tree.types'
import { resetInstanceOverrideField } from './cdeInstanceOverride'
import type { CdeDocumentChangeMode } from './useCdeDocumentState'

export const CDE_PROPERTY_SOURCE_KEYS = {
  block: 'block',
  layout: 'layout',
} as const

export type CdePropertySourceKey = (typeof CDE_PROPERTY_SOURCE_KEYS)[keyof typeof CDE_PROPERTY_SOURCE_KEYS]

export type CdePropertySortMode = 'category' | 'alphabetical'

export type CdePropertyMutation = {
  sourceKey: string
  fieldKey: string
  value: unknown
}

export type CdePropertyResetMutation = {
  sourceKey: string
  fieldKey: string
}

type UseCdePropertyPanelStateOptions = {
  selectedNode: Readonly<ComputedRef<ITreeNode | null>>
  selectedBlock: Readonly<ComputedRef<CardBlock | null>>
  selectedCard: Readonly<ComputedRef<CardInstanceRecord | null>>
  selectedCardId: Readonly<Ref<string | null>>
  documentRevision: Readonly<Ref<number>>
  blueprintCardId: string
  refreshDocumentState: () => void
  markDocumentChanged: (mode?: CdeDocumentChangeMode) => void
}

function isCdePropertySourceKey(sourceKey: string): sourceKey is CdePropertySourceKey {
  return sourceKey === CDE_PROPERTY_SOURCE_KEYS.block || sourceKey === CDE_PROPERTY_SOURCE_KEYS.layout
}

export function useCdePropertyPanelState(options: UseCdePropertyPanelStateOptions) {
  const selectedLayout = computed<Record<string, unknown> | null>(() => {
    options.documentRevision.value
    const metadata = options.selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
    return metadata?.location ? (metadata.location as Record<string, unknown>) : null
  })

  const blockPropsView = computed<Record<string, unknown> & { type?: string } | null>(() => {
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
    return resolveNulls(block.type, {
      ...block,
      ...blockOverrides,
    }) as Record<string, unknown> & { type?: string }
  })

  const blockInputOverride = computed<PropertyEditorSchemaOverride | undefined>(() => {
    options.documentRevision.value
    const block = options.selectedBlock.value
    if (!block || options.selectedCardId.value === options.blueprintCardId || !options.selectedCard.value) {
      return undefined
    }

    const instanceBlockData = options.selectedCard.value.data[block.id]
    if (!instanceBlockData) {
      return undefined
    }

    const overrideEntries = Object.keys(instanceBlockData).map((fieldKey) => [
      fieldKey,
      { resettable: true },
    ] as const)

    if (overrideEntries.length === 0) {
      return undefined
    }

    return Object.fromEntries(overrideEntries)
  })

  const propertyInputs = computed<PropertyEditorInput[]>(() => {
    const inputs: PropertyEditorInput[] = []

    if (blockPropsView.value) {
      inputs.push({
        key: CDE_PROPERTY_SOURCE_KEYS.block,
        record: blockPropsView.value,
        override: blockInputOverride.value,
      })
    }

    if (selectedLayout.value) {
      inputs.push({
        key: CDE_PROPERTY_SOURCE_KEYS.layout,
        record: selectedLayout.value as Record<string, unknown> & { type?: string },
      })
    }

    return inputs
  })

  function updateLayoutField(fieldKey: string, value: unknown, mode: CdeDocumentChangeMode): boolean {
    const layout = selectedLayout.value
    if (!layout) {
      return false
    }

    layout[fieldKey] = value
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

    ; (block as Record<string, unknown>)[fieldKey] = value
    if (clearLegacyImagePath && block.type === 'image-block' && fieldKey === 'image') {
      delete (block as Record<string, unknown>).imagePath
    }

    options.refreshDocumentState()
    options.markDocumentChanged(mode)
    return true
  }

  function updateProperty({
    sourceKey,
    fieldKey,
    value,
  }: CdePropertyMutation) {
    if (!isCdePropertySourceKey(sourceKey)) {
      return
    }

    if (sourceKey === CDE_PROPERTY_SOURCE_KEYS.layout) {
      updateLayoutField(fieldKey, value, 'typing')
      return
    }

    if (updateInstanceOverrideField(fieldKey, value, 'typing')) {
      return
    }

    updateBlueprintBlockField(fieldKey, value, 'typing', true)
  }

  function addProperty({
    sourceKey,
    fieldKey,
    value,
  }: CdePropertyMutation) {
    if (!isCdePropertySourceKey(sourceKey)) {
      return
    }

    if (sourceKey === CDE_PROPERTY_SOURCE_KEYS.layout) {
      updateLayoutField(fieldKey, value, 'action')
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
      delete layout[fieldKey]
    } else {
      layout[fieldKey] = defaultValue
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
    sourceKey,
    fieldKey,
  }: CdePropertyResetMutation) {
    if (!isCdePropertySourceKey(sourceKey)) {
      return
    }

    if (sourceKey === CDE_PROPERTY_SOURCE_KEYS.layout) {
      resetLayoutField(fieldKey)
      return
    }

    resetBlockField(fieldKey)
  }

  return {
    selectedLayout,
    propertyInputs,
    updateProperty,
    addProperty,
    resetProperty,
  }
}
