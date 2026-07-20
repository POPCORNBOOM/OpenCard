import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createTextBlock, type CardDocument } from '../entities/card/model'
import { useCdePropertyPanelState } from './useCdePropertyPanelState'

function createHarness() {
  const block = createTextBlock({ id: 'text', content: 'Blueprint' })
  block.customFields = { score: { datatype: 'number', title: 'Score', value: 10 } }
  const document: CardDocument = {
    type: 'card-document',
    id: 'document',
    name: 'Document',
    version: '1.0.0',
    width: 540,
    height: 850,
    background: '#fff',
    children: [{
      block,
      location: { id: 'location', type: 'simple-container-location', anchor: 'lt' },
    }],
    instances: [{
      type: 'card-instance',
      id: 'instance',
      name: 'Instance',
      amount: 1,
      data: {},
    }],
  }
  const cardDoc = ref<CardDocument | null>(document)
  const selectedCardId = ref('__blueprint__')
  const selectedBlock = computed(() => cardDoc.value?.children[0]?.block ?? null)
  const selectedLocation = computed(() => cardDoc.value?.children[0]?.location ?? null)
  const selectedCard = computed(() => cardDoc.value?.instances.find((item) => item.id === selectedCardId.value) ?? null)
  const documentRevision = ref(0)
  const markDocumentChanged = vi.fn()
  const state = useCdePropertyPanelState({
    cardDoc,
    selectedLocation,
    selectedBlock,
    selectedCard,
    selectedCardId,
    documentRevision,
    blueprintCardId: '__blueprint__',
    refreshDocumentState: () => { documentRevision.value += 1 },
    markDocumentChanged,
  })
  return { block, document, selectedCardId, state }
}

describe('useCdePropertyPanelState custom fields', () => {
  it('projects blueprint fields and creates structured definitions', () => {
    const { block, state } = createHarness()
    const input = state.propertyInputs.value[0]!

    expect(input.record.score).toBe(10)
    expect(input.fieldLabels?.score).toBe('Score')
    expect(input.customFields?.canCreate).toBe(true)

    expect(state.createCustomField({
      key: block.id,
      fieldKey: 'enabled',
      title: 'Enabled',
      datatype: 'boolean',
    })).toBeNull()
    expect(block.customFields?.enabled).toEqual({ datatype: 'boolean', title: 'Enabled', value: false })
  })

  it('writes instance overrides and resets them without changing the blueprint', () => {
    const { block, document, selectedCardId, state } = createHarness()
    selectedCardId.value = 'instance'

    expect(state.propertyInputs.value[0]?.record.score).toBe(10)
    state.updateProperty({ key: block.id, fieldKey: 'score', value: 24 })
    expect(document.instances[0]!.data.text?.score).toBe(24)
    expect(block.customFields?.score?.value).toBe(10)
    expect(state.propertyInputs.value[0]?.override?.score?.resettable).toBe(true)

    state.resetProperty({ key: block.id, fieldKey: 'score' })
    expect(document.instances[0]!.data.text).toBeUndefined()
    expect(state.propertyInputs.value[0]?.record.score).toBe(10)
  })

  it('deletes the blueprint field and every instance override', () => {
    const { block, document, state } = createHarness()
    document.instances[0]!.data.text = { score: 18 }

    expect(state.propertyInputs.value[0]?.customFields?.deleteImpactByKey.score).toBe(1)
    expect(state.deleteCustomField({ key: block.id, fieldKey: 'score' })).toBe(true)
    expect(block.customFields).toBeUndefined()
    expect(document.instances[0]!.data.text).toBeUndefined()
  })
})
