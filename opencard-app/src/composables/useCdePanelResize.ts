import { computed, ref } from 'vue'

type ResizeState = null | 'right-panel' | 'tree-panel'

const MIN_RIGHT_PANEL_WIDTH = 220
const MAX_RIGHT_PANEL_WIDTH = 640
const MIN_CANVAS_WIDTH = 320
const MIN_TREE_PANEL_HEIGHT = 140
const MIN_PROPERTY_PANEL_HEIGHT = 180
const HORIZONTAL_RESIZER_HEIGHT = 6

export function useCdePanelResize() {
  const editorRootRef = ref<HTMLElement | null>(null)
  const rightPanelRef = ref<HTMLElement | null>(null)

  const rightPanelWidth = ref(320)
  const treePanelAbsoluteHeight = ref(320)
  const editorStyle = computed(() => ({
    '--card-editor-right-panel-width': `${rightPanelWidth.value}px`,
    '--card-editor-tree-panel-height': `${treePanelAbsoluteHeight.value}px`,
    '--card-editor-horizontal-resizer-height': `${HORIZONTAL_RESIZER_HEIGHT}px`,
    '--card-editor-min-property-panel-height': `${MIN_PROPERTY_PANEL_HEIGHT}px`,
  }))

  const resizeState = ref<ResizeState>(null)
  const resizeSnapshot = ref<{
    clientX: number
    clientY: number
    rightPanelWidth: number
    treePanelAbsoluteHeight: number
  } | null>(null)
  let resizePreview = {
    rightPanelWidth: rightPanelWidth.value,
    treePanelAbsoluteHeight: treePanelAbsoluteHeight.value,
  }
  let resizeFrameId: number | null = null
  let previousBodyCursor = ''
  let previousBodyUserSelect = ''
  let isBodyInteractionLocked = false

  function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
  }

  function readRootMetric(variableName: string, fallback: number): number {
    const root = editorRootRef.value
    if (!root || typeof getComputedStyle !== 'function') {
      return fallback
    }

    const rawValue = getComputedStyle(root).getPropertyValue(variableName).trim()
    const parsedValue = Number.parseFloat(rawValue)
    return Number.isFinite(parsedValue) ? parsedValue : fallback
  }

  function getRightPanelMaxWidth(): number {
    const editorWidth = editorRootRef.value?.clientWidth ?? 0
    const overlayInsetX = readRootMetric('--card-editor-overlay-inset-x', 24)
    const centerSafeWidth = readRootMetric('--card-editor-center-safe-width', MIN_CANVAS_WIDTH)
    const leftPanelWidth = readRootMetric('--card-editor-left-panel-width', MIN_RIGHT_PANEL_WIDTH)
    const viewportMax = editorWidth > 0
      ? editorWidth - leftPanelWidth - overlayInsetX - overlayInsetX - centerSafeWidth
      : MAX_RIGHT_PANEL_WIDTH
    return Math.max(MIN_RIGHT_PANEL_WIDTH, Math.min(MAX_RIGHT_PANEL_WIDTH, viewportMax))
  }

  function getTreePanelMaxHeight(): number {
    const panelHeight = rightPanelRef.value?.clientHeight ?? 0
    const maxHeight = panelHeight - MIN_PROPERTY_PANEL_HEIGHT - HORIZONTAL_RESIZER_HEIGHT
    return Math.max(MIN_TREE_PANEL_HEIGHT, maxHeight)
  }

  function syncPanelBounds() {
    rightPanelWidth.value = clamp(rightPanelWidth.value, MIN_RIGHT_PANEL_WIDTH, getRightPanelMaxWidth())
    treePanelAbsoluteHeight.value = clamp(treePanelAbsoluteHeight.value, MIN_TREE_PANEL_HEIGHT, getTreePanelMaxHeight())
  }

  function writeResizePreview() {
    const root = editorRootRef.value
    if (!root) {
      return
    }

    root.style.setProperty('--card-editor-right-panel-width', `${resizePreview.rightPanelWidth}px`)
    root.style.setProperty('--card-editor-tree-panel-height', `${resizePreview.treePanelAbsoluteHeight}px`)
  }

  function scheduleResizePreview() {
    if (resizeFrameId !== null) {
      return
    }

    resizeFrameId = window.requestAnimationFrame(() => {
      resizeFrameId = null
      writeResizePreview()
    })
  }

  function flushResizePreview() {
    if (resizeFrameId !== null) {
      window.cancelAnimationFrame(resizeFrameId)
      resizeFrameId = null
    }

    writeResizePreview()
  }

  function applyResizeBodyState(cursor: 'col-resize' | 'row-resize') {
    if (!isBodyInteractionLocked) {
      previousBodyCursor = document.body.style.cursor
      previousBodyUserSelect = document.body.style.userSelect
      isBodyInteractionLocked = true
    }

    document.body.style.userSelect = 'none'
    document.body.style.cursor = cursor
  }

  function clearResizeBodyState() {
    if (!isBodyInteractionLocked) {
      return
    }

    document.body.style.cursor = previousBodyCursor
    document.body.style.userSelect = previousBodyUserSelect
    previousBodyCursor = ''
    previousBodyUserSelect = ''
    isBodyInteractionLocked = false
  }

  function startRightPanelResize(event: MouseEvent) {
    resizeState.value = 'right-panel'
    resizeSnapshot.value = {
      clientX: event.clientX,
      clientY: event.clientY,
      rightPanelWidth: rightPanelWidth.value,
      treePanelAbsoluteHeight: treePanelAbsoluteHeight.value,
    }
    resizePreview = {
      rightPanelWidth: rightPanelWidth.value,
      treePanelAbsoluteHeight: treePanelAbsoluteHeight.value,
    }
    applyResizeBodyState('col-resize')
  }

  function startTreePanelResize(event: MouseEvent) {
    resizeState.value = 'tree-panel'
    resizeSnapshot.value = {
      clientX: event.clientX,
      clientY: event.clientY,
      rightPanelWidth: rightPanelWidth.value,
      treePanelAbsoluteHeight: treePanelAbsoluteHeight.value,
    }
    resizePreview = {
      rightPanelWidth: rightPanelWidth.value,
      treePanelAbsoluteHeight: treePanelAbsoluteHeight.value,
    }
    applyResizeBodyState('row-resize')
  }

  function handleGlobalMouseMove(event: MouseEvent) {
    if (!resizeState.value || !resizeSnapshot.value) {
      return
    }

    if (resizeState.value === 'right-panel') {
      resizePreview.rightPanelWidth = clamp(
        resizeSnapshot.value.rightPanelWidth - (event.clientX - resizeSnapshot.value.clientX),
        MIN_RIGHT_PANEL_WIDTH,
        getRightPanelMaxWidth(),
      )
      scheduleResizePreview()
      return
    }

    resizePreview.treePanelAbsoluteHeight = clamp(
      resizeSnapshot.value.treePanelAbsoluteHeight + (event.clientY - resizeSnapshot.value.clientY),
      MIN_TREE_PANEL_HEIGHT,
      getTreePanelMaxHeight(),
    )
    scheduleResizePreview()
  }

  function stopPanelResize() {
    if (!resizeState.value) {
      return
    }

    flushResizePreview()
    rightPanelWidth.value = resizePreview.rightPanelWidth
    treePanelAbsoluteHeight.value = resizePreview.treePanelAbsoluteHeight
    resizeState.value = null
    resizeSnapshot.value = null
    clearResizeBodyState()
  }

  function mountPanelResizeListeners() {
    syncPanelBounds()
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', stopPanelResize)
    window.addEventListener('resize', syncPanelBounds)
  }

  function unmountPanelResizeListeners() {
    if (resizeFrameId !== null) {
      window.cancelAnimationFrame(resizeFrameId)
      resizeFrameId = null
    }

    window.removeEventListener('mousemove', handleGlobalMouseMove)
    window.removeEventListener('mouseup', stopPanelResize)
    window.removeEventListener('resize', syncPanelBounds)
    clearResizeBodyState()
  }

  return {
    editorRootRef,
    rightPanelRef,
    editorStyle,
    resizeState,
    startRightPanelResize,
    startTreePanelResize,
    mountPanelResizeListeners,
    unmountPanelResizeListeners,
  }
}
