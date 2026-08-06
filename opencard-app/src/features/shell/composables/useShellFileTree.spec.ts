import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { EditorSession } from '../../workspace/store/editorSessionStore'
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
      label: 'card.ocdocument',
      resourceKind: 'workspace' as const,
      icon: 'file.opencard' as const,
    }])
    const { openedEditorTreeData } = useShellFileTree({
      projectPath: ref(''),
      indexedEntries: ref([]),
      openedEditorItems,
      activeSession: ref(null),
      translate: key => key,
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
      indexedEntries: ref([{ name: 'cards/main.ocdocument', isDirectory: false }]),
      openedEditorItems: ref([]),
      activeSession: ref(null),
      translate: key => key,
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile: vi.fn(async () => undefined),
    })

    expect(projectTreeData.value.items.get('D:/project/cards/main.ocdocument')).toMatchObject({
      renamable: true,
      draggable: true,
      actions: [projectEntryMoreActionKey('D:/project/cards/main.ocdocument')],
    })
  })

  it('allows deletion for the root project interpretation file', () => {
    const projectPath = 'D:/project'
    const entryKey = `${projectPath}/.ocproject`
    const { projectTreeData } = useShellFileTree({
      projectPath: ref(projectPath),
      indexedEntries: ref([
        { name: '.ocproject', isDirectory: false },
        { name: 'cards/main.ocdocument', isDirectory: false },
      ]),
      openedEditorItems: ref([]),
      activeSession: ref(null),
      translate: key => key,
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile: vi.fn(async () => undefined),
    })

    expect(projectTreeData.value.items.get(entryKey)?.disabledActions?.has(
      projectEntryDeleteActionKey(entryKey),
    )).toBeUndefined()
    expect(projectTreeData.value.items.get(`${projectPath}/cards/main.ocdocument`)?.disabledActions)
      .toBeUndefined()
  })

  it('treats project metadata files as ordinary actionable tree entries', () => {
    const path = 'D:/project/.oclocale'
    const { projectTreeData } = useShellFileTree({
      projectPath: ref('D:/project'),
      indexedEntries: ref([{ name: '.oclocale', isDirectory: false }]),
      openedEditorItems: ref([]),
      activeSession: ref(null),
      translate: key => key,
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile: vi.fn(async () => undefined),
    })
    expect(projectTreeData.value.items.get(path)?.actions).toEqual([projectEntryMoreActionKey(path)])
  })

  it('pins root project files by filename and moves their localized annotation to the tail', () => {
    const projectPath = 'D:/project'
    const labels: Record<string, string> = {
      'fileTypes.opencardProjectProfile': 'Project profile',
      'fileTypes.opencardFontRegistry': 'Font registry',
      'fileTypes.opencardIconRegistry': 'Icon registry',
      'fileTypes.opencardDictionary': 'Dictionary',
    }
    const { projectTreeData } = useShellFileTree({
      projectPath: ref(projectPath),
      indexedEntries: ref([
        { name: 'cards', isDirectory: true },
        { name: 'notes.txt', isDirectory: false },
        { name: '.oclocale', isDirectory: false },
        { name: '.ocicons', isDirectory: false },
        { name: '.ocfonts', isDirectory: false },
        { name: '.ocproject', isDirectory: false },
        { name: 'cards/.oclocale', isDirectory: false },
      ]),
      openedEditorItems: ref([]),
      activeSession: ref(null),
      translate: key => labels[key] ?? key,
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile: vi.fn(async () => undefined),
    })

    expect(projectTreeData.value.rootKeys).toEqual([
      `${projectPath}/.ocproject`,
      `${projectPath}/.ocfonts`,
      `${projectPath}/.ocicons`,
      `${projectPath}/.oclocale`,
      `${projectPath}/cards`,
      `${projectPath}/notes.txt`,
    ])
    expect(projectTreeData.value.items.get(`${projectPath}/.ocicons`)).toMatchObject({
      label: '.ocicons',
      tail: 'Icon registry',
    })
    expect(projectTreeData.value.items.get(`${projectPath}/cards/.oclocale`)).toMatchObject({
      label: '.oclocale',
      tail: undefined,
    })
  })

  it('keeps selection references stable when active editor content changes', async () => {
    const path = 'D:/project/card.ocdocument'
    const activeSession = ref<EditorSession | null>({
      id: 'session-1',
      resourceKind: 'workspace',
      path,
      fileTypeId: 'opencard',
      name: 'card.ocdocument',
      editorId: 'card-designer',
      savedContent: '{}',
      draftContent: '{}',
      isDirty: false,
      isPreview: false,
    })
    const result = useShellFileTree({
      projectPath: ref('D:/project'),
      indexedEntries: ref([{ name: 'card.ocdocument', isDirectory: false }]),
      openedEditorItems: ref([{
        key: 'session-1',
        label: 'card.ocdocument',
        resourceKind: 'workspace',
        icon: 'file.opencard',
      }]),
      activeSession,
      translate: key => key,
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile: vi.fn(async () => undefined),
    })
    const selectedFiles = result.selectedFileKeys.value
    const selectedEditors = result.openedEditorSelectedKeys.value

    activeSession.value = {
      ...activeSession.value!,
      draftContent: '{"changed":true}',
      isDirty: true,
    }
    await nextTick()

    expect(result.selectedFileKeys.value).toBe(selectedFiles)
    expect(result.openedEditorSelectedKeys.value).toBe(selectedEditors)
  })

  it('opens font files through their dedicated preview session', async () => {
    const path = 'D:/project/assets/fonts/Brand.otf'
    const openPreviewFile = vi.fn(async () => undefined)
    const result = useShellFileTree({
      projectPath: ref('D:/project'),
      indexedEntries: ref([{ name: 'assets/fonts/Brand.otf', isDirectory: false }]),
      openedEditorItems: ref([]),
      activeSession: ref(null),
      translate: key => key,
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile,
    })

    await result.handleFileTreeSelect([path])

    expect(result.selectedFileKeys.value).toEqual([path])
    expect(openPreviewFile).toHaveBeenCalledWith(path)
  })

  it('separates registered font files from unregistered files in the project tree', () => {
    const projectPath = 'D:/project'
    const result = useShellFileTree({
      projectPath: ref(projectPath),
      indexedEntries: ref([
        { name: 'assets/fonts/Brand.otf', isDirectory: false },
        { name: 'assets/fonts/Other.otf', isDirectory: false },
      ]),
      openedEditorItems: ref([]),
      activeSession: ref(null),
      registeredFontSources: ref(['assets/fonts/Brand.otf']),
      translate: key => key,
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile: vi.fn(async () => undefined),
    })

    expect(result.projectTreeData.value.items.get(`${projectPath}/assets/fonts/Brand.otf`)).toMatchObject({
      icon: 'file.font',
      iconTone: 'active',
    })
    expect(result.projectTreeData.value.items.get(`${projectPath}/assets/fonts/Other.otf`)).toMatchObject({
      icon: 'file.font',
      iconTone: 'muted',
    })
  })
})
