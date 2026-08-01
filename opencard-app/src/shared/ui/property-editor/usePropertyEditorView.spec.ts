import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { PropertyEditorInput } from './propertyEditor.types'
import { usePropertyEditorView } from './usePropertyEditorView'

function createView(inputs: PropertyEditorInput[]) {
  return usePropertyEditorView({
    inputs: ref(inputs),
    categories: ref(new Map([
      ['identity', { title: 'Identity', icon: 'data.symbol-key' as const }],
      ['content', { title: 'Content', icon: 'data.symbol-string' as const }],
    ])),
    sortMode: ref<'category' | 'alphabetical'>('category'),
    otherCategory: ref({ title: 'Other', icon: 'data.list-tree' }),
  })
}

describe('usePropertyEditorView', () => {
  it('groups only from prepared field and category definitions', () => {
    const { displaySources } = createView([{
      key: 'text',
      record: { id: 'text-1', content: 'Hello', score: 12 },
      fields: {
        id: { title: 'ID', fieldType: 'string', category: 'identity' },
        content: { title: 'Content', fieldType: 'string', category: 'content' },
        score: { title: 'Score', fieldType: 'number' },
      },
    }])

    expect(displaySources.value[0]?.categories.map((category) => [category.title, category.icon]))
      .toEqual([
        ['Identity', 'data.symbol-key'],
        ['Content', 'data.symbol-string'],
        ['Other', 'data.list-tree'],
      ])
  })

  it('puts unknown categories in Other and keeps missing native fields addable', () => {
    const { displaySources } = createView([{
      key: 'text',
      record: { id: 'text-1' },
      fields: {
        id: { title: 'ID', fieldType: 'string', category: 'identity' },
        content: { title: 'Content', fieldType: 'string', category: 'missing' },
      },
    }])

    expect(displaySources.value[0]?.categories[1]).toMatchObject({
      title: 'Other',
      addableFields: [{ key: 'content', label: 'Content' }],
    })
  })

  it('uses schema order in category mode instead of localized label order', () => {
    const { displaySources } = createView([{
      key: 'text',
      record: { name: 'Title', id: 'text-1', content: 'Hello' },
      fields: {
        name: { title: 'Z name', fieldType: 'string', category: 'identity', order: 0 },
        id: { title: 'A id', fieldType: 'string', category: 'identity', order: 1 },
        content: { title: 'Content', fieldType: 'string', category: 'content', order: 2 },
      },
    }])

    expect(displaySources.value[0]?.categories[0]?.entries.map(entry => entry.key))
      .toEqual(['name', 'id'])
  })

  it('warns and skips a record key without a prepared definition', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { displaySources } = createView([{
      key: 'text',
      record: { unknown: 'value' },
      fields: {},
    }])

    expect(displaySources.value).toEqual([])
    expect(warn).toHaveBeenCalledWith('[PropertyEditor] Missing field definition for text.unknown')
    warn.mockRestore()
  })
})
