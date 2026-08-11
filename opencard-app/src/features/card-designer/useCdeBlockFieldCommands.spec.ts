import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createTextBlock, type CardDocument } from '../../entities/card/model'
import { useCdeBlockFieldCommands } from './useCdeBlockFieldCommands'

function createHarness() {
  const block = createTextBlock({ id: 'text', content: 'Blueprint', name: 'Title' })
  const document: CardDocument = {
    type: 'card-document',

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
        children: [{ block, location: { id: 'location', type: 'simple-container-location', anchor: 'lt' } }],
      },
      back: { type: 'card-face', id: 'back', background: '#000', children: [] },
    },
    instances: [
      { type: 'card-instance', id: 'one', name: 'One', amount: '1', data: {} },
      { type: 'card-instance', id: 'two', name: 'Two', amount: '1', data: {} },
    ],
  }
  const revision = ref(0)
  const markDocumentChanged = vi.fn()
  const commands = useCdeBlockFieldCommands({
    cardDoc: ref(document),
    blueprintCardId: '__blueprint__',
    refreshDocumentState: () => { revision.value += 1 },
    markDocumentChanged,
  })
  return { block, document, revision, markDocumentChanged, commands }
}

describe('useCdeBlockFieldCommands', () => {
  it('writes explicit blueprint and instance targets without selection state', () => {
    const { block, document, commands, markDocumentChanged } = createHarness()

    expect(commands.updateField({
      cardId: '__blueprint__', blockId: 'text', fieldKey: 'content',
    }, 'Changed')).toBe(true)
    expect(block.content).toBe('Changed')

    expect(commands.updateField({ cardId: 'two', blockId: 'text', fieldKey: 'content' }, 'Override')).toBe(true)
    expect(document.instances[0]!.data.text).toBeUndefined()
    expect(document.instances[1]!.data.text?.content).toBe('Override')
    expect(commands.updateField({ cardId: 'two', blockId: 'text', fieldKey: 'name' }, 'Instance title')).toBe(false)
    expect(document.instances[1]!.data.text).not.toHaveProperty('name')
    expect(markDocumentChanged).toHaveBeenLastCalledWith('typing')
  })

  it('resets overrides and deletes blueprint fields across every instance', () => {
    const { block, document, commands } = createHarness()
    expect(commands.createField({
      cardId: '__blueprint__', blockId: 'text', fieldKey: 'score', fieldType: 'number', title: 'Score',
    })).toBeNull()
    commands.updateField({ cardId: 'one', blockId: 'text', fieldKey: 'score' }, '10')
    commands.updateField({ cardId: 'two', blockId: 'text', fieldKey: 'score' }, '20')

    expect(commands.resetField({ cardId: 'one', blockId: 'text', fieldKey: 'score' })).toBe(true)
    expect(document.instances[0]!.data.text).toBeUndefined()
    expect(document.instances[1]!.data.text?.score).toBe('20')

    expect(commands.deleteField({ cardId: '__blueprint__', blockId: 'text', fieldKey: 'score' })).toBe(true)
    expect(block.additionalFieldDefinition).toBeUndefined()
    expect(document.instances[1]!.data.text).toBeUndefined()
  })
})
