import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useCdePropertyEditorView } from './useCdePropertyEditorView'

describe('useCdePropertyEditorView', () => {
  it('projects category-defined icons and keeps A-Z icon independent', () => {
    const inputs = ref([{
      key: 'text',
      record: { type: 'text-block', id: 'text-1', content: 'Hello' },
    }])
    const sortMode = ref<'category' | 'alphabetical'>('category')
    const { displaySources } = useCdePropertyEditorView({
      inputs,
      sortMode,
      translate: (key) => key,
      hasMessage: () => false,
    })

    expect(displaySources.value[0]?.categories.find((category) => category.key === 'category:identity')?.icon)
      .toBe('data.symbol-key')
    expect(displaySources.value[0]?.categories.find((category) => category.key === 'category:content')?.icon)
      .toBe('data.symbol-string')

    sortMode.value = 'alphabetical'
    expect(displaySources.value[0]?.categories[0]?.icon).toBe('data.list-selection')
  })
})
