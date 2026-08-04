<template>
  <div ref="viewportRef" class="card-viewport" :class="{
    'card-viewport-panning': isPanning,
    'card-viewport--layer-view': effectiveLayerViewActive,
  }"
    @pointerdown.self="handleViewportPointerDown" @mousedown="handleMouseDown" @mousemove="handleMouseMove"
    @mouseup="handleMouseUp" @mouseleave="handleMouseUp" @wheel.prevent="handleWheel">
    <div ref="stageRef" class="card-viewport-stage" :style="stageStyle">
      <CardFaceRenderer :face="face" :transform-disabled-block-ids="transformDisabledBlockIds"
        :clip-to-face="clipToFace"
        :resource-root-path="resourceRootPath"
        :remote-resource-policy="remoteResourcePolicy"
        :project-icon-catalog="projectIconCatalog"
        @block-click="handleBlockClick" />
      <Transition name="card-info-fade">
        <aside v-if="$slots.info && showInfo" class="card-viewport-info" :style="viewportInfoStyle">
          <slot name="info" />
        </aside>
      </Transition>
      <aside v-if="$slots['left-info']" class="card-viewport-left-info" :style="viewportLeftInfoStyle"
        @pointerdown.stop.prevent="startFaceDimensionDrag('height', $event)">
        <span
          class="card-viewport-dimension-line card-viewport-dimension-line--vertical"
          :style="viewportLeftInfoLineStyle"
        >
          <span class="card-viewport-dimension-label"><slot name="left-info" /></span>
        </span>
      </aside>
      <aside v-if="$slots['bottom-info']" class="card-viewport-bottom-info" :style="viewportBottomInfoStyle"
        @pointerdown.stop.prevent="startFaceDimensionDrag('width', $event)">
        <span
          class="card-viewport-dimension-line card-viewport-dimension-line--horizontal"
          :style="viewportBottomInfoLineStyle"
        >
          <span class="card-viewport-dimension-label"><slot name="bottom-info" /></span>
        </span>
      </aside>
    </div>
    <CardLayerView
      v-if="effectiveLayerViewActive"
      ref="layerViewRef"
      :face="face"
      :source-root="stageRef"
      :selected-block-id="selectedBlockId"
      :space-modifier-active="spaceModifierActive"
      :base-plane-label="layerViewBasePlaneLabel"
      :shortcut-legend-label="layerViewShortcutLegendLabel"
      :shortcut-hints="layerViewShortcutHints"
      :viewport-width="viewportWidth"
      :viewport-height="viewportHeight"
      @block-click="handleBlockClick"
      @z-index-step="emit('z-index-step', $event)"
    />
    <div v-if="!effectiveLayerViewActive" class="card-selection-layer">
      <Transition name="selection-overlay-fade">
      <svg v-if="moveGuide" class="selection-anchor-guide" aria-hidden="true">
        <defs>
          <marker id="selection-anchor-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5"
            orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L7,3.5 L0,7 Z" />
          </marker>
        </defs>
        <polyline :points="moveGuide.points" />
        <line class="selection-anchor-guide-diagonal"
          :x1="moveGuide.parentX" :y1="moveGuide.parentY"
          :x2="moveGuide.selectionX" :y2="moveGuide.selectionY"
          marker-end="url(#selection-anchor-arrow)" />
        <circle :cx="moveGuide.parentX" :cy="moveGuide.parentY" r="3" />
        <text class="selection-anchor-guide-label selection-anchor-guide-label--x"
          :x="moveGuide.horizontalLabelX" :y="moveGuide.horizontalLabelY">
          x {{ moveGuide.x }}
        </text>
        <text class="selection-anchor-guide-label selection-anchor-guide-label--y"
          :x="moveGuide.verticalLabelX" :y="moveGuide.verticalLabelY"
          :transform="`rotate(-90 ${moveGuide.verticalLabelX} ${moveGuide.verticalLabelY})`">
          y {{ moveGuide.y }}
        </text>
      </svg>
      </Transition>
      <Transition name="selection-overlay-fade">
      <span v-if="moveGuide" class="selection-anchor-badge" :style="moveGuide.anchorBadgeStyle">
        {{ moveGuide.anchor }}
      </span>
      </Transition>
      <div v-if="selectionFrame" :key="selectedBlockId ?? 'selection'" class="selection-frame" :class="{
        'selection-frame-movable': showMoveHandle,
        'is-resizing': activeHandle,
        'is-moving': isMovingSelection,
      }"
        :style="selectionFrameStyle" tabindex="0" @pointerdown="handleSelectionFramePointerDown"
        @contextmenu="openSelectionContextMenu"
        @keydown="openSelectionKeyboardMenu">
        <Transition name="selection-overlay-fade">
        <nav v-if="selectionQuickActions.length > 0 && !isTransformingSelection" class="selection-quick-actions"
          :aria-label="selectionActionLabels.label" @pointerdown.stop>
          <OcActionButton v-for="action in selectionQuickActions" :key="action.key" :action="action"
            size="md" variant="ghost" @select="handleSelectionQuickAction($event.key)" />
        </nav>
        </Transition>
        <Transition name="selection-info-fade">
        <aside v-if="selectionInfo && !isTransformingSelection" class="selection-block-info" @pointerdown.stop>
          <span class="selection-block-info__title">
            <OcIcon :name="selectionInfo.icon" size="sm" />
            <span>{{ selectionInfo.name }}</span>
          </span>
          <span v-if="selectionInfo.notes" class="selection-block-info__notes">{{ selectionInfo.notes }}</span>
        </aside>
        </Transition>
        <Transition name="selection-overlay-fade">
        <output v-if="resizeMetrics?.width" class="selection-size-label selection-size-label--width">
          {{ resizeMetrics.width }}
        </output>
        </Transition>
        <Transition name="selection-overlay-fade">
        <output v-if="resizeMetrics?.height" class="selection-size-label selection-size-label--height">
          <span>{{ resizeMetrics.height }}</span>
        </output>
        </Transition>
        <button v-for="handle in activeHandles" :key="handle" type="button" class="selection-handle"
          :class="[`selection-handle-${handle}`, { 'is-active': activeHandle === handle }]"
          :data-tooltip="`Resize ${handle}`" :aria-label="`Resize ${handle}`"
          @pointerdown.stop.prevent="startResize(handle)" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import type { IconToken } from '../../../shared/ui/icon/iconRegistry'

export type CardViewportSelectionAction =
  | { type: 'fill-parent'; blockId: string }
  | { type: 'fill-cross-axis'; blockId: string }
  | { type: 'center-cross-axis'; blockId: string }
  | {
      type: 'geometry.apply'
      operation: 'center' | 'inset' | 'outset'
      blockId: string
      width: number
      height: number
      x: number
      y: number
    }

export type CardViewportSelectionCommand = {
  key: string
  blockId: string
}

export type CardViewportSelectionActionLabels = {
  label: string
  fillParent: string
  centerInParent: string
  inset: string
  outset: string
  fillCrossAxis: string
  centerCrossAxis: string
}

export type CardViewportSelectionInfo = {
  icon: IconToken
  name: string
  notes: string
}
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AnchorPosition, FlowDirection } from '../../../entities/card/model'
import OcIcon from '../../../components/base/OcIcon.vue'
import OcActionButton, { type OcActionButtonAction } from '../../../components/standard/OcActionButton.vue'
import { useFloatingMenu } from '../../../composables/useFloatingMenu'
import CardFaceRenderer from './CardFaceRenderer.vue'
import CardLayerView from './CardLayerView.vue'
import { buildCardLayerGroups } from './cardLayerModel'
import type { RenderReadyCardFace } from '../render.types'
import type { ProjectRemoteResourcePolicy } from '../../workspace/model/projectMetadata'
import { EMPTY_PROJECT_ICON_CATALOG, type ProjectIconCatalog } from '../../workspace/services/projectIconCatalog'
import {
  VIEWPORT_FIT_PADDING,
  VIEWPORT_MAX_SCALE,
  VIEWPORT_MIN_SCALE,
  VIEWPORT_WHEEL_ZOOM_SENSITIVITY,
  VIEWPORT_ZOOM_ANIMATION_EPSILON,
  VIEWPORT_ZOOM_ANIMATION_SMOOTHING,
  normalizeViewportWheelDelta,
} from '../../../shared/ui/viewport/viewportNavigation'

type ResizeHandle = 'lt' | 'rt' | 'lb' | 'rb' | 'l' | 'r' | 't' | 'b'
type ResizeMode = 'absolute' | 'flow' | 'none'
type SelectionFrame = {
  left: number
  top: number
  width: number
  height: number
}
type SelectionMeasurement = {
  frame: SelectionFrame
  parentFrame: SelectionFrame
  worldRect: SelectionFrame
  parentWorldWidth: number
  parentWorldHeight: number
}
type ResizePayload = {
  width: number
  height: number
  x?: number
  y?: number
}
type MovePayload = {
  x: number
  y: number
}
type FaceDimension = 'width' | 'height'
type ViewportTransform = {
  x: number
  y: number
  scale: number
}
const TRANSFORM_EPSILON = 0.0001
const SELECTION_INSET_STEP = 10
const MIN_SELECTION_SIZE = 24

const emit = defineEmits<{
  (e: 'block-click', blockId: string, event: MouseEvent): void
  (e: 'blank-click', event: MouseEvent): void
  (e: 'resize-selection', payload: ResizePayload & { blockId: string }): void
  (e: 'move-selection', payload: MovePayload & { blockId: string }): void
  (e: 'selection-action', payload: CardViewportSelectionAction): void
  (e: 'selection-command', payload: CardViewportSelectionCommand): void
  (e: 'viewport-transform-change', payload: { x: number; y: number; scale: number }): void
  (e: 'viewport-size-change', payload: { width: number; height: number }): void
  (e: 'face-dimension-change', payload: { dimension: FaceDimension; value: number; final: boolean }): void
  (e: 'z-index-step', payload: { delta: -1 | 1; existingLayersOnly: boolean }): void
}>()

const props = withDefaults(defineProps<{
  face: RenderReadyCardFace
  clipToFace?: boolean
  restoreKey?: string
  selectedBlockId?: string | null
  selectedLocationType?: 'simple-container-location' | 'flow-container-location' | null
  selectedAnchor?: AnchorPosition | null
  selectedParentBlockId?: string | null
  selectedParentFlowDirection?: FlowDirection | null
  selectionInfo?: CardViewportSelectionInfo | null
  selectionActionLabels?: CardViewportSelectionActionLabels
  selectionCommandActions?: readonly OcActionButtonAction[]
  showPositionOnMove?: boolean
  showSizeOnResize?: boolean
  showInfo?: boolean
  layerViewActive?: boolean
  spaceModifierActive?: boolean
  layerViewShortcutLegendLabel?: string
  layerViewBasePlaneLabel?: string
  layerViewShortcutHints?: Array<{
    keys: Array<string | { icon: IconToken } | { separator: string }>
    label: string
  }>
  transform?: ViewportTransform
  transformDisabledBlockIds?: string[]
  resourceRootPath?: string | null
  remoteResourcePolicy?: ProjectRemoteResourcePolicy
  projectIconCatalog?: ProjectIconCatalog
}>(), {
  restoreKey: undefined,
  selectedBlockId: null,
  selectedLocationType: null,
  selectedAnchor: null,
  selectedParentBlockId: null,
  selectedParentFlowDirection: null,
  selectionInfo: null,
  selectionCommandActions: () => [],
  selectionActionLabels: () => ({
    label: 'Selection layout actions',
    fillParent: 'Fill parent',
    centerInParent: 'Center in parent',
    inset: 'Inset 10 px',
    outset: 'Outset 10 px',
    fillCrossAxis: 'Fill cross axis',
    centerCrossAxis: 'Center on cross axis',
  }),
  showPositionOnMove: true,
  showSizeOnResize: true,
  showInfo: true,
  layerViewActive: false,
  spaceModifierActive: false,
  layerViewShortcutLegendLabel: '',
  layerViewBasePlaneLabel: '',
  layerViewShortcutHints: () => [],
  transform: undefined,
  transformDisabledBlockIds: () => [],
  clipToFace: false,
  resourceRootPath: null,
  remoteResourcePolicy: undefined,
  projectIconCatalog: () => EMPTY_PROJECT_ICON_CATALOG,
})

const viewportRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const layerViewRef = ref<{
  stepLayer: (direction: -1 | 1, wholeLayer?: boolean) => void
  focusBlock: (blockId: string) => void
  getFocusedBlockId: () => string | null
  cycleLayerByInitial: (initial: string, currentLayerOnly?: boolean) => boolean
} | null>(null)
const viewportWidth = ref(0)
const viewportHeight = ref(0)
const panX = ref(0)
const panY = ref(0)
const scale = ref(1)
const targetPanX = ref(0)
const targetPanY = ref(0)
const targetScale = ref(1)
const isPanning = ref(false)
const lastPointerX = ref(0)
const lastPointerY = ref(0)
const selectionFrame = ref<SelectionFrame | null>(null)
const activeHandle = ref<ResizeHandle | null>(null)
const isMovingSelection = ref(false)
const dragMeasurement = ref<SelectionMeasurement | null>(null)
const previewWorldRect = ref<SelectionFrame | null>(null)
const transformBlockId = ref<string | null>(null)
const faceDimensionDrag = ref<{
  dimension: FaceDimension
  startClientPosition: number
  startValue: number
  lastValue: number
} | null>(null)

let resizeObserver: ResizeObserver | null = null
let zoomAnimationFrame: number | null = null
let lastEmittedTransform: ViewportTransform | null = null
let pendingTransformEchoes: ViewportTransform[] = []
let previousDimensionCursor = ''

const effectiveLayerViewActive = computed(() => (
  props.layerViewActive && buildCardLayerGroups(props.face).length > 0
))

function applyViewportTransform(transform: ViewportTransform | undefined) {
  const nextTransform = transform ?? { x: 0, y: 0, scale: 1 }
  panX.value = nextTransform.x
  panY.value = nextTransform.y
  scale.value = clamp(nextTransform.scale, VIEWPORT_MIN_SCALE, VIEWPORT_MAX_SCALE)
  targetPanX.value = panX.value
  targetPanY.value = panY.value
  targetScale.value = scale.value
}

function hasSameViewportTransform(left: ViewportTransform | null, right: ViewportTransform) {
  return Boolean(left)
    && Math.abs(left!.x - right.x) < TRANSFORM_EPSILON
    && Math.abs(left!.y - right.y) < TRANSFORM_EPSILON
    && Math.abs(left!.scale - right.scale) < TRANSFORM_EPSILON
}

const baseOffsetX = computed(() => {
  return getBaseOffsetXForScale(scale.value)
})

const baseOffsetY = computed(() => {
  return getBaseOffsetYForScale(scale.value)
})

const translateX = computed(() => baseOffsetX.value + panX.value)
const translateY = computed(() => baseOffsetY.value + panY.value)

const stageStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
}))
const viewportInfoStyle = computed(() => {
  const safeScale = scale.value || 1
  return {
    left: `${props.face.width + 16 / safeScale}px`,
    transform: `scale(${1 / safeScale})`,
  }
})
const viewportLeftInfoStyle = computed(() => {
  const safeScale = scale.value || 1
  return {
    left: `${-12 / safeScale}px`,
    top: `${props.face.height / 2}px`,
    transform: `translate(-50%, -50%) scale(${1 / safeScale})`,
  }
})
const viewportBottomInfoStyle = computed(() => {
  const safeScale = scale.value || 1
  return {
    left: `${props.face.width / 2}px`,
    top: `${props.face.height + 12 / safeScale}px`,
    transform: `translateX(-50%) scale(${1 / safeScale})`,
  }
})
const viewportLeftInfoLineStyle = computed(() => ({
  height: `${props.face.height * scale.value}px`,
}))
const viewportBottomInfoLineStyle = computed(() => ({
  width: `${props.face.width * scale.value}px`,
}))
const resizeMode = computed<ResizeMode>(() => {
  if (!props.selectedBlockId) {
    return 'none'
  }
  return props.selectedLocationType === 'flow-container-location' ? 'flow' : 'absolute'
})
const activeHandles = computed<ResizeHandle[]>(() => {
  if (resizeMode.value === 'flow') {
    return ['l', 't', 'r', 'b', 'rb']
  }
  if (resizeMode.value === 'absolute') {
    return ['lt', 't', 'rt', 'l', 'r', 'lb', 'b', 'rb']
  }
  return []
})
const showMoveHandle = computed(() => props.selectedLocationType === 'simple-container-location')
const selectionQuickActions = computed<OcActionButtonAction[]>(() => {
  if (!props.selectedBlockId) return []
  if (resizeMode.value === 'absolute') {
    return [
      ...props.selectionCommandActions,
      {
        key: 'fill-parent',
        title: props.selectionActionLabels.fillParent,
        icon: 'layout.fill',
      },
      {
        key: 'center',
        title: props.selectionActionLabels.centerInParent,
        icon: 'layout.center',
      },
      {
        key: 'inset',
        title: props.selectionActionLabels.inset,
        icon: 'layout.inset',
      },
      {
        key: 'outset',
        title: props.selectionActionLabels.outset,
        icon: 'layout.outset',
      },
    ]
  }
  if (resizeMode.value === 'flow') {
    const horizontalFlow = props.selectedParentFlowDirection === 'lr'
      || props.selectedParentFlowDirection === 'rl'
    return [
      ...props.selectionCommandActions,
      {
        key: 'fill-cross-axis',
        title: props.selectionActionLabels.fillCrossAxis,
        icon: horizontalFlow ? 'layout.fill-vertical' : 'layout.fill-horizontal',
      },
      {
        key: 'center-cross-axis',
        title: props.selectionActionLabels.centerCrossAxis,
        icon: 'format.align-center',
      },
    ]
  }
  return []
})

function findSelectionAction(
  actions: readonly OcActionButtonAction[],
  actionKey: string,
): OcActionButtonAction | null {
  for (const action of actions) {
    if (action.key === actionKey) return action
    for (const child of action.children ?? []) {
      if (child.type === 'divider') continue
      const match = findSelectionAction([child], actionKey)
      if (match) return match
    }
  }
  return null
}
const { openContextMenu } = useFloatingMenu()

function openSelectionContextMenu(event: MouseEvent): void {
  openContextMenu({
    event,
    items: selectionQuickActions.value,
    onSelect: handleSelectionQuickAction,
  })
}

function openSelectionKeyboardMenu(event: KeyboardEvent): void {
  if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return
  if (selectionQuickActions.value.length === 0 || !(event.currentTarget instanceof HTMLElement)) return
  event.preventDefault()
  openContextMenu({
    anchor: event.currentTarget,
    items: selectionQuickActions.value,
    onSelect: handleSelectionQuickAction,
  })
}
const selectionFrameStyle = computed(() => {
  const frame = selectionFrame.value
  if (!frame) {
    return {}
  }
  return {
    left: `${frame.left}px`,
    top: `${frame.top}px`,
    width: `${frame.width}px`,
    height: `${frame.height}px`,
  }
})
const isTransformingSelection = computed(() => Boolean(activeHandle.value) || isMovingSelection.value)
const resizeMetrics = computed(() => {
  const preview = previewWorldRect.value
  const handle = activeHandle.value
  if (!props.showSizeOnResize || !handle || !preview) return null
  const changesWidth = handle === 'l' || handle === 'r' || handle.length === 2
  const changesHeight = handle === 't' || handle === 'b' || handle.length === 2
  return {
    width: changesWidth ? formatGeometryValue(preview.width) : null,
    height: changesHeight ? formatGeometryValue(preview.height) : null,
  }
})
const moveGuide = computed(() => {
  const frame = selectionFrame.value
  const measurement = dragMeasurement.value
  if (!props.showPositionOnMove || !isMovingSelection.value || !frame || !measurement) return null

  const anchor = props.selectedAnchor ?? 'lt'
  const parentPoint = getAnchorPoint(measurement.parentFrame, anchor)
  const selectionPoint = getAnchorPoint(frame, anchor)
  const position = buildMovePayload(previewWorldRect.value!, measurement)
  return {
    anchor: anchor.toUpperCase(),
    parentX: parentPoint.x,
    parentY: parentPoint.y,
    selectionX: selectionPoint.x,
    selectionY: selectionPoint.y,
    horizontalLabelX: (parentPoint.x + selectionPoint.x) / 2,
    horizontalLabelY: parentPoint.y,
    verticalLabelX: selectionPoint.x,
    verticalLabelY: (parentPoint.y + selectionPoint.y) / 2,
    x: formatGeometryValue(position.x),
    y: formatGeometryValue(position.y),
    anchorBadgeStyle: {
      left: `${selectionPoint.x + 8}px`,
      top: `${selectionPoint.y + 8}px`,
    },
    points: [
      `${parentPoint.x},${parentPoint.y}`,
      `${selectionPoint.x},${parentPoint.y}`,
      `${selectionPoint.x},${selectionPoint.y}`,
    ].join(' '),
  }
})

function formatGeometryValue(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${Object.is(rounded, -0) ? 0 : rounded}px`
}

function getAnchorPoint(frame: SelectionFrame, anchor: AnchorPosition): { x: number; y: number } {
  const horizontal = anchor[0]
  const vertical = anchor[1]
  const x = horizontal === 'l'
    ? frame.left
    : horizontal === 'r' ? frame.left + frame.width : frame.left + frame.width / 2
  const y = vertical === 't'
    ? frame.top
    : vertical === 'b' ? frame.top + frame.height : frame.top + frame.height / 2
  return { x, y }
}

function handleSelectionQuickAction(actionKey: string): void {
  const blockId = props.selectedBlockId
  if (!blockId) return

  if (actionKey === 'fill-parent') {
    emit('selection-action', { type: 'fill-parent', blockId })
    return
  }
  if (actionKey === 'fill-cross-axis') {
    emit('selection-action', { type: 'fill-cross-axis', blockId })
    return
  }
  if (actionKey === 'center-cross-axis') {
    emit('selection-action', { type: 'center-cross-axis', blockId })
    return
  }
  if (findSelectionAction(props.selectionCommandActions, actionKey)) {
    emit('selection-command', { key: actionKey, blockId })
    return
  }
  if (actionKey !== 'center' && actionKey !== 'inset' && actionKey !== 'outset') return

  const measurement = measureSelection()
  if (!measurement) return
  const nextRect = buildQuickActionRect(actionKey, measurement)
  if (!nextRect) return
  const geometry = buildAbsoluteResizePayload(nextRect, measurement)
  emit('selection-action', {
    type: 'geometry.apply',
    operation: actionKey,
    blockId,
    width: geometry.width,
    height: geometry.height,
    x: geometry.x ?? 0,
    y: geometry.y ?? 0,
  })
}

function runSelectionQuickAction(actionKey: string): boolean {
  const action = findSelectionAction(selectionQuickActions.value, actionKey)
  if (!action || action.disabled) return false
  handleSelectionQuickAction(actionKey)
  return true
}

function nudgeSelection(deltaX: number, deltaY: number): boolean {
  const blockId = props.selectedBlockId
  if (!showMoveHandle.value || !blockId) return false
  const measurement = measureSelection()
  if (!measurement) return false

  emit('move-selection', {
    blockId,
    ...buildMovePayload({
      ...measurement.worldRect,
      left: measurement.worldRect.left + deltaX,
      top: measurement.worldRect.top + deltaY,
    }, measurement),
  })
  return true
}

function buildQuickActionRect(
  actionKey: string,
  measurement: SelectionMeasurement,
): SelectionFrame | null {
  const current = measurement.worldRect
  if (actionKey === 'center') {
    return {
      left: (measurement.parentWorldWidth - current.width) / 2,
      top: (measurement.parentWorldHeight - current.height) / 2,
      width: current.width,
      height: current.height,
    }
  }
  if (actionKey !== 'inset' && actionKey !== 'outset') return null

  const delta = actionKey === 'inset' ? -SELECTION_INSET_STEP * 2 : SELECTION_INSET_STEP * 2
  const width = Math.max(MIN_SELECTION_SIZE, current.width + delta)
  const height = Math.max(MIN_SELECTION_SIZE, current.height + delta)
  return {
    left: current.left - (width - current.width) / 2,
    top: current.top - (height - current.height) / 2,
    width,
    height,
  }
}

function handleMouseDown(event: MouseEvent) {
  if (effectiveLayerViewActive.value) return
  if (event.button !== 1) return

  event.preventDefault()
  stopZoomAnimation()
  isPanning.value = true
  lastPointerX.value = event.clientX
  lastPointerY.value = event.clientY
}

function handleMouseMove(event: MouseEvent) {
  if (!isPanning.value) return

  const deltaX = event.clientX - lastPointerX.value
  const deltaY = event.clientY - lastPointerY.value

  panX.value += deltaX
  panY.value += deltaY
  targetPanX.value = panX.value
  targetPanY.value = panY.value

  lastPointerX.value = event.clientX
  lastPointerY.value = event.clientY
}

function handleMouseUp() {
  isPanning.value = false
}

function handleWheel(event: WheelEvent) {
  if (effectiveLayerViewActive.value) return
  const viewport = viewportRef.value
  if (!viewport) return

  const rect = viewport.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  const normalizedDelta = normalizeWheelDelta(event.deltaY, event.deltaMode)
  if (Math.abs(normalizedDelta) < 0.01) return
  const nextScale = targetScale.value * Math.exp(-normalizedDelta * VIEWPORT_WHEEL_ZOOM_SENSITIVITY)
  zoomAt(nextScale, mouseX, mouseY)
}

function zoomByWheelAt(
  deltaY: number,
  deltaMode: number,
  viewportX: number,
  viewportY: number,
): void {
  if (effectiveLayerViewActive.value) return
  const normalizedDelta = normalizeWheelDelta(deltaY, deltaMode)
  if (Math.abs(normalizedDelta) < 0.01) return
  zoomAt(
    targetScale.value * Math.exp(-normalizedDelta * VIEWPORT_WHEEL_ZOOM_SENSITIVITY),
    viewportX,
    viewportY,
  )
}

function zoomBy(factor: number): void {
  if (effectiveLayerViewActive.value) return
  zoomAt(
    targetScale.value * factor,
    viewportWidth.value / 2,
    viewportHeight.value / 2,
  )
}

function zoomAt(nextValue: number, viewportX: number, viewportY: number): void {
  const previousScale = targetScale.value
  const nextScale = clamp(nextValue, VIEWPORT_MIN_SCALE, VIEWPORT_MAX_SCALE)
  if (Math.abs(nextScale - previousScale) < 0.0001) return

  const previousTranslateX = getBaseOffsetXForScale(previousScale) + targetPanX.value
  const previousTranslateY = getBaseOffsetYForScale(previousScale) + targetPanY.value
  const worldX = (viewportX - previousTranslateX) / previousScale
  const worldY = (viewportY - previousTranslateY) / previousScale
  const nextBaseOffsetX = getBaseOffsetXForScale(nextScale)
  const nextBaseOffsetY = getBaseOffsetYForScale(nextScale)

  targetScale.value = nextScale
  targetPanX.value = viewportX - nextBaseOffsetX - worldX * nextScale
  targetPanY.value = viewportY - nextBaseOffsetY - worldY * nextScale
  startZoomAnimation()
}

function resetView(): void {
  if (effectiveLayerViewActive.value) return
  stopZoomAnimation()
  panX.value = 0
  panY.value = 0
  scale.value = 1
  targetPanX.value = 0
  targetPanY.value = 0
  targetScale.value = 1
}

function fitView(targetRect?: { left: number; top: number; width: number; height: number }): void {
  if (effectiveLayerViewActive.value) return
  const viewport = viewportRef.value
  if (!viewport || viewportWidth.value <= 0 || viewportHeight.value <= 0) return

  const viewportRect = viewport.getBoundingClientRect()
  const hasTargetRegion = Boolean(targetRect && targetRect.width > 0 && targetRect.height > 0)
  const regionLeft = hasTargetRegion ? targetRect!.left - viewportRect.left : 0
  const regionTop = hasTargetRegion ? targetRect!.top - viewportRect.top : 0
  const regionWidth = hasTargetRegion ? targetRect!.width : viewportWidth.value
  const regionHeight = hasTargetRegion ? targetRect!.height : viewportHeight.value
  const availableWidth = Math.max(1, regionWidth - VIEWPORT_FIT_PADDING * 2)
  const availableHeight = Math.max(1, regionHeight - VIEWPORT_FIT_PADDING * 2)
  const nextScale = clamp(
    Math.min(availableWidth / props.face.width, availableHeight / props.face.height),
    VIEWPORT_MIN_SCALE,
    VIEWPORT_MAX_SCALE,
  )

  stopZoomAnimation()
  panX.value = regionLeft + regionWidth / 2 - viewportWidth.value / 2
  panY.value = regionTop + regionHeight / 2 - viewportHeight.value / 2
  scale.value = nextScale
  targetPanX.value = panX.value
  targetPanY.value = panY.value
  targetScale.value = nextScale
}

function normalizeWheelDelta(deltaY: number, deltaMode: number): number {
  return normalizeViewportWheelDelta(deltaY, deltaMode, viewportHeight.value || window.innerHeight)
}

function getBaseOffsetXForScale(value: number): number {
  if (viewportWidth.value <= 0) {
    return 0
  }
  return (viewportWidth.value - props.face.width * value) / 2
}

function getBaseOffsetYForScale(value: number): number {
  if (viewportHeight.value <= 0) {
    return 0
  }
  return (viewportHeight.value - props.face.height * value) / 2
}

function startZoomAnimation() {
  if (zoomAnimationFrame !== null) {
    return
  }

  const animate = () => {
    const scaleDelta = targetScale.value - scale.value
    const panXDelta = targetPanX.value - panX.value
    const panYDelta = targetPanY.value - panY.value

    if (
      Math.abs(scaleDelta) < VIEWPORT_ZOOM_ANIMATION_EPSILON &&
      Math.abs(panXDelta) < VIEWPORT_ZOOM_ANIMATION_EPSILON &&
      Math.abs(panYDelta) < VIEWPORT_ZOOM_ANIMATION_EPSILON
    ) {
      scale.value = targetScale.value
      panX.value = targetPanX.value
      panY.value = targetPanY.value
      zoomAnimationFrame = null
      return
    }

    scale.value += scaleDelta * VIEWPORT_ZOOM_ANIMATION_SMOOTHING
    panX.value += panXDelta * VIEWPORT_ZOOM_ANIMATION_SMOOTHING
    panY.value += panYDelta * VIEWPORT_ZOOM_ANIMATION_SMOOTHING
    zoomAnimationFrame = requestAnimationFrame(animate)
  }

  zoomAnimationFrame = requestAnimationFrame(animate)
}

function stopZoomAnimation() {
  if (zoomAnimationFrame !== null) {
    cancelAnimationFrame(zoomAnimationFrame)
    zoomAnimationFrame = null
  }
  targetScale.value = scale.value
  targetPanX.value = panX.value
  targetPanY.value = panY.value
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function handleBlockClick(blockId: string, event: MouseEvent) {
  emit('block-click', blockId, event)
}

function stepLayer(direction: -1 | 1, wholeLayer = false): void {
  layerViewRef.value?.stepLayer(direction, wholeLayer)
}

function focusLayerBlock(blockId: string): void {
  layerViewRef.value?.focusBlock(blockId)
}

function getFocusedLayerBlockId(): string | null {
  return layerViewRef.value?.getFocusedBlockId() ?? null
}

function cycleLayerByInitial(initial: string, currentLayerOnly = false): boolean {
  return layerViewRef.value?.cycleLayerByInitial(initial, currentLayerOnly) ?? false
}

function handleViewportPointerDown(event: PointerEvent) {
  if (event.button !== 0) {
    return
  }

  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  if (target.closest('[data-block-id]') || target.closest('.selection-frame') || target.closest('.selection-handle')) {
    return
  }

  emit('blank-click', event as unknown as MouseEvent)
}

function startFaceDimensionDrag(dimension: FaceDimension, event: PointerEvent): void {
  if (event.button !== 0) return
  const startValue = dimension === 'width' ? props.face.width : props.face.height
  faceDimensionDrag.value = {
    dimension,
    startClientPosition: dimension === 'width' ? event.clientX : event.clientY,
    startValue,
    lastValue: startValue,
  }
  previousDimensionCursor = document.body.style.cursor
  document.body.style.cursor = dimension === 'width' ? 'ew-resize' : 'ns-resize'
  window.addEventListener('pointermove', handleFaceDimensionDrag)
  window.addEventListener('pointerup', stopFaceDimensionDrag)
  window.addEventListener('pointercancel', stopFaceDimensionDrag)
}

function handleFaceDimensionDrag(event: PointerEvent): void {
  const drag = faceDimensionDrag.value
  if (!drag) return
  const clientPosition = drag.dimension === 'width' ? event.clientX : event.clientY
  const directionalDelta = drag.dimension === 'width'
    ? clientPosition - drag.startClientPosition
    : drag.startClientPosition - clientPosition
  const rawValue = drag.startValue + directionalDelta / (scale.value || 1)
  const nextValue = Math.max(16, event.shiftKey
    ? Math.round(rawValue / 10) * 10
    : Math.round(rawValue))
  if (nextValue === drag.lastValue) return
  drag.lastValue = nextValue
  emit('face-dimension-change', { dimension: drag.dimension, value: nextValue, final: false })
}

function stopFaceDimensionDrag(): void {
  const drag = faceDimensionDrag.value
  faceDimensionDrag.value = null
  window.removeEventListener('pointermove', handleFaceDimensionDrag)
  window.removeEventListener('pointerup', stopFaceDimensionDrag)
  window.removeEventListener('pointercancel', stopFaceDimensionDrag)
  if (!drag) return
  document.body.style.cursor = previousDimensionCursor
  previousDimensionCursor = ''
  if (drag.lastValue === drag.startValue) return
  emit('face-dimension-change', { dimension: drag.dimension, value: drag.lastValue, final: true })
}

function getElementFrame(element: Element, viewportRect: DOMRect): SelectionFrame {
  const rect = element.getBoundingClientRect()
  return {
    left: rect.left - viewportRect.left,
    top: rect.top - viewportRect.top,
    width: rect.width,
    height: rect.height,
  }
}

function measureSelection(): SelectionMeasurement | null {
  const viewport = viewportRef.value
  const stage = stageRef.value
  const selectedBlockId = props.selectedBlockId
  if (!viewport || !stage || !selectedBlockId) {
    return null
  }

  const selectedElement = stage.querySelector(`[data-block-id="${selectedBlockId}"]`)
  if (!selectedElement) {
    return null
  }

  const viewportRect = viewport.getBoundingClientRect()
  const selectedFrame = getElementFrame(selectedElement, viewportRect)

  const parentElement = props.selectedParentBlockId
    ? stage.querySelector(`[data-block-id="${props.selectedParentBlockId}"]`)
    : stage.querySelector('.card-canvas')

  if (!parentElement) {
    return null
  }

  const parentFrame = getElementFrame(parentElement, viewportRect)
  const safeScale = scale.value || 1
  return {
    frame: selectedFrame,
    parentFrame,
    worldRect: {
      left: (selectedFrame.left - parentFrame.left) / safeScale,
      top: (selectedFrame.top - parentFrame.top) / safeScale,
      width: selectedFrame.width / safeScale,
      height: selectedFrame.height / safeScale,
    },
    parentWorldWidth: parentFrame.width / safeScale,
    parentWorldHeight: parentFrame.height / safeScale,
  }
}

async function syncSelectionFrame() {
  await nextTick()
  const measurement = measureSelection()
  selectionFrame.value = measurement?.frame ?? null
}

function startResize(handle: ResizeHandle) {
  if (resizeMode.value === 'none' || isMovingSelection.value) {
    return
  }

  const measurement = measureSelection()
  if (!measurement) {
    return
  }

  activeHandle.value = handle
  isMovingSelection.value = false
  dragMeasurement.value = measurement
  previewWorldRect.value = { ...measurement.worldRect }
  transformBlockId.value = props.selectedBlockId
  selectionFrame.value = measurement.frame

  bindTransformListeners()
}

function startMove() {
  if (!showMoveHandle.value || activeHandle.value || isMovingSelection.value) {
    return
  }

  const measurement = measureSelection()
  if (!measurement) {
    return
  }

  activeHandle.value = null
  isMovingSelection.value = true
  dragMeasurement.value = measurement
  previewWorldRect.value = { ...measurement.worldRect }
  transformBlockId.value = props.selectedBlockId
  selectionFrame.value = measurement.frame

  bindTransformListeners()
}

function handleSelectionFramePointerDown(event: PointerEvent) {
  if (event.button !== 0) {
    return
  }

  event.stopPropagation()
  event.preventDefault()

  const target = event.target
  if (target instanceof Element && target.closest('.selection-handle')) {
    return
  }

  if (!showMoveHandle.value) {
    return
  }

  startMove()
}

function bindTransformListeners() {
  window.addEventListener('pointermove', handleTransformMove)
  window.addEventListener('pointerup', stopTransform)
  window.addEventListener('pointercancel', stopTransform)
}

function handleTransformMove(event: PointerEvent) {
  const measurement = dragMeasurement.value
  const preview = previewWorldRect.value
  if (!measurement || !preview) {
    return
  }

  const deltaX = event.movementX / (scale.value || 1)
  const deltaY = event.movementY / (scale.value || 1)

  if (isMovingSelection.value) {
    preview.left += deltaX
    preview.top += deltaY
  } else if (activeHandle.value) {
    const minSize = 24
    const isFlowResize = resizeMode.value === 'flow'

    switch (activeHandle.value) {
      case 'lt':
        preview.left += deltaX
        preview.top += deltaY
        preview.width -= deltaX
        preview.height -= deltaY
        break
      case 'rt':
        preview.top += deltaY
        preview.width += deltaX
        preview.height -= deltaY
        break
      case 'lb':
        preview.left += deltaX
        preview.width -= deltaX
        preview.height += deltaY
        break
      case 'rb':
        preview.width += deltaX
        preview.height += deltaY
        break
      case 'l':
        if (!isFlowResize) {
          preview.left += deltaX
        }
        preview.width -= deltaX
        break
      case 'r':
        preview.width += deltaX
        break
      case 't':
        if (!isFlowResize) {
          preview.top += deltaY
        }
        preview.height -= deltaY
        break
      case 'b':
        preview.height += deltaY
        break
    }

    if (preview.width < minSize) {
      if (!isFlowResize && (activeHandle.value === 'lt' || activeHandle.value === 'lb' || activeHandle.value === 'l')) {
        preview.left -= minSize - preview.width
      }
      preview.width = minSize
    }

    if (preview.height < minSize) {
      if (!isFlowResize && (activeHandle.value === 'lt' || activeHandle.value === 'rt' || activeHandle.value === 't')) {
        preview.top -= minSize - preview.height
      }
      preview.height = minSize
    }
  }

  selectionFrame.value = {
    left: measurement.parentFrame.left + preview.left * scale.value,
    top: measurement.parentFrame.top + preview.top * scale.value,
    width: preview.width * scale.value,
    height: preview.height * scale.value,
  }
}

function buildAbsoluteResizePayload(preview: SelectionFrame, measurement: SelectionMeasurement): ResizePayload {
  const anchor = props.selectedAnchor ?? 'lt'
  const horizontalAnchor = anchor[0]
  const verticalAnchor = anchor[1]
  const left = preview.left
  const top = preview.top
  const right = preview.left + preview.width
  const bottom = preview.top + preview.height

  let x = left
  if (horizontalAnchor === 'c') {
    x = left + preview.width / 2 - measurement.parentWorldWidth / 2
  } else if (horizontalAnchor === 'r') {
    x = measurement.parentWorldWidth - right
  }

  let y = top
  if (verticalAnchor === 'c') {
    y = top + preview.height / 2 - measurement.parentWorldHeight / 2
  } else if (verticalAnchor === 'b') {
    y = measurement.parentWorldHeight - bottom
  }

  return {
    width: preview.width,
    height: preview.height,
    x,
    y,
  }
}

function buildMovePayload(preview: SelectionFrame, measurement: SelectionMeasurement): MovePayload {
  const absolutePayload = buildAbsoluteResizePayload(preview, measurement)
  return {
    x: absolutePayload.x ?? 0,
    y: absolutePayload.y ?? 0,
  }
}

function hasMeaningfulResizeChange(preview: SelectionFrame, measurement: SelectionMeasurement): boolean {
  const resizePayload = buildAbsoluteResizePayload(preview, measurement)
  return (
    Math.abs(preview.width - measurement.worldRect.width) > TRANSFORM_EPSILON ||
    Math.abs(preview.height - measurement.worldRect.height) > TRANSFORM_EPSILON ||
    Math.abs((resizePayload.x ?? 0) - buildAbsoluteResizePayload(measurement.worldRect, measurement).x!) > TRANSFORM_EPSILON ||
    Math.abs((resizePayload.y ?? 0) - buildAbsoluteResizePayload(measurement.worldRect, measurement).y!) > TRANSFORM_EPSILON
  )
}

function hasMeaningfulMoveChange(preview: SelectionFrame, measurement: SelectionMeasurement): boolean {
  const movePayload = buildMovePayload(preview, measurement)
  const originalPayload = buildMovePayload(measurement.worldRect, measurement)
  return (
    Math.abs(movePayload.x - originalPayload.x) > TRANSFORM_EPSILON ||
    Math.abs(movePayload.y - originalPayload.y) > TRANSFORM_EPSILON
  )
}

function stopTransform() {
  const measurement = dragMeasurement.value
  const preview = previewWorldRect.value
  const blockId = transformBlockId.value
  if (measurement && preview && blockId) {
    if (activeHandle.value && hasMeaningfulResizeChange(preview, measurement)) {
      const payload = resizeMode.value === 'flow'
        ? { width: preview.width, height: preview.height }
        : buildAbsoluteResizePayload(preview, measurement)
      //console.log(payload)
      emit('resize-selection', { blockId, ...payload })
    } else if (isMovingSelection.value && hasMeaningfulMoveChange(preview, measurement)) {
      emit('move-selection', { blockId, ...buildMovePayload(preview, measurement) })
    }
  }

  activeHandle.value = null
  isMovingSelection.value = false
  dragMeasurement.value = null
  previewWorldRect.value = null
  transformBlockId.value = null
  window.removeEventListener('pointermove', handleTransformMove)
  window.removeEventListener('pointerup', stopTransform)
  window.removeEventListener('pointercancel', stopTransform)
  void syncSelectionFrame()
}

function updateViewportSize() {
  const viewport = viewportRef.value
  if (!viewport) return

  const width = viewport.clientWidth
  const height = viewport.clientHeight
  if (width === viewportWidth.value && height === viewportHeight.value) return

  viewportWidth.value = width
  viewportHeight.value = height
  emit('viewport-size-change', { width, height })
}

watch(
  () => [panX.value, panY.value, scale.value] as const,
  ([x, y, zoomScale]) => {
    const nextTransform = {
      x,
      y,
      scale: zoomScale,
    }
    if (hasSameViewportTransform(lastEmittedTransform, nextTransform)) {
      return
    }

    lastEmittedTransform = nextTransform
    pendingTransformEchoes.push(nextTransform)
    if (pendingTransformEchoes.length > 8) {
      pendingTransformEchoes.shift()
    }
    emit('viewport-transform-change', nextTransform)
  },
)

watch(
  () => props.restoreKey,
  () => {
    pendingTransformEchoes = []
    applyViewportTransform(props.transform)
    lastEmittedTransform = {
      x: panX.value,
      y: panY.value,
      scale: scale.value,
    }
    void syncSelectionFrame()
  },
)

watch(
  () => props.transform,
  (nextTransform) => {
    const echoIndex = nextTransform
      ? pendingTransformEchoes.findIndex((candidate) => hasSameViewportTransform(candidate, nextTransform))
      : -1
    if (echoIndex >= 0) {
      pendingTransformEchoes.splice(0, echoIndex + 1)
      return
    }

    if (
      !nextTransform
      || hasSameViewportTransform({
        x: panX.value,
        y: panY.value,
        scale: scale.value,
      }, nextTransform)
    ) {
      return
    }

    pendingTransformEchoes = []
    stopZoomAnimation()
    applyViewportTransform(nextTransform)
    lastEmittedTransform = { ...nextTransform }
    void syncSelectionFrame()
  },
  { deep: true },
)

onMounted(() => {
  applyViewportTransform(props.transform)
  lastEmittedTransform = {
    x: panX.value,
    y: panY.value,
    scale: scale.value,
  }
  updateViewportSize()

  if (viewportRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateViewportSize()
    })
    resizeObserver.observe(viewportRef.value)
  }

  void syncSelectionFrame()
})

onBeforeUnmount(() => {
  stopTransform()
  stopFaceDimensionDrag()
  stopZoomAnimation()
  resizeObserver?.disconnect()
  resizeObserver = null
})

defineExpose({
  zoomBy,
  zoomByWheelAt,
  resetView,
  fitView,
  nudgeSelection,
  runSelectionQuickAction,
  stepLayer,
  focusLayerBlock,
  getFocusedLayerBlockId,
  cycleLayerByInitial,
})

watch(
  () => [
    props.selectedBlockId,
    props.selectedParentBlockId,
    props.selectedLocationType,
    props.selectedAnchor,
    props.transformDisabledBlockIds.join('|'),
    scale.value,
    translateX.value,
    translateY.value,
  ],
  () => {
    if (activeHandle.value || isMovingSelection.value) {
      return
    }
    void syncSelectionFrame()
  }
)

watch(
  () => props.face,
  () => {
    if (activeHandle.value || isMovingSelection.value) {
      return
    }
    void syncSelectionFrame()
  },
  { deep: true }
)
</script>

<style scoped>
.card-viewport {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  position: relative;
  overflow: hidden;
  background-color: var(--oc-bg-raised);
  background-image: var(--oc-viewport-dot-pattern);
  background-size: var(--oc-viewport-dot-size);
  background-position: var(--oc-viewport-dot-position);
  cursor: default;
}

.card-viewport-panning {
  cursor: grabbing;
}

.card-viewport-stage {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  pointer-events: none;
  opacity: 1;
  transition: opacity var(--oc-duration-fast) var(--oc-ease);
}

.card-viewport--layer-view .card-viewport-stage {
  opacity: 0;
  pointer-events: none;
}

.card-viewport-stage :deep([data-block-id]) {
  pointer-events: auto;
}

.card-viewport--layer-view .card-viewport-stage :deep([data-block-id]) {
  pointer-events: none;
}

.card-viewport-info {
  position: absolute;
  top: 0;
  width: 228px;
  transform-origin: top left;
  pointer-events: auto;
}

.card-info-fade-enter-active {
  transition: opacity 140ms ease-out;
}

.card-info-fade-leave-active {
  transition: opacity 100ms ease-in;
  pointer-events: none;
}

.card-info-fade-enter-from,
.card-info-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .card-viewport-stage {
    transition: none;
  }
}

.card-viewport-left-info,
.card-viewport-bottom-info {
  position: absolute;
  transform-origin: center;
  pointer-events: auto;
  touch-action: none;
  user-select: none;
}

.card-viewport-left-info {
  cursor: ns-resize;
}

.card-viewport-bottom-info {
  cursor: ew-resize;
}

.card-viewport-dimension-line {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--oc-fg-default);
}

.card-viewport-dimension-line--horizontal {
  height: 16px;
}

.card-viewport-dimension-line--vertical {
  width: 16px;
}

.card-viewport-dimension-line::before,
.card-viewport-dimension-line::after {
  content: '';
  position: absolute;
  inset-inline: 0;
  top: 50%;
  height: 1px;
  background: currentColor;
  opacity: 0.34;
  transform: translateY(-50%);
  transition: opacity 140ms ease-out;
}

.card-viewport-dimension-line::after {
  inset: 3px 0;
  width: 100%;
  height: auto;
  border-inline: 1px solid currentColor;
  background: transparent;
  transform: none;
}

.card-viewport-dimension-line--vertical::before {
  inset: 0 auto;
  left: 50%;
  width: 1px;
  height: auto;
  transform: translateX(-50%);
}

.card-viewport-dimension-line--vertical::after {
  inset: 0 3px;
  width: auto;
  height: 100%;
  border-block: 1px solid currentColor;
  border-inline: 0;
}

.card-viewport-left-info:hover .card-viewport-dimension-line::before,
.card-viewport-left-info:hover .card-viewport-dimension-line::after,
.card-viewport-bottom-info:hover .card-viewport-dimension-line::before,
.card-viewport-bottom-info:hover .card-viewport-dimension-line::after,
.card-viewport-left-info:hover .card-viewport-dimension-label,
.card-viewport-bottom-info:hover .card-viewport-dimension-label {
  opacity: 1;
}

.card-viewport-dimension-label {
  position: relative;
  z-index: 1;
  display: inline-flex;
  padding: 0 5px;
  background: var(--oc-bg-raised);
  opacity: 0.34;
  transition: opacity 140ms ease-out;
}

.card-viewport-dimension-line--vertical .card-viewport-dimension-label {
  transform: rotate(-90deg);
}

.card-selection-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.selection-anchor-guide {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  color: var(--oc-accent);
  pointer-events: none;
}

.selection-anchor-guide polyline {
  fill: none;
  stroke: currentColor;
  stroke-width: 1;
  stroke-dasharray: 4 3;
  vector-effect: non-scaling-stroke;
}

.selection-anchor-guide-diagonal {
  stroke: currentColor;
  stroke-width: 1.25;
  vector-effect: non-scaling-stroke;
}

.selection-anchor-guide circle,
.selection-anchor-guide marker path {
  fill: currentColor;
}

.selection-anchor-guide-label {
  fill: var(--oc-fg-default);
  stroke: var(--oc-bg-raised);
  stroke-width: 5px;
  paint-order: stroke fill;
  font-size: var(--oc-text-xs);
  font-variant-numeric: tabular-nums;
  text-anchor: middle;
  dominant-baseline: central;
}

.selection-anchor-badge {
  position: absolute;
  z-index: 2;
  padding: 2px 4px;
  border: 1px solid var(--oc-accent);
  border-radius: 3px;
  background: var(--oc-bg-raised);
  color: var(--oc-fg-accent);
  font-size: var(--oc-text-xs);
  font-weight: 600;
  line-height: 1;
  pointer-events: none;
  transform: translateY(-50%);
}

.selection-frame {
  position: absolute;
  border-radius: 2px;
  box-shadow: 0 0 0 1px var(--oc-accent-glow);
  pointer-events: none;
  animation: selection-frame-enter 140ms ease-out;
  transition: box-shadow 100ms ease-out;
}

.selection-frame-movable {
  pointer-events: auto;
  cursor: move;
}

.selection-frame.is-resizing {
  box-shadow: 0 0 0 1px var(--oc-accent), 0 0 0 3px var(--oc-accent-glow);
}

.selection-frame.is-moving {
  box-shadow: 0 0 0 1px var(--oc-accent), 0 0 0 3px var(--oc-accent-glow);
}

.selection-quick-actions {
  position: absolute;
  left: -1px;
  bottom: calc(100% + 8px);
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 1px;
  padding: 2px;
  border: 1px solid var(--oc-border-default);
  border-radius: 4px;
  background: color-mix(in srgb, var(--oc-bg-raised) 94%, transparent);
  box-shadow: var(--oc-shadow-sm);
  pointer-events: auto;
}

.selection-quick-actions :deep(.oc-button) {
  width: var(--oc-size-md);
  height: var(--oc-size-md);
}

.selection-block-info {
  position: absolute;
  top: 0;
  left: calc(100% + 12px);
  z-index: 2;
  display: flex;
  width: max-content;
  max-width: min(240px, 35vw);
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--oc-fg-default);
  cursor: default;
  font-size: var(--oc-text-xs);
  line-height: 1.45;
  pointer-events: auto;
  transform-origin: left top;
  transition: background-color 120ms ease-out, border-color 120ms ease-out;
}

.selection-block-info:hover {
  border-color: var(--oc-border-default);
  background: color-mix(in srgb, var(--oc-bg-raised) 94%, transparent);
}

.selection-block-info__title {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
  font-weight: 600;
}

.selection-block-info__title > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selection-block-info__notes {
  overflow-wrap: anywhere;
  color: var(--oc-fg-muted);
  white-space: pre-wrap;
}

.selection-info-fade-enter-active {
  transition: opacity 140ms ease-out, transform 140ms cubic-bezier(.2, .8, .2, 1);
}

.selection-info-fade-leave-active {
  transition: opacity 100ms ease-in, transform 100ms ease-in;
}

.selection-info-fade-enter-from,
.selection-info-fade-leave-to {
  opacity: 0;
  transform: scale(.94);
}

.selection-size-label {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: max-content;
  min-height: 20px;
  padding: 2px 6px;
  border: 1px solid var(--oc-accent);
  background: color-mix(in srgb, var(--oc-bg-raised) 94%, transparent);
  box-shadow: 0 0 0 2px var(--oc-accent-glow);
  color: var(--oc-fg-accent);
  font-size: var(--oc-text-xs);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  pointer-events: none;
}

.selection-size-label--width {
  top: 100%;
  left: 50%;
  border-top: 0;
  border-radius: 0 0 5px 5px;
  transform: translateX(-50%);
}

.selection-size-label--height {
  top: 50%;
  right: 100%;
  border-right: 0;
  border-radius: 5px 0 0 5px;
  transform: translateY(-50%);
}

.selection-size-label--height > span {
  display: inline-block;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}

.selection-handle {
  box-sizing: border-box;
  position: absolute;
  z-index: 3;
  width: 14px;
  height: 14px;
  border: 0;
  background: transparent;
  pointer-events: auto;
  padding: 0;
  opacity: 1;
  animation: selection-handle-enter 140ms cubic-bezier(.2, .8, .2, 1) backwards;
  transition: opacity 100ms ease-out;
}

.selection-handle::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  border: 1px solid var(--oc-accent-fg);
  border-radius: 2px;
  background: color-mix(in srgb, var(--oc-accent) 55%, transparent);
  box-shadow: 0 0 0 1px var(--oc-handle-shadow);
  transform: translate(-50%, -50%);
  transition:
    transform 120ms cubic-bezier(.2, .8, .2, 1),
    background-color 100ms ease-out,
    box-shadow 100ms ease-out;
}

.selection-handle:hover::before,
.selection-handle:focus-visible::before {
  background: color-mix(in srgb, var(--oc-accent) 75%, transparent);
  box-shadow: 0 0 0 1px var(--oc-accent-fg), 0 0 0 3px var(--oc-accent-glow);
  transform: translate(-50%, -50%) scale(1.15);
}

.selection-handle.is-active::before {
  background: var(--oc-accent);
  box-shadow: 0 0 0 1px var(--oc-accent-fg), 0 0 0 4px var(--oc-accent-glow);
  transform: translate(-50%, -50%) scale(1.2);
}

.selection-handle:focus-visible {
  outline: none;
}

.selection-frame.is-resizing .selection-handle:not(.is-active) {
  opacity: .35;
}

.selection-frame.is-moving .selection-handle {
  opacity: .35;
}

.selection-handle:nth-child(2) {
  animation-delay: 12ms;
}

.selection-handle:nth-child(3) {
  animation-delay: 24ms;
}

.selection-handle:nth-child(4) {
  animation-delay: 36ms;
}

.selection-handle:nth-child(5) {
  animation-delay: 48ms;
}

.selection-handle:nth-child(6) {
  animation-delay: 60ms;
}

.selection-handle:nth-child(7) {
  animation-delay: 72ms;
}

.selection-handle:nth-child(8) {
  animation-delay: 84ms;
}

.selection-handle-lt {
  top: -7px;
  left: -7px;
  cursor: nwse-resize;
}

.selection-handle-rt {
  top: -7px;
  right: -7px;
  cursor: nesw-resize;
}

.selection-handle-lb {
  bottom: -7px;
  left: -7px;
  cursor: nesw-resize;
}

.selection-handle-rb {
  right: -7px;
  bottom: -7px;
  cursor: nwse-resize;
}

.selection-handle-r {
  top: calc(50% - 7px);
  right: -7px;
  cursor: ew-resize;
}

.selection-handle-l {
  top: calc(50% - 7px);
  left: -7px;
  cursor: ew-resize;
}

.selection-handle-b {
  left: calc(50% - 7px);
  bottom: -7px;
  cursor: ns-resize;
}

.selection-handle-t {
  left: calc(50% - 7px);
  top: -7px;
  cursor: ns-resize;
}

.selection-handle-l::before,
.selection-handle-r::before {
  width: 5px;
  height: 12px;
}

.selection-handle-t::before,
.selection-handle-b::before {
  width: 12px;
  height: 5px;
}

.selection-overlay-fade-enter-active {
  transition: opacity 140ms ease-out;
}

.selection-overlay-fade-leave-active {
  transition: opacity 100ms ease-in;
  pointer-events: none;
}

.selection-overlay-fade-enter-from,
.selection-overlay-fade-leave-to {
  opacity: 0;
}

@keyframes selection-frame-enter {
  from {
    opacity: 0;
  }
}

@keyframes selection-handle-enter {
  from {
    opacity: 0;
    transform: scale(.7);
  }
}

@media (prefers-reduced-motion: reduce) {
  .selection-frame,
  .selection-handle {
    animation: none;
  }

  .selection-overlay-fade-enter-active,
  .selection-overlay-fade-leave-active {
    transition: none;
  }

  .selection-frame,
  .selection-handle,
  .selection-handle::before {
    transition: none;
  }
}
</style>
