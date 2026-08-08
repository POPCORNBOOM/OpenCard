import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createBlock, type AdditionalFieldKeyError, type CardDocument } from '../../entities/card/model'
import type { PropertyFieldType } from '../../entities/card/schema'
import { useCdeDataTableCommands } from './useCdeDataTableCommands'

function createDocument(): CardDocument {
  return {
    type: 'card-document',
    schemaVersion: '2',
    id: 'document',
    name: 'Document',
    version: '1.0.0',
    width: '540',
    height: '850',
    faces: {
      front: { type: 'card-face', id: 'front', background: '#fff', children: [] },
      back: { type: 'card-face', id: 'back', background: '#000', children: [] },
    },
    instances: [],
    dataTable: { blocks: { text: ['content', 'content', ''] } },
  }
}

function createHarness() {
  const cardDoc = ref<CardDocument | null>(createDocument())
  const documentRevision = ref(0)
  const refreshDocumentState = vi.fn(() => { documentRevision.value += 1 })
  const markDocumentChanged = vi.fn()
  const updateBlockField = vi.fn(() => true)
  const resetBlockField = vi.fn(() => true)
  const createBlockField = vi.fn<(target: {
    cardId: string
    blockId: string
    fieldKey: string
    fieldType: PropertyFieldType
    title?: string
  }) => AdditionalFieldKeyError | 'invalid-target' | null>(() => null)
  const deleteBlockField = vi.fn(() => true)
  const state = useCdeDataTableCommands({
    cardDoc,
    documentRevision,
    blueprintCardId: '__blueprint__',
    refreshDocumentState,
    markDocumentChanged,
    updateBlockField,
    resetBlockField,
    createBlockField,
    deleteBlockField,
  })
  return {
    cardDoc,
    createBlockField,
    deleteBlockField,
    markDocumentChanged,
    refreshDocumentState,
    resetBlockField,
    state,
    updateBlockField,
  }
}

describe('useCdeDataTableCommands', () => {
  it('normalizes selection and commits Block/field configuration as actions', () => {
    const { cardDoc, markDocumentChanged, refreshDocumentState, state } = createHarness()

    expect(state.fieldSelection.value).toEqual({ text: ['content'] })
    expect(state.includeBlock('image')).toBe(true)
    expect(cardDoc.value?.dataTable?.blocks).toEqual({ text: ['content'], image: [] })
    expect(state.includeField('image', 'image')).toBe(true)
    expect(state.excludeField('text', 'content')).toBe(true)
    expect(state.removeBlock('text')).toBe(true)
    expect(state.removeBlock('image')).toBe(true)
    expect(cardDoc.value?.dataTable).toBeUndefined()
    expect(refreshDocumentState).toHaveBeenCalledTimes(5)
    expect(markDocumentChanged).toHaveBeenCalledTimes(5)
    expect(markDocumentChanged).toHaveBeenLastCalledWith('action')
  })

  it('does not commit invalid or duplicate configuration commands', () => {
    const { markDocumentChanged, refreshDocumentState, state } = createHarness()

    expect(state.includeBlock('text')).toBe(false)
    expect(state.includeBlock('')).toBe(false)
    expect(state.includeField('text', 'content')).toBe(false)
    expect(state.includeField('', 'name')).toBe(false)
    expect(state.excludeField('text', 'missing')).toBe(false)
    expect(state.removeBlock('missing')).toBe(false)
    expect(refreshDocumentState).not.toHaveBeenCalled()
    expect(markDocumentChanged).not.toHaveBeenCalled()
  })

  it('forwards Cell writes with explicit targets and typing mode', () => {
    const { resetBlockField, state, updateBlockField } = createHarness()
    const target = { cardId: 'instance', blockId: 'text', fieldKey: 'content' }

    expect(state.updateCell({ ...target, value: 'Updated' })).toBe(true)
    expect(updateBlockField).toHaveBeenCalledWith({ ...target, value: 'Updated' }, 'Updated', 'typing')
    expect(state.resetCell(target)).toBe(true)
    expect(resetBlockField).toHaveBeenCalledWith(target)
  })

  it('defaults to exporting all Instances and persists explicit selection', () => {
    const { cardDoc, markDocumentChanged, state } = createHarness()
    cardDoc.value!.instances = [
      { type: 'card-instance', id: 'one', name: 'One', amount: '1', data: {} },
      { type: 'card-instance', id: 'two', name: 'Two', amount: '1', data: {} },
    ]

    expect(state.exportInstanceIds.value).toEqual(['one', 'two'])
    expect(state.setInstanceExported('one', false)).toBe(true)
    expect(cardDoc.value?.dataTable?.exportInstanceIds).toEqual(['two'])
    expect(state.exportInstanceIds.value).toEqual(['two'])
    expect(state.setInstanceExported('one', true)).toBe(true)
    expect(cardDoc.value?.dataTable?.exportInstanceIds).toEqual(['one', 'two'])
    expect(state.setInstanceExported('missing', true)).toBe(false)
    expect(markDocumentChanged).toHaveBeenCalledTimes(2)
  })

  it('keeps explicit Instance selection when the last field selection is removed', () => {
    const { cardDoc, state } = createHarness()
    cardDoc.value!.dataTable!.exportInstanceIds = []

    expect(state.excludeField('text', 'content')).toBe(true)
    expect(state.removeBlock('text')).toBe(true)
    expect(cardDoc.value?.dataTable).toEqual({ blocks: {}, exportInstanceIds: [] })
  })

  it('applies workbook values and inheritance resets in one action', () => {
    const { cardDoc, markDocumentChanged, refreshDocumentState, state } = createHarness()
    cardDoc.value!.faces.front.children = [{
      block: { type: 'text-block', id: 'text', name: 'Text', content: 'Before' },
      location: { type: 'simple-container-location', id: 'location', anchor: 'lt' },
    }]
    cardDoc.value!.instances = [{
      type: 'card-instance',
      id: 'instance',
      name: 'Instance',
      amount: '1',
      data: { text: { content: 'Override' } },
    }]

    expect(state.applyWorkbookUpdates([
      { cardId: '__blueprint__', blockId: 'text', fieldKey: 'content', value: 'After', reset: false },
      { cardId: 'instance', blockId: 'text', fieldKey: 'content', reset: true },
    ])).toBe(true)
    expect(cardDoc.value!.faces.front.children[0]!.block).toMatchObject({ content: 'After' })
    expect(cardDoc.value!.instances[0]!.data).toEqual({})
    expect(refreshDocumentState).toHaveBeenCalledTimes(1)
    expect(markDocumentChanged).toHaveBeenCalledTimes(1)
    expect(markDocumentChanged).toHaveBeenCalledWith('action')
  })

  it('creates workbook Instances, renames Blocks, and applies their values atomically', () => {
    const { cardDoc, markDocumentChanged, refreshDocumentState, state } = createHarness()
    cardDoc.value!.faces.front.children = [{
      block: { type: 'text-block', id: 'text', name: 'Before', content: 'Blueprint' },
      location: { type: 'simple-container-location', id: 'location', anchor: 'lt' },
    }]
    const instance = {
      type: 'card-instance' as const,
      id: 'new-instance',
      name: 'Imported',
      amount: '1',
      data: {},
    }

    expect(state.applyWorkbookImport({
      newInstances: [instance],
      blockRenames: [{ blockId: 'text', previousName: 'Before', nextName: 'After' }],
      updates: [{
        cardId: instance.id,
        blockId: 'text',
        fieldKey: 'content',
        value: 'Imported value',
        reset: false,
      }],
      warnings: [],
    })).toBe(true)
    expect(cardDoc.value!.faces.front.children[0]!.block.name).toBe('After')
    expect(cardDoc.value!.instances).toEqual([{
      ...instance,
      data: { text: { content: 'Imported value' } },
    }])
    expect(cardDoc.value!.dataTable?.exportInstanceIds).toContain(instance.id)
    expect(refreshDocumentState).toHaveBeenCalledTimes(1)
    expect(markDocumentChanged).toHaveBeenCalledTimes(1)
  })

  it('includes a custom field before creation and keeps it on success', () => {
    const { cardDoc, createBlockField, state } = createHarness()
    createBlockField.mockImplementation((target) => {
      expect(cardDoc.value?.dataTable?.blocks.text).toEqual(['content', 'score'])
      expect(target).toEqual({
        cardId: '__blueprint__',
        blockId: 'text',
        fieldKey: 'score',
        fieldType: 'number',
        title: 'Score',
      })
      return null
    })

    expect(state.createField({
      blockId: 'text',
      fieldKey: 'score',
      fieldType: 'number',
      title: 'Score',
    })).toBeNull()
    expect(cardDoc.value?.dataTable?.blocks.text).toEqual(['content', 'score'])
  })

  it('rolls back configuration when custom-field creation fails', () => {
    const { cardDoc, createBlockField, refreshDocumentState, state } = createHarness()
    createBlockField.mockReturnValue('duplicate')

    expect(state.createField({
      blockId: 'text',
      fieldKey: 'score',
      fieldType: 'number',
    })).toBe('duplicate')
    expect(cardDoc.value?.dataTable?.blocks).toEqual({ text: ['content'] })
    expect(refreshDocumentState).toHaveBeenCalledTimes(1)
  })

  it('removes configuration before deletion and restores it on failure', () => {
    const success = createHarness()
    success.deleteBlockField.mockImplementation(() => {
      expect(success.cardDoc.value?.dataTable?.blocks.text).toEqual([])
      return true
    })
    expect(success.state.deleteField('text', 'content')).toBe(true)
    expect(success.cardDoc.value?.dataTable?.blocks.text).toEqual([])

    const failure = createHarness()
    failure.deleteBlockField.mockReturnValue(false)
    expect(failure.state.deleteField('text', 'content')).toBe(false)
    expect(failure.cardDoc.value?.dataTable?.blocks).toEqual({ text: ['content'] })
    expect(failure.refreshDocumentState).toHaveBeenCalledTimes(1)
  })

  it('allows custom-block public values but protects its interface definition', () => {
    const { cardDoc, createBlockField, deleteBlockField, state, updateBlockField } = createHarness()
    const custom = createBlock('custom-block', {
      id: 'custom', source: 'block:square', interfaceHash: 'hash', notes: 'Protected',
    })
    custom.additionalFieldDefinition = { size: { fieldType: 'number' } }
    ;(custom as unknown as Record<string, unknown>).size = '120'
    cardDoc.value!.faces.front.children = [{
      block: custom,
      location: { id: 'custom-location', type: 'simple-container-location', anchor: 'lt' },
    }]

    expect(state.includeField(custom.id, 'size')).toBe(true)
    expect(state.includeField(custom.id, 'notes')).toBe(false)
    expect(state.updateCell({ cardId: '__blueprint__', blockId: custom.id, fieldKey: 'size', value: '160' })).toBe(true)
    expect(state.updateCell({ cardId: '__blueprint__', blockId: custom.id, fieldKey: 'notes', value: 'Changed' })).toBe(false)
    expect(updateBlockField).toHaveBeenCalledTimes(1)
    expect(state.createField({ blockId: custom.id, fieldKey: 'other', fieldType: 'string' })).toBe('invalid-target')
    expect(state.deleteField(custom.id, 'size')).toBe(false)
    expect(createBlockField).not.toHaveBeenCalled()
    expect(deleteBlockField).not.toHaveBeenCalled()
  })
})
