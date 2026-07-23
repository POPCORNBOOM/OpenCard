import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  OPENED_EDITOR_CLOSE_ACTION_KEY,
  projectEntryDeleteActionKey,
  projectEntryMoreActionKey,
  useShellFileTree,
} from './useShellFileTree'

describe('useShellFileTree opened editors', () => {
  it('projects a close action onto every opened editor item', () => {
    const openedEditorItems = ref([{
      key: 'session-1',
      label: 'card.opencard',
      resourceKind: 'workspace' as const,
      icon: 'file.opencard' as const,
    }])
    const { openedEditorTreeData } = useShellFileTree({
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

  it('projects project entries as draggable, renamable action hosts', () => {
    const { projectTreeData } = useShellFileTree({
      projectPath: ref('D:/project'),
      indexedEntries: ref([{ name: 'cards/main.opencard', isDirectory: false }]),
      openedEditorItems: ref([]),
      activeSession: ref(null),
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile: vi.fn(async () => undefined),
    })

    expect(projectTreeData.value.items.get('D:/project/cards/main.opencard')).toMatchObject({
      renamable: true,
      draggable: true,
      actions: [projectEntryMoreActionKey('D:/project/cards/main.opencard')],
    })
  })

  it('disables deletion for the root project configuration file', () => {
    const projectPath = 'D:/project'
    const entryKey = `${projectPath}/.opencardproject`
    const { projectTreeData } = useShellFileTree({
      projectPath: ref(projectPath),
      indexedEntries: ref([
        { name: '.opencardproject', isDirectory: false },
        { name: 'cards/main.opencard', isDirectory: false },
      ]),
      openedEditorItems: ref([]),
      activeSession: ref(null),
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile: vi.fn(async () => undefined),
    })

    expect(projectTreeData.value.items.get(entryKey)?.disabledActions?.has(
      projectEntryDeleteActionKey(entryKey),
    )).toBe(true)
    expect(projectTreeData.value.items.get(`${projectPath}/cards/main.opencard`)?.disabledActions)
      .toBeUndefined()
  })
})
