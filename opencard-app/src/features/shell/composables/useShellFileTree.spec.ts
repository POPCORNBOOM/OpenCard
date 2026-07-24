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

  it('allows deletion for the root project interpretation file', () => {
    const projectPath = 'D:/project'
    const entryKey = `${projectPath}/.opencardprojectprofile`
    const { projectTreeData } = useShellFileTree({
      projectPath: ref(projectPath),
      indexedEntries: ref([
        { name: '.opencardprojectprofile', isDirectory: false },
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
    )).toBeUndefined()
    expect(projectTreeData.value.items.get(`${projectPath}/cards/main.opencard`)?.disabledActions)
      .toBeUndefined()
  })

  it('treats project metadata files as ordinary actionable tree entries', () => {
    const path = 'D:/project/.dictionary'
    const { projectTreeData } = useShellFileTree({
      projectPath: ref('D:/project'),
      indexedEntries: ref([{ name: '.dictionary', isDirectory: false }]),
      openedEditorItems: ref([]),
      activeSession: ref(null),
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile: vi.fn(async () => undefined),
    })
    expect(projectTreeData.value.items.get(path)?.actions).toEqual([projectEntryMoreActionKey(path)])
  })
})
