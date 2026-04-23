import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CardDesignEditor from './CardDesignEditor.vue'

const mocked = vi.hoisted(() => ({
  editorRootRef: { value: null as HTMLElement | null },
  rightPanelRef: { value: null as HTMLElement | null },
  editorStyle: { value: {} as Record<string, string> },
  resizeState: { value: null as string | null },
  rawContent: { value: '' },
  cardDoc: { value: null as unknown },
  parentLookup: { value: new Map<string, unknown>() },
  canUndo: { value: false },
  canRedo: { value: false },
  selectedCard: { value: null as unknown },
  instanceTree: { value: [] as unknown[] },
  blockTree: { value: [] as unknown[] },
  selectedNode: { value: null as unknown },
  selectedBlock: { value: null as unknown },
  startRightPanelResize: vi.fn(),
  startTreePanelResize: vi.fn(),
  mountPanelResizeListeners: vi.fn(),
  unmountPanelResizeListeners: vi.fn(),
  markDocumentChanged: vi.fn(),
  flushPendingChanges: vi.fn(),
  undoDocumentState: vi.fn(),
  redoDocumentState: vi.fn(),
  loadRawDoc: vi.fn(),
  saveDocumentFile: vi.fn(),
  disposeDocumentState: vi.fn(),
  onInstanceTreeSelect: vi.fn(),
  handleInstanceTreeAction: vi.fn(),
  handleInstanceTreeRename: vi.fn(),
  getInstanceTreeAllowedDropPositions: vi.fn(() => ['inside']),
  canDropInstanceTreeNode: vi.fn(() => true),
  handleInstanceTreeDrop: vi.fn(),
  onTreeSelect: vi.fn(),
  handleViewportBlockClick: vi.fn(),
  clearSelection: vi.fn(),
  handleTreeAction: vi.fn(),
  handleTreeRename: vi.fn(),
  canDropTreeNode: vi.fn(() => true),
  handleTreeDrop: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../../composables/useCdePanelResize', () => ({
  useCdePanelResize: () => ({
    editorRootRef: mocked.editorRootRef,
    rightPanelRef: mocked.rightPanelRef,
    editorStyle: mocked.editorStyle,
    resizeState: mocked.resizeState,
    startRightPanelResize: mocked.startRightPanelResize,
    startTreePanelResize: mocked.startTreePanelResize,
    mountPanelResizeListeners: mocked.mountPanelResizeListeners,
    unmountPanelResizeListeners: mocked.unmountPanelResizeListeners,
  }),
}))

vi.mock('../../composables/useCdeDocumentState', () => ({
  useCdeDocumentState: () => ({
    rawContent: mocked.rawContent,
    cardDoc: mocked.cardDoc,
    parentLookup: mocked.parentLookup,
    canUndo: mocked.canUndo,
    canRedo: mocked.canRedo,
    markDocumentChanged: mocked.markDocumentChanged,
    flushPendingChanges: mocked.flushPendingChanges,
    undo: mocked.undoDocumentState,
    redo: mocked.redoDocumentState,
    loadRawDoc: mocked.loadRawDoc,
    saveFile: mocked.saveDocumentFile,
    dispose: mocked.disposeDocumentState,
  }),
}))

vi.mock('../../composables/useCdeInstanceOps', () => ({
  useCdeInstanceOps: () => ({
    selectedCard: mocked.selectedCard,
    instanceTree: mocked.instanceTree,
    onInstanceTreeSelect: mocked.onInstanceTreeSelect,
    handleInstanceTreeAction: mocked.handleInstanceTreeAction,
    handleInstanceTreeRename: mocked.handleInstanceTreeRename,
    getInstanceTreeAllowedDropPositions: mocked.getInstanceTreeAllowedDropPositions,
    canDropInstanceTreeNode: mocked.canDropInstanceTreeNode,
    handleInstanceTreeDrop: mocked.handleInstanceTreeDrop,
  }),
}))

vi.mock('../../composables/useCdeTreeOps', () => ({
  useCdeTreeOps: () => ({
    blockTree: mocked.blockTree,
    selectedNode: mocked.selectedNode,
    selectedBlock: mocked.selectedBlock,
    onTreeSelect: mocked.onTreeSelect,
    handleViewportBlockClick: mocked.handleViewportBlockClick,
    clearSelection: mocked.clearSelection,
    handleTreeAction: mocked.handleTreeAction,
    handleTreeRename: mocked.handleTreeRename,
    canDropTreeNode: mocked.canDropTreeNode,
    handleTreeDrop: mocked.handleTreeDrop,
  }),
}))

describe('CardDesignEditor', () => {
  beforeEach(() => {
    mocked.resizeState.value = null
    mocked.cardDoc.value = null
    mocked.selectedCard.value = null
    mocked.selectedNode.value = null
    mocked.selectedBlock.value = null
    mocked.mountPanelResizeListeners.mockClear()
    mocked.unmountPanelResizeListeners.mockClear()
    mocked.disposeDocumentState.mockClear()
  })

  it('renders absorbed shell primitives and unresolved-document empty hint', () => {
    const wrapper = mount(CardDesignEditor, {
      props: {
        filePath: 'Assets/Cards/Uno.opencard',
        modelValue: '',
      },
      global: {
        stubs: {
          CardRenderer: true,
          CardViewport: true,
          NodeTree: true,
          PropertyEditor: true,
        },
      },
    })

    const overlayLayout = wrapper.get('.oc-axis-layout')
    expect(overlayLayout.classes()).toContain('is-fill')
    expect(overlayLayout.classes()).toContain('is-non-interactive')

    const splitPane = wrapper.get('.oc-split-pane')
    expect(splitPane.classes()).toContain('is-clip')
    expect(splitPane.classes()).toContain('oc-split-pane--radius-lg')
    expect(wrapper.find('.oc-empty-hint').exists()).toBe(true)
  })

  it('mounts and cleans panel listeners with editor lifecycle', () => {
    const wrapper = mount(CardDesignEditor, {
      props: {
        filePath: 'Assets/Cards/Uno.opencard',
        modelValue: '',
      },
      global: {
        stubs: {
          CardRenderer: true,
          CardViewport: true,
          NodeTree: true,
          PropertyEditor: true,
        },
      },
    })

    expect(mocked.mountPanelResizeListeners).toHaveBeenCalledTimes(1)
    wrapper.unmount()
    expect(mocked.disposeDocumentState).toHaveBeenCalledTimes(1)
    expect(mocked.unmountPanelResizeListeners).toHaveBeenCalledTimes(1)
  })
})
