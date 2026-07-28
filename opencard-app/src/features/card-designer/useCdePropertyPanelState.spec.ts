import { computed, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createTextBlock, type CardDocument } from '../../entities/card/model'
import { useCdePropertyPanelState } from './useCdePropertyPanelState'

function createHarness() {
  const block = createTextBlock({ id: 'text', content: 'Blueprint' })
  block.additionalFieldDefinition = { score: { fieldType: 'number', title: 'Score' } }
  ;(block as unknown as Record<string, unknown>).score = '10'
  const document: CardDocument = {
    type: 'card-document',
    schemaVersion: '2',
    id: 'document',
    name: 'Document',
    version: '1.0.0',
    width: '540',
    height: '850',
    faces: {
      front: {
        type: 'card-face',
        id: 'front',
        background: '#fff',
        children: [{
          block,
          location: { id: 'location', type: 'simple-container-location', anchor: 'lt' },
        }],
      },
      back: { type: 'card-face', id: 'back', background: '#000', children: [] },
    },
    instances: [{
      type: 'card-instance',
      id: 'instance',
      name: 'Instance',
      amount: '1',
      data: {},
    }],
  }
  const cardDoc = ref<CardDocument | null>(document)
  const selectedCardId = ref('__blueprint__')
  const selectedBlockKey = ref<string | null>('text')
  const activeFace = computed(() => cardDoc.value?.faces.front ?? null)
  const selectedBlock = computed(() => selectedBlockKey.value ? activeFace.value?.children[0]?.block ?? null : null)
  const selectedLocation = computed(() => selectedBlockKey.value ? activeFace.value?.children[0]?.location ?? null : null)
  const selectedCard = computed(() => cardDoc.value?.instances.find((item) => item.id === selectedCardId.value) ?? null)
  const documentRevision = ref(0)
  const markDocumentChanged = vi.fn()
  const state = useCdePropertyPanelState({
    cardDoc,
    activeFace,
    selectedLocation,
    selectedBlock,
    selectedCard,
    selectedCardId,
    documentRevision,
    blueprintCardId: '__blueprint__',
    refreshDocumentState: () => { documentRevision.value += 1 },
    markDocumentChanged,
    translate: (key) => key,
    hasMessage: () => false,
  })
  return { block, document, selectedCardId, selectedBlockKey, state }
}

describe('useCdePropertyPanelState additional fields', () => {
  it('projects blueprint fields and creates structured definitions', () => {
    const { block, state } = createHarness()
    const input = state.propertyInputs.value[0]!

    expect(input.record.score).toBe('10')
    expect(input.fields.score?.title).toBe('Score')
    expect(input.fields.score?.deletable).toBe(true)

    expect(state.createAdditionalField({
      key: block.id,
      fieldKey: 'enabled',
      title: 'Enabled',
      fieldType: 'boolean',
    })).toBeNull()
    expect(block.additionalFieldDefinition?.enabled).toEqual({ fieldType: 'boolean', title: 'Enabled' })
    expect((block as unknown as Record<string, unknown>).enabled).toBe('false')
  })

  it('writes instance overrides and resets them without changing the blueprint', () => {
    const { block, document, selectedCardId, state } = createHarness()
    selectedCardId.value = 'instance'

    expect(state.propertyInputs.value[0]?.record.score).toBe('10')
    state.updateProperty({ key: block.id, fieldKey: 'score', value: '24' })
    expect(document.instances[0]!.data.text?.score).toBe('24')
    expect((block as unknown as Record<string, unknown>).score).toBe('10')
    expect(state.propertyInputs.value[0]?.fields.score?.resettable).toBe(true)

    state.resetProperty({ key: block.id, fieldKey: 'score' })
    expect(document.instances[0]!.data.text).toBeUndefined()
    expect(state.propertyInputs.value[0]?.record.score).toBe('10')
  })

  it('deletes the blueprint field and every instance override', () => {
    const { block, document, state } = createHarness()
    document.instances[0]!.data.text = { score: '18' }

    expect(state.deleteProperty({ key: block.id, fieldKey: 'score' })).toBe(true)
    expect(block.additionalFieldDefinition).toBeUndefined()
    expect((block as unknown as Record<string, unknown>).score).toBeUndefined()
    expect(document.instances[0]!.data.text).toBeUndefined()
  })

  it('shows document, face and optional instance in order when no block is selected', () => {
    const { document, selectedBlockKey, selectedCardId, state } = createHarness()
    selectedBlockKey.value = null

    expect(state.propertyInputs.value.map((input) => input.key)).toEqual(['document', 'front'])
    expect(state.propertyInputs.value[0]?.title).toBe('propertyEditor.sources.document')
    selectedCardId.value = 'instance'
    expect(state.propertyInputs.value.map((input) => input.key)).toEqual(['document', 'front', 'instance'])

    state.updateProperty({ key: 'front', fieldKey: 'background', value: '#123456' })
    expect(document.faces.front.background).toBe('#123456')
    expect(document.instances[0]!.data).toEqual({})
    state.resetProperty({ key: 'front', fieldKey: 'background' })
    expect(document.faces.front.background).toBe('#FFFFFF')
  })

  it('projects missing optional document metadata as addable schema fields', () => {
    const { document, selectedBlockKey, state } = createHarness()
    selectedBlockKey.value = null
    delete document.name

    const documentInput = state.propertyInputs.value[0]!
    expect(documentInput.record).not.toHaveProperty('name')
    expect(documentInput.record).not.toHaveProperty('description')
    expect(documentInput.record).not.toHaveProperty('notes')
    expect(documentInput.fields.name?.defaultValue).toBe('')
    expect(documentInput.fields.description?.defaultValue).toBe('')
    expect(documentInput.fields.notes?.defaultValue).toBe('')

    state.addProperty({ key: document.id, fieldKey: 'description', value: '' })
    expect(document.description).toBe('')
    expect(state.propertyInputs.value[0]?.fields.description?.deletable).toBe(true)
    expect(state.propertyInputs.value[0]?.fields.description?.resettable).toBeUndefined()
  })

  it('deletes optional native fields but protects required fields', () => {
    const { block, document, state } = createHarness()
    block.name = 'Optional name'
    document.instances[0]!.data.text = { name: 'Instance name' }

    expect(state.propertyInputs.value[0]?.fields.name?.deletable).toBe(true)
    expect(state.propertyInputs.value[0]?.fields.content?.deletable).toBe(false)
    expect(state.deleteProperty({ key: block.id, fieldKey: 'name' })).toBe(true)
    expect(block.name).toBeUndefined()
    expect(document.instances[0]!.data.text).toBeUndefined()
    expect(state.deleteProperty({ key: block.id, fieldKey: 'content' })).toBe(false)
    expect(block.content).toBe('Blueprint')
  })
})
