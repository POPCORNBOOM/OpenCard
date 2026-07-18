import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  OPENED_EDITOR_CLOSE_ACTION_KEY,
  useIdeFileTree,
} from './useIdeFileTree'

describe('useIdeFileTree opened editors', () => {
  it('projects a close action onto every opened editor item', () => {
    const openedEditorItems = ref([{
      key: 'session-1',
      label: 'card.opencard',
      icon: 'file.opencard' as const,
    }])
    const { openedEditorTreeData } = useIdeFileTree({
      projectPath: ref(''),
      indexedEntries: ref([]),
      openedEditorItems,
      activeSession: ref(null),
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile: vi.fn(async () => undefined),
    })

    expect(openedEditorTreeData.value.items.get('session-1')?.actions)
      .toEqual([OPENED_EDITOR_CLOSE_ACTION_KEY])
  })
})
