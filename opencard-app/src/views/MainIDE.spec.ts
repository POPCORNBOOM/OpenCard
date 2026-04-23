import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => {
  const monacoStub = {
    name: 'MonacoEditor',
    template: '<div class="monaco-editor-stub" />',
  }
  const cardDesignerStub = {
    name: 'CardDesignEditor',
    template: '<div class="card-design-editor-stub" />',
  }
  const imagePreviewStub = {
    name: 'ImagePreviewEditor',
    template: '<div class="image-preview-editor-stub" />',
  }

  return {
    activateSessionSpy: vi.fn(),
    closeSessionSpy: vi.fn(),
    openProjectSpy: vi.fn(),
    monacoStub,
    cardDesignerStub,
    imagePreviewStub,
    editorRegistryGetEditorSpy: vi.fn((editorId: string) => {
      const registry = {
        monaco: { id: 'monaco', component: monacoStub },
        'card-designer': { id: 'card-designer', component: cardDesignerStub },
        'image-preview': { id: 'image-preview', component: imagePreviewStub },
      }

      return registry[editorId as keyof typeof registry]
    }),
    resolveFileTypeMock: vi.fn((path: string) => {
      if (path.endsWith('.opencard')) {
        return { language: 'json', previewable: false, editorId: 'card-designer' }
      }

      if (path.endsWith('.png')) {
        return { language: 'image', previewable: true, editorId: 'image-preview' }
      }

      return { language: 'plaintext', previewable: false, editorId: 'monaco' }
    }),
  }
})

const sessionsRef = ref([
  {
    id: 'session-1',
    name: 'Uno.opencard',
    path: 'Assets/Cards/Uno.opencard',
    draftContent: '{"cards":[]}',
    editorId: 'monaco',
    isDirty: false,
  },
  {
    id: 'session-2',
    name: 'Blue.opencard',
    path: 'Assets/Cards/Blue.opencard',
    draftContent: '{"cards":[]}',
    editorId: 'monaco',
    isDirty: true,
  },
])
const activeSessionIdRef = ref('session-1')
const activeSessionRef = ref<(typeof sessionsRef.value)[number] | null>(null)
const projectPathRef = ref('')
const isWatchingRef = ref(false)
const semanticIconSizes = new Set(['sm', 'md', 'lg'])
const semanticIconTones = new Set([
  'default',
  'muted',
  'primary',
  'success',
  'warning',
  'danger',
  'opencard',
  'json',
  'markdown',
  'typescript',
  'javascript',
  'vue',
  'html',
  'css',
  'image',
  'package',
  'config',
  'folder-default',
  'folder-open',
  'folder-src',
  'folder-assets',
  'folder-components',
  'folder-views',
  'folder-locales',
  'folder-core',
])
const appIconStub = {
  name: 'AppIcon',
  props: {
    name: {
      type: [String, Object],
      default: 'file.default',
    },
    size: {
      type: String,
      default: 'md',
      validator: (value: unknown) => typeof value === 'string' && semanticIconSizes.has(value),
    },
    tone: {
      type: String,
      default: 'default',
      validator: (value: unknown) => typeof value === 'string' && semanticIconTones.has(value),
    },
  },
  template: '<span class="app-icon-stub" />',
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../features/workspace/store/projectStore', () => ({
  useProjectStore: () => ({
    projectPath: projectPathRef,
    indexedEntries: ref([]),
    isWatching: isWatchingRef,
    openProject: mocked.openProjectSpy,
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
    sessions: sessionsRef,
    activeSessionId: activeSessionIdRef,
    activeSession: activeSessionRef,
    openedFileNodes: ref([]),
    openFile: vi.fn(),
    openPreviewFile: vi.fn(),
    activateSession: mocked.activateSessionSpy,
    activatePath: vi.fn(),
    updateDraftContent: vi.fn(),
    closeSession: mocked.closeSessionSpy,
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
    getEditor: mocked.editorRegistryGetEditorSpy,
  },
}))

vi.mock('../features/workspace/model/fileTypes', () => ({
  resolveFileType: mocked.resolveFileTypeMock,
}))

vi.mock('../entities/card/model', () => ({
  prepareDocumentForRender: vi.fn((document) => document),
}))

vi.mock('../components/editors/MonacoEditor.vue', () => ({
  default: mocked.monacoStub,
}))

import MainIDE from './MainIDE.vue'

describe('MainIDE', () => {
  beforeEach(() => {
    mocked.activateSessionSpy.mockClear()
    mocked.closeSessionSpy.mockClear()
    mocked.openProjectSpy.mockClear()
    mocked.editorRegistryGetEditorSpy.mockClear()
    mocked.resolveFileTypeMock.mockClear()
    sessionsRef.value = [
      {
        id: 'session-1',
        name: 'Uno.opencard',
        path: 'Assets/Cards/Uno.opencard',
        draftContent: '{"cards":[]}',
        editorId: 'monaco',
        isDirty: false,
      },
      {
        id: 'session-2',
        name: 'Blue.opencard',
        path: 'Assets/Cards/Blue.opencard',
        draftContent: '{"cards":[]}',
        editorId: 'monaco',
        isDirty: true,
      },
    ]
    activeSessionIdRef.value = 'session-1'
    activeSessionRef.value = null
    projectPathRef.value = ''
    isWatchingRef.value = false
  })

  it('keeps tab activation scoped to the tab row instead of the close button', async () => {
    const wrapper = mount(MainIDE, {
      global: {
        stubs: {
          AppIcon: appIconStub,
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
    expect(mocked.activateSessionSpy).not.toHaveBeenCalled()
  })

  it('routes arrow-key navigation through the new tab bar', async () => {
    const wrapper = mount(MainIDE, {
      global: {
        stubs: {
          AppIcon: appIconStub,
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
    expect(mocked.activateSessionSpy).toHaveBeenCalledWith('session-2')
  })

  it('renders the upgraded welcome shell and actions when no editor is active', async () => {
    const wrapper = mount(MainIDE, {
      global: {
        stubs: {
          AppIcon: appIconStub,
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

    expect(wrapper.find('.welcome-screen').exists()).toBe(true)
    expect(wrapper.text()).toContain('app.welcome.title')

    const openProjectButton = wrapper.findAll('button')
      .find((button) => button.text().includes('sidebar.openProject'))
    expect(openProjectButton).toBeDefined()
    await openProjectButton!.trigger('click')
    expect(mocked.openProjectSpy).toHaveBeenCalled()
  })

  it('renders status shell with project and language chips when workspace is active', () => {
    projectPathRef.value = 'D:/Projects/OpenCard/demo'
    isWatchingRef.value = true
    activeSessionRef.value = {
      id: 'session-card',
      name: 'Uno.opencard',
      path: 'Assets/Cards/Uno.opencard',
      draftContent: '{"cards":[]}',
      editorId: 'card-designer',
      isDirty: false,
    }

    const wrapper = mount(MainIDE, {
      global: {
        stubs: {
          AppIcon: appIconStub,
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

    expect(wrapper.find('footer.oc-bar--kind-status').exists()).toBe(true)
    expect(wrapper.text()).toContain('D:/Projects/OpenCard/demo')
    expect(wrapper.text()).toContain('status.watching')
    expect(wrapper.text()).toContain('json')
  })

  it('mounts the registered editor shells for monaco, card designer, and image preview', async () => {
    const wrapper = mount(MainIDE, {
      global: {
        stubs: {
          AppIcon: appIconStub,
          NodeTree: true,
          FloatingMenuHost: true,
          CardRenderer: true,
          OcPanelSection: {
            template: '<section><slot name="title" /><slot /></section>',
          },
        },
      },
    })

    activeSessionRef.value = {
      id: 'session-monaco',
      name: 'README.md',
      path: 'README.md',
      draftContent: '# OpenCard',
      editorId: 'monaco',
      isDirty: false,
    }
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.monaco-editor-stub').exists()).toBe(true)

    activeSessionRef.value = {
      id: 'session-card',
      name: 'Uno.opencard',
      path: 'Assets/Cards/Uno.opencard',
      draftContent: '{"cards":[]}',
      editorId: 'card-designer',
      isDirty: false,
    }
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.card-design-editor-stub').exists()).toBe(true)

    activeSessionRef.value = {
      id: 'session-image',
      name: 'preview.png',
      path: 'Assets/Images/preview.png',
      draftContent: '',
      editorId: 'image-preview',
      isDirty: false,
    }
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.image-preview-editor-stub').exists()).toBe(true)
  })
})
