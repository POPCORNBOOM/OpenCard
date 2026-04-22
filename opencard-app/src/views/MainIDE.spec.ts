import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const activateSessionSpy = vi.fn()
const closeSessionSpy = vi.fn()

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../features/workspace/store/projectStore', () => ({
  useProjectStore: () => ({
    projectPath: ref(''),
    indexedEntries: ref([]),
    isWatching: ref(false),
    openProject: vi.fn(),
    isDirectoryExpanded: vi.fn(() => false),
    readDirectoryEntries: vi.fn(),
    getFileTreeAllowedDropPositions: vi.fn(() => ['inside']),
    canMoveEntryByDrop: vi.fn(() => true),
    moveEntryByDrop: vi.fn(),
    renameEntry: vi.fn(),
    setDirectoryExpanded: vi.fn(),
  }),
}))

vi.mock('../features/workspace/store/editorSessionStore', () => ({
  useEditorSessionStore: () => ({
    sessions: ref([
      {
        id: 'session-1',
        name: 'Uno.opencard',
        isDirty: false,
      },
      {
        id: 'session-2',
        name: 'Blue.opencard',
        isDirty: true,
      },
    ]),
    activeSessionId: ref('session-1'),
    activeSession: ref(null),
    openedFileNodes: ref([]),
    openFile: vi.fn(),
    openPreviewFile: vi.fn(),
    activateSession: activateSessionSpy,
    activatePath: vi.fn(),
    updateDraftContent: vi.fn(),
    closeSession: closeSessionSpy,
    saveActiveSession: vi.fn(),
    remapSessionPaths: vi.fn(),
  }),
}))

vi.mock('../features/ide-shell/composables/useIdeExport', () => ({
  useIdeExport: () => ({
    canExportActiveCard: ref(false),
    showExportRenderer: ref(false),
    exportCardDoc: ref(null),
    exportActiveCard2x: vi.fn(),
    exportAllCardViews: vi.fn(),
  }),
}))

vi.mock('../features/ide-shell/composables/useIdeFileTree', () => ({
  useIdeFileTree: () => ({
    fileTree: ref([]),
    selectedFileKeys: ref([]),
    openedEditorSelectedKeys: ref([]),
    handleOpenedEditorsSelect: vi.fn(),
    handleFileTreeSelect: vi.fn(),
    findTreeNodeByKey: vi.fn(() => null),
  }),
}))

vi.mock('../features/editor-runtime/registry/editorRegistry', () => ({
  editorRegistry: {
    getEditor: vi.fn(() => ({
      id: 'monaco',
      component: null,
    })),
  },
}))

vi.mock('../features/workspace/model/fileTypes', () => ({
  resolveFileType: vi.fn(() => ({
    language: 'plaintext',
    previewable: false,
    editorId: 'monaco',
  })),
}))

vi.mock('../entities/card/model', () => ({
  prepareDocumentForRender: vi.fn((document) => document),
}))

vi.mock('../components/editors/MonacoEditor.vue', () => ({
  default: {
    name: 'MonacoEditor',
    template: '<div class="monaco-editor-stub" />',
  },
}))

import MainIDE from './MainIDE.vue'

describe('MainIDE', () => {
  beforeEach(() => {
    activateSessionSpy.mockClear()
    closeSessionSpy.mockClear()
  })

  it('keeps tab activation scoped to the tab row instead of the close button', async () => {
    const wrapper = mount(MainIDE, {
      global: {
        stubs: {
          AppIcon: true,
          NodeTree: true,
          FloatingMenuHost: true,
          CardRenderer: true,
          MonacoEditor: true,
          OcPanelSection: {
            template: '<section><slot name="title" /><slot /></section>',
          },
        },
      },
    })

    const closeButton = wrapper.get('.oc-tab[aria-selected="true"] .oc-tab__close')
    await closeButton.trigger('keydown', { key: 'Enter' })
    expect(activateSessionSpy).not.toHaveBeenCalled()
  })

  it('routes arrow-key navigation through the new tab bar', async () => {
    const wrapper = mount(MainIDE, {
      global: {
        stubs: {
          AppIcon: true,
          NodeTree: true,
          FloatingMenuHost: true,
          CardRenderer: true,
          MonacoEditor: true,
          OcPanelSection: {
            template: '<section><slot name="title" /><slot /></section>',
          },
        },
      },
    })

    const activeTab = wrapper.get('.oc-tab[aria-selected="true"]')
    await activeTab.trigger('keydown', { key: 'ArrowRight' })
    expect(activateSessionSpy).toHaveBeenCalledWith('session-2')
  })
})
