import { nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { EditorSession } from '../../workspace/store/editorSessionStore'
import {
  OPENED_EDITOR_CLOSE_ACTION_KEY,
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
      packageManifests: ref(new Map()),
      openedEditorItems,
      activeSession: ref(null),
      translate: key => key,
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile: vi.fn(async () => undefined),
      ensureProjectManagementStructure: vi.fn(async () => undefined),
    })

    expect(openedEditorTreeData.value.items.get('session-1')?.actions)
      .toEqual([OPENED_EDITOR_CLOSE_ACTION_KEY])
  })

  it('projects project entries as draggable, renamable action hosts', () => {
    const { projectTreeData } = useShellFileTree({
      projectPath: ref('D:/project'),
      indexedEntries: ref([{ name: 'cards/main.ocdocument', isDirectory: false }]),
      packageManifests: ref(new Map()),
      openedEditorItems: ref([]),
      activeSession: ref(null),
      translate: key => key,
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile: vi.fn(async () => undefined),
      ensureProjectManagementStructure: vi.fn(async () => undefined),
    })

    expect(projectTreeData.value.items.get('D:/project/cards/main.ocdocument')).toMatchObject({
      renamable: true,
      draggable: true,
      actions: [projectEntryMoreActionKey('D:/project/cards/main.ocdocument')],
      renameSelection: { start: 0, end: 4 },
    })
  })

  it('hides dot-prefixed files and directories by default', () => {
    const projectPath = 'D:/project'
    const { projectTreeData } = useShellFileTree({
      projectPath: ref(projectPath),
      indexedEntries: ref([
        { name: '.opencard', isDirectory: true },
        { name: '.opencard/.ocproject', isDirectory: false },
        { name: '.opencard/fonts', isDirectory: true },
        { name: '.opencard/fonts/Brand.otf', isDirectory: false },
        { name: '.env', isDirectory: false },
        { name: 'notes.txt', isDirectory: false },
      ]),
      packageManifests: ref(new Map()),
      openedEditorItems: ref([]),
      activeSession: ref(null),
      translate: key => key,
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile: vi.fn(async () => undefined),
      ensureProjectManagementStructure: vi.fn(async () => undefined),
    })

    expect(projectTreeData.value.rootKeys).toEqual([`${projectPath}/notes.txt`])
    expect([...projectTreeData.value.items.keys()]).toEqual([`${projectPath}/notes.txt`])
  })

  it('treats .opencard like an ordinary directory when dot entries are visible', () => {
    const projectPath = 'D:/project'
    const { projectTreeData } = useShellFileTree({
      projectPath: ref(projectPath),
      indexedEntries: ref([
        { name: '.opencard', isDirectory: true },
        { name: '.opencard/.ocproject', isDirectory: false },
        { name: '.env', isDirectory: false },
      ]),
      hideDotFiles: ref(false),
      packageManifests: ref(new Map()),
      openedEditorItems: ref([]),
      activeSession: ref(null),
      translate: key => key,
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile: vi.fn(async () => undefined),
      ensureProjectManagementStructure: vi.fn(async () => undefined),
    })

    expect(projectTreeData.value.rootKeys).toEqual([
      `${projectPath}/.opencard`,
      `${projectPath}/.env`,
    ])
    expect(projectTreeData.value.children.get(`${projectPath}/.opencard`))
      .toEqual([`${projectPath}/.opencard/.ocproject`])
  })

  it('provides fixed localized project-management entries that open managed files', async () => {
    const projectPath = 'D:/project'
    const openPreviewFile = vi.fn(async () => undefined)
    const ensureProjectManagementStructure = vi.fn(async () => undefined)
    const result = useShellFileTree({
      projectPath: ref(projectPath),
      indexedEntries: ref([
        { name: '.opencard/fonts/Brand.otf', isDirectory: false },
        { name: '.opencard/fonts/Unused.otf', isDirectory: false },
        { name: '.opencard/icons/status.png', isDirectory: false },
        { name: '.opencard/icons/unused.png', isDirectory: false },
      ]),
      packageManifests: ref(new Map()),
      openedEditorItems: ref([]),
      activeSession: ref(null),
      translate: key => `translated:${key}`,
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile,
      ensureProjectManagementStructure,
    })

    expect(result.projectManagementTreeData.value.rootKeys).toEqual([
      `${projectPath}/.opencard/project.json`,
      `${projectPath}/.opencard/locale.json`,
      `${projectPath}/.opencard/fonts/fonts.json`,
      `${projectPath}/.opencard/icons/icons.json`,
      `${projectPath}/.opencard/packages/packages.json`,
    ])
    expect(result.projectManagementTreeData.value.items.get(`${projectPath}/.opencard/fonts/fonts.json`)?.label)
      .toBe('translated:fileTypes.opencardFontRegistry')
    expect(result.projectManagementTreeData.value.rootKeys.map(rootKey => (
      result.projectManagementTreeData.value.items.get(rootKey)?.tail
    ))).toEqual([
      '.opencard/project.json',
      '.opencard/locale.json',
      '.opencard/fonts/fonts.json',
      '.opencard/icons/icons.json',
      '.opencard/packages/packages.json',
    ])
    expect(result.projectManagementTreeData.value.items.get(`${projectPath}/.opencard/fonts/fonts.json`))
      .toMatchObject({ icon: 'file.font', iconTone: 'config' })
    expect(result.projectManagementTreeData.value.children.has(`${projectPath}/.opencard/fonts/fonts.json`)).toBe(false)
    expect(result.projectManagementTreeData.value.children.has(`${projectPath}/.opencard/icons/icons.json`)).toBe(false)
    expect(result.projectManagementTreeData.value.items.get(`${projectPath}/.opencard/fonts/fonts.json`)?.actions)
      .toBeUndefined()
    expect(result.projectManagementTreeData.value.items.get(`${projectPath}/.opencard/icons/icons.json`)?.actions)
      .toBeUndefined()
    expect(result.projectManagementExpandedKeys.value).toEqual([])

    const fontRegistryKey = `${projectPath}/.opencard/fonts/fonts.json`
    expect(result.setProjectManagementEntryExpanded(fontRegistryKey, false)).toBe(false)
    expect(result.setProjectManagementEntryExpanded(fontRegistryKey, true)).toBe(false)

    await result.handleProjectManagementSelect([`${projectPath}/.opencard/fonts/fonts.json`])
    expect(ensureProjectManagementStructure).toHaveBeenCalledOnce()
    expect(openPreviewFile).toHaveBeenCalledWith(`${projectPath}/.opencard/fonts/fonts.json`)

  })

  it('does not expose cleanup actions before asset registries finish loading', async () => {
    const projectPath = 'D:/project'
    const result = useShellFileTree({
      projectPath: ref(projectPath),
      indexedEntries: ref([
        { name: '.opencard/fonts/Unused.otf', isDirectory: false },
        { name: '.opencard/icons/unused.png', isDirectory: false },
      ]),
      packageManifests: ref(new Map()),
      openedEditorItems: ref([]),
      activeSession: ref(null),
      translate: key => key,
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile: vi.fn(async () => undefined),
      ensureProjectManagementStructure: vi.fn(async () => undefined),
    })

    expect(result.projectManagementTreeData.value.children.size).toBe(0)
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
      packageManifests: ref(new Map()),
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
      ensureProjectManagementStructure: vi.fn(async () => undefined),
    })
    const selectedFiles = result.selectedProjectEntryKeys.value
    const selectedEditors = result.openedEditorSelectedKeys.value

    activeSession.value = {
      ...activeSession.value!,
      draftContent: '{"changed":true}',
      isDirty: true,
    }
    await nextTick()

    expect(result.selectedProjectEntryKeys.value).toBe(selectedFiles)
    expect(result.openedEditorSelectedKeys.value).toBe(selectedEditors)
  })

  it('opens font files through their dedicated preview session', async () => {
    const path = 'D:/project/assets/fonts/Brand.otf'
    const openPreviewFile = vi.fn(async () => undefined)
    const result = useShellFileTree({
      projectPath: ref('D:/project'),
      indexedEntries: ref([{ name: 'assets/fonts/Brand.otf', isDirectory: false }]),
      packageManifests: ref(new Map()),
      openedEditorItems: ref([]),
      activeSession: ref(null),
      translate: key => key,
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile,
      ensureProjectManagementStructure: vi.fn(async () => undefined),
    })

    await result.handleFileTreeSelect([path])

    expect(result.selectedProjectEntryKeys.value).toEqual([path])
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
      packageManifests: ref(new Map()),
      openedEditorItems: ref([]),
      activeSession: ref(null),
      registeredFontSources: ref(['assets/fonts/Brand.otf']),
      translate: key => key,
      isDirectoryExpanded: vi.fn(() => false),
      activateSession: vi.fn(),
      openPreviewFile: vi.fn(async () => undefined),
      ensureProjectManagementStructure: vi.fn(async () => undefined),
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
