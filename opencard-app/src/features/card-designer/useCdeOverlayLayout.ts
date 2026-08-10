/**
 * Card designer overlay layout controller.
 *
 * Owns only sidebar expansion, split sizing, pointer-resize lifecycle, and
 * persistence of the layout state supplied through the narrow callback.
 */
import { computed, onUnmounted, ref, watch, type CSSProperties, type Ref } from 'vue'
import type { CardDesignerLayoutState } from '../editor-runtime/model/editorUiState'

type OverlaySide = 'left' | 'right'
type OverlayPanel = 'instance' | 'preview' | 'structure' | 'property'
type ResizeTarget = 'left-width' | 'right-width' | 'left-stack' | 'right-stack'
type SidebarPairState = {
  topExpanded: boolean
  bottomExpanded: boolean
  topHeight: number | null
}
type ResizeState =
  | {
    target: 'left-width' | 'right-width'
    startX: number
    startWidth: number
    moved: boolean
  }
  | {
    target: 'left-stack' | 'right-stack'
    startY: number
    startTopHeight: number
    availableHeight: number
  }

type UseCdeOverlayLayoutOptions = {
  layout: Readonly<Ref<CardDesignerLayoutState | undefined>>
  rootElement: Readonly<Ref<HTMLElement | null>>
  commitLayout: (layout: CardDesignerLayoutState) => void
}

const SIDE_PANEL_MIN_WIDTH = 280
const SIDE_PANEL_MAX_WIDTH = 420
const SIDE_PANEL_COLLAPSED_WIDTH = 0
const SIDE_PANEL_EXPAND_DRAG_RATIO = 0.1
const SIDE_PANEL_COLLAPSE_DRAG_RATIO = 0.25
const SIDEBAR_TOP_MIN_HEIGHT = 160
const SIDEBAR_BOTTOM_MIN_HEIGHT = 220
const RESIZEBAR_SIZE = 8

export function useCdeOverlayLayout(options: UseCdeOverlayLayoutOptions) {
  const leftSidebarRef = ref<HTMLElement | null>(null)
  const rightSidebarRef = ref<HTMLElement | null>(null)
  const isInstancePanelExpanded = ref(true)
  const isPreviewPanelExpanded = ref(true)
  const isStructureTreePanelExpanded = ref(true)
  const isPropertyPanelExpanded = ref(true)
  const leftPanelWidth = ref(320)
  const rightPanelWidth = ref(320)
  const leftSidebarTopHeight = ref<number | null>(null)
  const rightSidebarTopHeight = ref<number | null>(null)
  const activeResizeTarget = ref<ResizeTarget | null>(null)
  const resizeState = ref<ResizeState | null>(null)
  let sidebarWidthSnapFrame: number | null = null
  let previousBodyCursor = ''
  let previousBodyUserSelect = ''
  let isBodyInteractionLocked = false

  const currentLeftPanelWidth = computed(() => Math.max(SIDE_PANEL_MIN_WIDTH, leftPanelWidth.value))
  const currentRightPanelWidth = computed(() => Math.max(SIDE_PANEL_MIN_WIDTH, rightPanelWidth.value))
  const leftSidebarEdgeInset = computed(() => resolveSidebarEdgeInset(leftPanelWidth.value))
  const rightSidebarEdgeInset = computed(() => resolveSidebarEdgeInset(rightPanelWidth.value))
  const isSidebarWidthResizing = computed(() => (
    activeResizeTarget.value === 'left-width' || activeResizeTarget.value === 'right-width'
  ))
  const canResizeLeftSidebar = computed(() => (
    isInstancePanelExpanded.value && isPreviewPanelExpanded.value
  ))
  const canResizeRightSidebar = computed(() => (
    isStructureTreePanelExpanded.value && isPropertyPanelExpanded.value
  ))
  const isLeftSidebarCollapsed = computed(() => (
    !isInstancePanelExpanded.value && !isPreviewPanelExpanded.value
  ))
  const isRightSidebarCollapsed = computed(() => (
    !isStructureTreePanelExpanded.value && !isPropertyPanelExpanded.value
  ))
  const leftSidebarRows = computed(() => formatSidebarRows({
    topExpanded: isInstancePanelExpanded.value,
    bottomExpanded: isPreviewPanelExpanded.value,
    topHeight: leftSidebarTopHeight.value,
  }))
  const rightSidebarRows = computed(() => formatSidebarRows({
    topExpanded: isStructureTreePanelExpanded.value,
    bottomExpanded: isPropertyPanelExpanded.value,
    topHeight: rightSidebarTopHeight.value,
  }))
  const leftSidebarAlignContent = computed(() => (isLeftSidebarCollapsed.value ? 'start' : 'stretch'))
  const rightSidebarAlignContent = computed(() => (isRightSidebarCollapsed.value ? 'start' : 'stretch'))
  const leftSidebarAlignSelf = computed(() => (isLeftSidebarCollapsed.value ? 'start' : 'stretch'))
  const rightSidebarAlignSelf = computed(() => (isRightSidebarCollapsed.value ? 'start' : 'stretch'))
  const editorShellStyle = computed<CSSProperties>(() => ({
    display: 'flex',
    flex: '1 1 auto',
    width: '100%',
    height: '100%',
    minWidth: '0',
    minHeight: '0',
    position: 'relative',
    overflow: 'hidden',
    '--card-editor-overlay-inset-x': '24px',
    '--card-editor-overlay-inset-y': '20px',
    '--card-editor-left-panel-width-expanded': '272px',
    '--card-editor-left-panel-width-collapsed': '32px',
    '--card-editor-left-panel-width': `${currentLeftPanelWidth.value}px`,
    '--card-editor-right-panel-width': `${currentRightPanelWidth.value}px`,
    '--card-editor-left-sidebar-visible-width': `${leftPanelWidth.value}px`,
    '--card-editor-right-sidebar-visible-width': `${rightPanelWidth.value}px`,
    '--card-editor-left-sidebar-edge-inset': leftSidebarEdgeInset.value,
    '--card-editor-right-sidebar-edge-inset': rightSidebarEdgeInset.value,
    '--card-editor-left-sidebar-rows': leftSidebarRows.value,
    '--card-editor-right-sidebar-rows': rightSidebarRows.value,
    '--card-editor-left-sidebar-align-content': leftSidebarAlignContent.value,
    '--card-editor-right-sidebar-align-content': rightSidebarAlignContent.value,
    '--card-editor-left-sidebar-align-self': leftSidebarAlignSelf.value,
    '--card-editor-right-sidebar-align-self': rightSidebarAlignSelf.value,
  }))

  function createLayoutState(): CardDesignerLayoutState {
    return {
      panels: {
        instanceExpanded: isInstancePanelExpanded.value,
        previewExpanded: isPreviewPanelExpanded.value,
        structureExpanded: isStructureTreePanelExpanded.value,
        propertyExpanded: isPropertyPanelExpanded.value,
      },
      leftTopHeight: leftSidebarTopHeight.value,
      rightTopHeight: rightSidebarTopHeight.value,
    }
  }

  function commitLayoutState(): void {
    options.commitLayout(createLayoutState())
  }

  function writeResizeStyles(): void {
    const root = options.rootElement.value
    if (!root) return

    root.style.setProperty('--card-editor-left-panel-width', `${currentLeftPanelWidth.value}px`)
    root.style.setProperty('--card-editor-right-panel-width', `${currentRightPanelWidth.value}px`)
    root.style.setProperty('--card-editor-left-sidebar-visible-width', `${leftPanelWidth.value}px`)
    root.style.setProperty('--card-editor-right-sidebar-visible-width', `${rightPanelWidth.value}px`)
    root.style.setProperty('--card-editor-left-sidebar-edge-inset', leftSidebarEdgeInset.value)
    root.style.setProperty('--card-editor-right-sidebar-edge-inset', rightSidebarEdgeInset.value)
    root.style.setProperty('--card-editor-left-sidebar-rows', leftSidebarRows.value)
    root.style.setProperty('--card-editor-right-sidebar-rows', rightSidebarRows.value)
    root.style.setProperty('--card-editor-left-sidebar-align-content', leftSidebarAlignContent.value)
    root.style.setProperty('--card-editor-right-sidebar-align-content', rightSidebarAlignContent.value)
    root.style.setProperty('--card-editor-left-sidebar-align-self', leftSidebarAlignSelf.value)
    root.style.setProperty('--card-editor-right-sidebar-align-self', rightSidebarAlignSelf.value)
  }

  function applyResizeBodyState(cursor: 'col-resize' | 'row-resize'): void {
    if (!isBodyInteractionLocked) {
      previousBodyCursor = document.body.style.cursor
      previousBodyUserSelect = document.body.style.userSelect
      isBodyInteractionLocked = true
    }
    document.body.style.cursor = cursor
    document.body.style.userSelect = 'none'
  }

  function clearResizeBodyState(): void {
    if (!isBodyInteractionLocked) return
    document.body.style.cursor = previousBodyCursor
    document.body.style.userSelect = previousBodyUserSelect
    previousBodyCursor = ''
    previousBodyUserSelect = ''
    isBodyInteractionLocked = false
  }

  function startOverlayResize(side: OverlaySide, event: MouseEvent): void {
    if (event.button !== 0) return
    cancelPendingWidthSnap()
    finishResize()
    const target: ResizeTarget = side === 'left' ? 'left-width' : 'right-width'
    resizeState.value = {
      target,
      startX: event.clientX,
      startWidth: side === 'left' ? leftPanelWidth.value : rightPanelWidth.value,
      moved: false,
    }
    activeResizeTarget.value = target
    applyResizeBodyState('col-resize')
    document.addEventListener('mousemove', handleResizeMove, true)
    document.addEventListener('mouseup', finishResize, true)
    event.stopPropagation()
    event.preventDefault()
  }

  function startSidebarResize(side: OverlaySide, event: MouseEvent): void {
    if (event.button !== 0) return
    if (side === 'left' && !canResizeLeftSidebar.value) return
    if (side === 'right' && !canResizeRightSidebar.value) return

    const sidebar = side === 'left' ? leftSidebarRef.value : rightSidebarRef.value
    const topPanel = sidebar?.querySelector('.card-design-editor__sidebar-panel')
    if (!(sidebar instanceof HTMLElement) || !(topPanel instanceof HTMLElement)) return

    finishResize()
    const target: ResizeTarget = side === 'left' ? 'left-stack' : 'right-stack'
    resizeState.value = {
      target,
      startY: event.clientY,
      startTopHeight: topPanel.getBoundingClientRect().height,
      availableHeight: sidebar.getBoundingClientRect().height - RESIZEBAR_SIZE,
    }
    activeResizeTarget.value = target
    applyResizeBodyState('row-resize')
    document.addEventListener('mousemove', handleResizeMove, true)
    document.addEventListener('mouseup', finishResize, true)
    event.stopPropagation()
    event.preventDefault()
  }

  function handleResizeMove(event: MouseEvent): void {
    const state = resizeState.value
    if (!state) return

    if (state.target === 'left-width') {
      if (Math.abs(event.clientX - state.startX) > 2) state.moved = true
      leftPanelWidth.value = clamp(
        state.startWidth + event.clientX - state.startX,
        SIDE_PANEL_COLLAPSED_WIDTH,
        SIDE_PANEL_MAX_WIDTH,
      )
      writeResizeStyles()
      event.preventDefault()
      return
    }

    if (state.target === 'right-width') {
      if (Math.abs(event.clientX - state.startX) > 2) state.moved = true
      rightPanelWidth.value = clamp(
        state.startWidth - (event.clientX - state.startX),
        SIDE_PANEL_COLLAPSED_WIDTH,
        SIDE_PANEL_MAX_WIDTH,
      )
      writeResizeStyles()
      event.preventDefault()
      return
    }

    if (state.target !== 'left-stack' && state.target !== 'right-stack') return
    const nextTopHeight = clamp(
      state.startTopHeight + event.clientY - state.startY,
      SIDEBAR_TOP_MIN_HEIGHT,
      Math.max(SIDEBAR_TOP_MIN_HEIGHT, state.availableHeight - SIDEBAR_BOTTOM_MIN_HEIGHT),
    )
    if (state.target === 'left-stack') leftSidebarTopHeight.value = nextTopHeight
    else rightSidebarTopHeight.value = nextTopHeight
    writeResizeStyles()
    event.preventDefault()
  }

  function finishResize(): void {
    const state = resizeState.value
    const shouldCommit = state !== null
    const widthSnap = state?.target === 'left-width'
      ? {
          side: 'left' as const,
          value: state.moved
            ? snapSidebarVisibleWidth(leftPanelWidth.value, state.startWidth)
            : resolveSidebarMinimumToggle(state.startWidth),
        }
      : state?.target === 'right-width'
        ? {
            side: 'right' as const,
            value: state.moved
              ? snapSidebarVisibleWidth(rightPanelWidth.value, state.startWidth)
              : resolveSidebarMinimumToggle(state.startWidth),
          }
        : null
    resizeState.value = null
    activeResizeTarget.value = null
    document.removeEventListener('mousemove', handleResizeMove, true)
    document.removeEventListener('mouseup', finishResize, true)
    clearResizeBodyState()
    if (shouldCommit) commitLayoutState()
    if (widthSnap) scheduleSidebarWidthSnap(widthSnap.side, widthSnap.value)
  }

  function togglePanel(panel: OverlayPanel): void {
    const target = panel === 'instance'
      ? isInstancePanelExpanded
      : panel === 'preview'
        ? isPreviewPanelExpanded
        : panel === 'structure'
          ? isStructureTreePanelExpanded
          : isPropertyPanelExpanded
    target.value = !target.value
    finishResize()
    commitLayoutState()
  }

  function ensurePanelsExpanded(panels: readonly OverlayPanel[]): boolean {
    let changed = false
    for (const panel of panels) {
      const target = panel === 'instance'
        ? isInstancePanelExpanded
        : panel === 'preview'
          ? isPreviewPanelExpanded
          : panel === 'structure'
            ? isStructureTreePanelExpanded
            : isPropertyPanelExpanded
      if (!target.value) {
        target.value = true
        changed = true
      }
    }
    if (changed) commitLayoutState()
    return changed
  }

  function toggleSidebarMinimumWidth(side: OverlaySide): void {
    const current = side === 'left' ? leftPanelWidth.value : rightPanelWidth.value
    scheduleSidebarWidthSnap(side, resolveSidebarMinimumToggle(current))
  }

  function scheduleSidebarWidthSnap(side: OverlaySide, value: number): void {
    const current = side === 'left' ? leftPanelWidth.value : rightPanelWidth.value
    if (Math.abs(current - value) < 0.01) return
    sidebarWidthSnapFrame = requestAnimationFrame(() => {
      sidebarWidthSnapFrame = null
      if (side === 'left') leftPanelWidth.value = value
      else rightPanelWidth.value = value
      writeResizeStyles()
    })
  }

  function cancelPendingWidthSnap(): void {
    if (sidebarWidthSnapFrame === null) return
    cancelAnimationFrame(sidebarWidthSnapFrame)
    sidebarWidthSnapFrame = null
  }

  watch(
    options.layout,
    (layout) => {
      const panels = layout?.panels
      isInstancePanelExpanded.value = panels?.instanceExpanded ?? true
      isPreviewPanelExpanded.value = panels?.previewExpanded ?? true
      isStructureTreePanelExpanded.value = panels?.structureExpanded ?? true
      isPropertyPanelExpanded.value = panels?.propertyExpanded ?? true
      leftSidebarTopHeight.value = normalizeStoredTopHeight(layout?.leftTopHeight)
      rightSidebarTopHeight.value = normalizeStoredTopHeight(layout?.rightTopHeight)
    },
    { immediate: true, deep: true },
  )

  onUnmounted(() => {
    finishResize()
    cancelPendingWidthSnap()
  })

  return {
    activeResizeTarget,
    canResizeLeftSidebar,
    canResizeRightSidebar,
    editorShellStyle,
    ensurePanelsExpanded,
    isInstancePanelExpanded,
    isLeftSidebarCollapsed,
    isPreviewPanelExpanded,
    isPropertyPanelExpanded,
    isRightSidebarCollapsed,
    isSidebarWidthResizing,
    isStructureTreePanelExpanded,
    leftSidebarRef,
    rightSidebarRef,
    startOverlayResize,
    startSidebarResize,
    togglePanel,
    toggleSidebarMinimumWidth,
  }
}

function normalizeStoredTopHeight(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(SIDEBAR_TOP_MIN_HEIGHT, value)
    : null
}

function formatSidebarRows(state: SidebarPairState): string {
  if (state.topExpanded && !state.bottomExpanded) return 'minmax(0, 1fr) auto'
  if (!state.topExpanded && state.bottomExpanded) return 'auto minmax(0, 1fr)'
  if (!state.topExpanded && !state.bottomExpanded) return 'auto auto'

  const topRow = state.topHeight === null
    ? `minmax(${SIDEBAR_TOP_MIN_HEIGHT}px, 1fr)`
    : `${state.topHeight}px`
  return `${topRow} ${RESIZEBAR_SIZE}px minmax(${SIDEBAR_BOTTOM_MIN_HEIGHT}px, 1fr)`
}

function resolveSidebarEdgeInset(visibleWidth: number): string {
  const progress = Math.min(1, Math.max(0, visibleWidth) / SIDE_PANEL_MIN_WIDTH)
  return `calc(var(--oc-floating-surface-gap) * ${Math.round(progress * 100) / 100})`
}

function snapSidebarVisibleWidth(value: number, startWidth: number): number {
  const expandThreshold = SIDE_PANEL_MIN_WIDTH * SIDE_PANEL_EXPAND_DRAG_RATIO
  const collapseThreshold = SIDE_PANEL_MIN_WIDTH * (1 - SIDE_PANEL_COLLAPSE_DRAG_RATIO)
  if (startWidth <= SIDE_PANEL_COLLAPSED_WIDTH) {
    return value > expandThreshold
      ? clamp(value, SIDE_PANEL_MIN_WIDTH, SIDE_PANEL_MAX_WIDTH)
      : SIDE_PANEL_COLLAPSED_WIDTH
  }
  return value < collapseThreshold
    ? SIDE_PANEL_COLLAPSED_WIDTH
    : clamp(value, SIDE_PANEL_MIN_WIDTH, SIDE_PANEL_MAX_WIDTH)
}

function resolveSidebarMinimumToggle(value: number): number {
  if (Math.abs(value - SIDE_PANEL_COLLAPSED_WIDTH) < 0.01) return SIDE_PANEL_MIN_WIDTH
  if (Math.abs(value - SIDE_PANEL_MIN_WIDTH) < 0.01) return SIDE_PANEL_COLLAPSED_WIDTH
  return value
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
