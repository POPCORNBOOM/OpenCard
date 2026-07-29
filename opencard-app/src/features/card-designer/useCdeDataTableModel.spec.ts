import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import {
  createSimpleContainerBlock,
  createTextBlock,
  type CardDocument,
} from '../../entities/card/model'
import { useCdeDataTableModel } from './useCdeDataTableModel'

function createHarness() {
  const child = createTextBlock({ id: 'child', name: 'Child', content: 'Blueprint' })
  child.additionalFieldDefinition = { score: { fieldType: 'number', title: 'Score' } }
  ;(child as unknown as Record<string, unknown>).score = '10'
  const container = createSimpleContainerBlock({
    id: 'container',
    name: 'Container',
    children: [{
      block: child,
      location: { id: 'child-location', type: 'simple-container-location', anchor: 'lt' },
    }],
  })
  const back = createTextBlock({ id: 'back-text', name: 'Back', content: 'Back' })
  const document: CardDocument = {
    type: 'card-document', schemaVersion: '2', id: 'document', name: 'Document', version: '1.0.0',
    width: '540', height: '850',
    faces: {
      front: {
        type: 'card-face', id: 'front', background: '#fff',
        children: [{
          block: container,
          location: { id: 'root-location', type: 'simple-container-location', anchor: 'lt' },
        }],
      },
      back: {
        type: 'card-face', id: 'back', background: '#000',
        children: [{
          block: back,
          location: { id: 'back-location', type: 'simple-container-location', anchor: 'lt' },
        }],
      },
    },
    instances: [
      { type: 'card-instance', id: 'one', name: 'One', amount: '1', data: {} },
      {
        type: 'card-instance', id: 'two', name: 'Two', amount: '1',
        data: { child: { content: 'Override', legacy: 'Visible' } },
      },
    ],
  }
  const selection = ref<Record<string, string[]>>({
    container: [],
    child: ['content', 'score', 'legacy'],
    'back-text': ['content'],
  })
  const model = useCdeDataTableModel({
    cardDoc: ref(document),
    documentRevision: ref(0),
    fieldSelection: selection,
    blueprintCardId: '__blueprint__',
    blueprintTitle: () => 'Blueprint',
    faceTitle: key => key === 'front' ? 'Front' : 'Back',
    translate: key => key,
    hasMessage: () => false,
  })
  return { model, selection }
}

describe('useCdeDataTableModel', () => {
  it('projects ordered columns and hierarchical blocks from both faces', () => {
    const { model } = createHarness()
    expect(model.columns.value.map(column => column.title)).toEqual(['Blueprint', 'One', 'Two'])
    expect(model.faceGroups.value.map(group => group.title)).toEqual(['Front', 'Back'])
    expect(model.catalogFaceGroups.value[0]?.blocks.map(block => [block.key, block.depth])).toEqual([
      ['container', 0],
      ['child', 1],
    ])
    expect(model.catalogFaceGroups.value[1]?.blocks.map(block => block.key)).toEqual(['back-text'])
    expect(model.faceGroups.value[0]?.blocks.map(block => block.key)).toEqual(['container', 'child'])
  })

  it('projects editable schema and custom fields without materializing inheritance', () => {
    const { model } = createHarness()
    const childCatalog = model.catalogFaceGroups.value[0]?.blocks.find(block => block.key === 'child')
    const keys = childCatalog?.fields.map(field => field.key) ?? []
    expect(keys).toContain('fontSize')
    expect(keys).toContain('score')
    expect(keys).not.toContain('legacy')
    expect(keys).not.toContain('additionalFieldDefinition')
    expect(keys).not.toContain('id')
    expect(keys).not.toContain('type')

    const child = model.faceGroups.value[0]?.blocks.find(block => block.key === 'child')
    const content = child?.fields.find(field => field.key === 'content')
    expect(content?.cells.map(cell => ({ value: cell.value, inherited: cell.inherited, overridden: cell.overridden })))
      .toEqual([
        { value: 'Blueprint', inherited: false, overridden: false },
        { value: 'Blueprint', inherited: true, overridden: false },
        { value: 'Override', inherited: false, overridden: true },
      ])
    expect(content?.cells[1]?.identity).toBe('one\u0000child\u0000content')
  })

  it('does not construct Cell rows for unselected blocks or fields', () => {
    const { model, selection } = createHarness()
    selection.value = { child: ['content'] }

    expect(model.faceGroups.value[0]?.blocks.map(block => block.key)).toEqual(['child'])
    expect(model.faceGroups.value[0]?.blocks[0]?.fields.map(field => field.key)).toEqual(['content'])
    expect(model.faceGroups.value[1]?.blocks).toEqual([])
    expect(model.catalogFaceGroups.value[1]?.blocks.map(block => block.key)).toEqual(['back-text'])
  })
})
