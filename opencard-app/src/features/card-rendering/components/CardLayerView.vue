<template>
  <div
    ref="rootRef"
    class="card-layer-view"
    @pointerup="handlePointerUp"
    @wheel.stop.prevent="handleWheel"
  >
    <div class="card-layer-view__stack">
      <section
        v-for="(layer, layerIndex) in layers"
        :key="layer.zIndex"
        class="card-layer-view__level"
        :class="{ 'is-active': layerIndex === activeLayerIndex }"
        :style="getLayerStyle(layerIndex)"
        :aria-label="`z-index ${formatZIndex(layer.zIndex)}`"
      >
        <button
          v-for="(snapshot, blockIndex) in getLayerSnapshots(layer)"
          :key="snapshot.id"
          type="button"
          class="card-layer-view__block-plane"
          :class="{ 'is-selected': snapshot.id === selectedBlockId }"
          :style="getBlockPlaneStyle(blockIndex, layer, layerIndex)"
          :data-layer-block-id="snapshot.id"
          :data-layer-index="layerIndex"
          :tabindex="getPlaneIndex(layerIndex, blockIndex) === activePlaneIndex ? 0 : -1"
          :aria-label="snapshot.name"
        >
          <span class="card-layer-view__plane" aria-hidden="true" />
          <span
            v-if="isLayerStart(getPlaneIndex(layerIndex, blockIndex))"
            class="card-layer-view__plane-index"
            aria-hidden="true"
          >
            Layer {{ formatZIndex(layer.zIndex) }}
          </span>
          <span
            class="card-layer-view__block"
            :style="getBlockStyle(snapshot, layer)"
          >
            <span class="card-layer-view__block-content" v-html="snapshot.html" />
          </span>
        </button>
      </section>
    </div>

    <nav class="card-layer-view__rail" :style="railStyle" aria-label="Layer ruler" data-layer-rail>
      <span class="card-layer-view__rail-line" aria-hidden="true" />
      <button
        v-for="(entry, index) in planeEntries"
        :key="entry.id"
        type="button"
        class="card-layer-view__tick"
        :class="{
          'is-active': index === activePlaneIndex,
          'is-selected': entry.id === selectedBlockId,
        }"
        :style="getTickStyle(index)"
        :aria-label="`${getPlaneName(entry)}, z-index ${formatZIndex(getPlaneZIndex(entry))}`"
        :data-layer-target-index="index"
      >
        <span
          v-if="isLayerBoundary(index)"
          class="card-layer-view__layer-boundary"
          :style="getLayerBoundaryStyle(index)"
          aria-hidden="true"
        >
          <span class="card-layer-view__layer-boundary-index card-layer-view__layer-boundary-index--upper">
            {{ formatZIndex(getPreviousLayerZIndex(index)) }}
          </span>
          <span class="card-layer-view__layer-boundary-index card-layer-view__layer-boundary-index--lower">
            {{ formatZIndex(getPlaneZIndex(entry)) }}
          </span>
        </span>
        <span class="card-layer-view__tick-name">{{ getPlaneName(entry) }}</span>
      </button>
      <span class="card-layer-view__thumb" :style="thumbStyle" aria-hidden="true" />
    </nav>

    <aside
      v-if="shortcutHints?.length"
      class="card-layer-view__shortcut-legend"
      :aria-label="shortcutLegendLabel"
    >
      <div v-for="hint in shortcutHints" :key="hint.label" class="card-layer-view__shortcut-row">
        <span class="card-layer-view__shortcut-keys" aria-hidden="true">
          <template v-for="(key, keyIndex) in hint.keys" :key="keyIndex">
            <span v-if="typeof key === 'string'" class="app-tooltip-layer__chip">{{ key }}</span>
            <span v-else-if="'icon' in key" class="app-tooltip-layer__chip">
              <OcIcon :name="key.icon" size="sm" />
            </span>
            <span v-else class="card-layer-view__shortcut-separator">{{ key.separator }}</span>
          </template>
        </span>
        <span class="card-layer-view__shortcut-label">{{ hint.label }}</span>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import { pinyin } from 'pinyin-pro'
import OcIcon from '../../../components/base/OcIcon.vue'
import type { IconToken } from '../../../shared/ui/icon/iconRegistry'
import type { RenderReadyCardFace } from '../render.types'
import { buildCardLayerGroups, type CardLayerGroup } from './cardLayerModel'

type Snapshot = {
  id: string
  name: string
  html: string
  width: number
  height: number
  x: number
  y: number
}

type PlaneEntry = {
  id: string
  layerIndex: number
  blockIndex: number
}

type ShortcutKey = string | { icon: IconToken } | { separator: string }

const POSITION_EPSILON = 0.002
const POSITION_SMOOTHING = 0.22
const WHEEL_FOCUS_THRESHOLD = 40
const WHEEL_RESET_DELAY = 140
const RULER_TICK_PITCH = 30
const RULER_LAYER_PITCH = 72
const RULER_STACK_GAP = 28

const props = defineProps<{
  face: RenderReadyCardFace
  sourceRoot: HTMLElement | null
  selectedBlockId?: string | null
  viewportWidth: number
  viewportHeight: number
  spaceModifierActive?: boolean
  shortcutLegendLabel?: string
  shortcutHints?: Array<{ keys: ShortcutKey[]; label: string }>
}>()

const emit = defineEmits<{
  (e: 'block-click', blockId: string, event: PointerEvent): void
  (e: 'z-index-step', payload: { delta: -1 | 1; existingLayersOnly: boolean }): void
}>()

const rootRef = ref<HTMLElement | null>(null)
const layers = computed(() => buildCardLayerGroups(props.face))
const snapshots = ref(new Map<string, Snapshot>())
const layerPosition = ref(0)
const targetLayerPosition = ref(0)
const focusedPlaneIndex = ref(0)
let animationFrame: number | null = null
let accumulatedWheelDelta = 0
let wheelResetTimer: number | null = null

const planeEntries = computed<PlaneEntry[]>(() => layers.value.flatMap((layer, layerIndex) => (
  layer.blocks.map((block, blockIndex) => ({ id: block.id, layerIndex, blockIndex }))
)))
const activePlaneIndex = computed(() => focusedPlaneIndex.value)
const activeLayerIndex = computed(() => planeEntries.value[activePlaneIndex.value]?.layerIndex ?? 0)
const planeScale = computed(() => {
  const radians = Math.PI / 180
  const projectedWidth = props.face.width * Math.cos(24 * radians)
    + props.face.height * Math.cos(56 * radians) * Math.sin(24 * radians)
  const projectedHeight = props.face.width * Math.sin(24 * radians)
    + props.face.height * Math.cos(56 * radians) * Math.cos(24 * radians)
  return Math.max(0.035, Math.min(
    0.62,
    props.viewportWidth * 0.58 / Math.max(1, projectedWidth),
    props.viewportHeight * 0.5 / Math.max(1, projectedHeight),
  ))
})
const layerPitch = computed(() => Math.min(400, Math.max(220, props.viewportHeight * 0.36)))
const sameLayerPitch = computed(() => Math.min(180, Math.max(110, props.viewportHeight * 0.16)))
const planeOffsets = computed(() => {
  const offsets = [0]
  for (let index = 1; index < planeEntries.value.length; index += 1) {
    const sameLayer = planeEntries.value[index - 1]?.layerIndex === planeEntries.value[index]?.layerIndex
    offsets.push(offsets[index - 1]! + (sameLayer ? sameLayerPitch.value : layerPitch.value))
  }
  return offsets
})
const rulerOffsets = computed(() => {
  const offsets = [0]
  for (let index = 1; index < planeEntries.value.length; index += 1) {
    const sameLayer = planeEntries.value[index - 1]?.layerIndex === planeEntries.value[index]?.layerIndex
    offsets.push(offsets[index - 1]! + (sameLayer ? RULER_TICK_PITCH : RULER_LAYER_PITCH))
  }
  return offsets
})
const thumbStyle = computed<CSSProperties>(() => ({
  top: `${props.viewportHeight / 2}px`,
}))
const railStyle = computed<CSSProperties>(() => {
  const radians = Math.PI / 180
  const projectedHalfWidth = (
    props.face.width * planeScale.value * Math.cos(24 * radians)
    + props.face.height * planeScale.value * Math.cos(56 * radians) * Math.sin(24 * radians)
  ) / 2
  const stackCenterX = props.viewportWidth / 2 - 40
  const left = stackCenterX + projectedHalfWidth + RULER_STACK_GAP
  return {
    left: `${left}px`,
    width: `${Math.max(96, Math.min(180, props.viewportWidth - left - 12))}px`,
  }
})

function clampIndex(value: number): number {
  return Math.min(Math.max(value, 0), Math.max(0, planeEntries.value.length - 1))
}

function formatZIndex(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
}

function getRailY(index: number): number {
  const focusedOffset = rulerOffsets.value[focusedPlaneIndex.value] ?? 0
  return props.viewportHeight / 2 + (rulerOffsets.value[index] ?? 0) - focusedOffset
}

function getPlaneZIndex(entry: PlaneEntry): number {
  return layers.value[entry.layerIndex]?.zIndex ?? 0
}

function getPlaneName(entry: PlaneEntry): string {
  return layers.value[entry.layerIndex]?.blocks[entry.blockIndex]?.block.name || entry.id
}

function isLayerStart(index: number): boolean {
  if (index === 0) return true
  return getPlaneZIndex(planeEntries.value[index]!) !== getPlaneZIndex(planeEntries.value[index - 1]!)
}

function isLayerBoundary(index: number): boolean {
  return index > 0 && isLayerStart(index)
}

function getPreviousLayerZIndex(index: number): number {
  const previous = planeEntries.value[index - 1]
  return previous ? getPlaneZIndex(previous) : getPlaneZIndex(planeEntries.value[index]!)
}

function getLayerBoundaryStyle(index: number): CSSProperties {
  const gap = (rulerOffsets.value[index] ?? 0) - (rulerOffsets.value[index - 1] ?? 0)
  return { top: `${12 - gap / 2}px` }
}

function getTickStyle(index: number): CSSProperties {
  const distance = Math.abs(index - focusedPlaneIndex.value)
  return {
    top: `${getRailY(index)}px`,
    fontSize: `${10.5 + 13.5 * Math.exp(-1.4 * distance)}px`,
    fontWeight: index === focusedPlaneIndex.value ? '600' : '400',
  }
}

function getLayerStyle(index: number): CSSProperties {
  return {
    pointerEvents: index === activeLayerIndex.value ? 'auto' : 'none',
  }
}

function getPlaneIndex(layerIndex: number, blockIndex: number): number {
  return planeEntries.value.findIndex(entry => (
    entry.layerIndex === layerIndex && entry.blockIndex === blockIndex
  ))
}

function getBlockPlaneStyle(
  blockIndex: number,
  _layer: CardLayerGroup,
  layerIndex: number,
): CSSProperties {
  const planeIndex = getPlaneIndex(layerIndex, blockIndex)
  const distance = planeIndex - layerPosition.value
  const absoluteDistance = Math.abs(distance)
  const focusDistance = Math.abs(planeIndex - focusedPlaneIndex.value)
  const lowerIndex = Math.floor(layerPosition.value)
  const upperIndex = Math.ceil(layerPosition.value)
  const progress = layerPosition.value - lowerIndex
  const currentOffset = (planeOffsets.value[lowerIndex] ?? 0) * (1 - progress)
    + (planeOffsets.value[upperIndex] ?? planeOffsets.value[lowerIndex] ?? 0) * progress
  return {
    width: `${props.face.width * planeScale.value}px`,
    height: `${props.face.height * planeScale.value}px`,
    opacity: String(Math.max(0.025, Math.exp(-1.5 * focusDistance))),
    transform: `translate(-50%, -50%) translate3d(0, ${(planeOffsets.value[planeIndex] ?? 0) - currentOffset}px, ${-absoluteDistance * 54}px) rotateX(56deg) rotateZ(-24deg)`,
    zIndex: String(100 - Math.round(absoluteDistance * 10)),
  }
}

function getLayerSnapshots(layer: CardLayerGroup): Snapshot[] {
  return layer.blocks.flatMap(block => {
    const snapshot = snapshots.value.get(block.id)
    return snapshot ? [snapshot] : []
  })
}

function getBlockStyle(snapshot: Snapshot, _layer: CardLayerGroup): CSSProperties {
  const scale = planeScale.value
  return {
    left: `${snapshot.x * scale}px`,
    top: `${snapshot.y * scale}px`,
    width: `${snapshot.width * scale}px`,
    height: `${snapshot.height * scale}px`,
    '--layer-block-scale': String(scale),
    '--layer-block-width': `${snapshot.width}px`,
    '--layer-block-height': `${snapshot.height}px`,
  }
}

function removeDuplicateIds(root: Element): void {
  root.removeAttribute('id')
  root.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'))
}

function rebuildSnapshots(): void {
  const sourceRoot = props.sourceRoot
  const nextSnapshots = new Map<string, Snapshot>()
  if (!sourceRoot) {
    snapshots.value = nextSnapshots
    return
  }

  const sourceBlocks = [...sourceRoot.querySelectorAll<HTMLElement>('[data-block-id]')]
  const faceElement = sourceRoot.querySelector<HTMLElement>('.card-canvas') ?? sourceRoot
  const faceRect = faceElement.getBoundingClientRect()
  const coordinateScaleX = faceRect.width > 0 ? props.face.width / faceRect.width : 1
  const coordinateScaleY = faceRect.height > 0 ? props.face.height / faceRect.height : 1
  layers.value.flatMap(layer => layer.blocks).forEach(({ id, block }) => {
    const source = sourceBlocks.find(element => element.dataset.blockId === id)
    if (!source) return

    const clone = source.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[data-block-id]').forEach(element => element.remove())
    clone.removeAttribute('data-block-id')
    clone.style.position = 'relative'
    clone.style.inset = 'auto'
    clone.style.left = '0'
    clone.style.top = '0'
    clone.style.width = '100%'
    clone.style.height = '100%'
    removeDuplicateIds(clone)
    const rect = source.getBoundingClientRect()
    nextSnapshots.set(id, {
      id,
      name: block.name || id,
      html: clone.outerHTML,
      width: Math.max(1, rect.width * coordinateScaleX || source.offsetWidth),
      height: Math.max(1, rect.height * coordinateScaleY || source.offsetHeight),
      x: (rect.left - faceRect.left) * coordinateScaleX,
      y: (rect.top - faceRect.top) * coordinateScaleY,
    })
  })
  snapshots.value = nextSnapshots
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function stopAnimation(): void {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame)
  animationFrame = null
}

function animateToTarget(): void {
  stopAnimation()
  if (prefersReducedMotion()) {
    layerPosition.value = targetLayerPosition.value
    return
  }

  const tick = () => {
    const delta = targetLayerPosition.value - layerPosition.value
    if (Math.abs(delta) <= POSITION_EPSILON) {
      layerPosition.value = targetLayerPosition.value
      animationFrame = null
      return
    }
    layerPosition.value += delta * POSITION_SMOOTHING
    animationFrame = requestAnimationFrame(tick)
  }
  animationFrame = requestAnimationFrame(tick)
}

function focusPlane(value: number): void {
  focusedPlaneIndex.value = clampIndex(Math.round(value))
  targetLayerPosition.value = focusedPlaneIndex.value
  animateToTarget()
}

function stepLayer(direction: -1 | 1, wholeLayer = false): void {
  if (!wholeLayer) {
    focusPlane(focusedPlaneIndex.value + direction)
    return
  }

  const currentLayerIndex = planeEntries.value[focusedPlaneIndex.value]?.layerIndex
  if (currentLayerIndex === undefined) return
  if (direction > 0) {
    const targetIndex = planeEntries.value.findIndex(entry => entry.layerIndex > currentLayerIndex)
    focusPlane(targetIndex >= 0 ? targetIndex : focusedPlaneIndex.value)
    return
  }

  let targetIndex = -1
  for (let index = focusedPlaneIndex.value - 1; index >= 0; index -= 1) {
    if (planeEntries.value[index]?.layerIndex < currentLayerIndex) {
      targetIndex = index
      break
    }
  }
  focusPlane(targetIndex >= 0 ? targetIndex : focusedPlaneIndex.value)
}

function scheduleWheelReset(): void {
  if (wheelResetTimer !== null) window.clearTimeout(wheelResetTimer)
  wheelResetTimer = window.setTimeout(() => {
    accumulatedWheelDelta = 0
    wheelResetTimer = null
  }, WHEEL_RESET_DELAY)
}

function handleWheel(event: WheelEvent): void {
  if (planeEntries.value.length === 0) return
  const normalizedDelta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? event.deltaY * 16
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? event.deltaY * props.viewportHeight
      : event.deltaY
  if (accumulatedWheelDelta !== 0 && Math.sign(accumulatedWheelDelta) !== Math.sign(normalizedDelta)) {
    accumulatedWheelDelta = 0
  }
  accumulatedWheelDelta += normalizedDelta
  scheduleWheelReset()
  if (Math.abs(accumulatedWheelDelta) < WHEEL_FOCUS_THRESHOLD) return

  const direction = accumulatedWheelDelta > 0 ? 1 : -1
  accumulatedWheelDelta = 0
  if (props.spaceModifierActive) {
    emit('z-index-step', {
      delta: direction < 0 ? 1 : -1,
      existingLayersOnly: event.shiftKey,
    })
    return
  }
  stepLayer(direction, event.shiftKey)
}

function handlePointerUp(event: PointerEvent): void {
  if (event.button !== 0) return
  const target = event.target instanceof Element ? event.target : null
  const block = target?.closest<HTMLElement>('[data-layer-block-id]')
  const blockLayerIndex = block?.dataset.layerIndex
  if (block?.dataset.layerBlockId && Number(blockLayerIndex) === activeLayerIndex.value) {
    emit('block-click', block.dataset.layerBlockId, event)
    return
  }
  const targetIndex = target?.closest<HTMLElement>('[data-layer-target-index]')?.dataset.layerTargetIndex
  if (targetIndex !== undefined) focusPlane(Number(targetIndex))
}

function selectInitialLayer(): void {
  const selectedIndex = props.selectedBlockId
    ? planeEntries.value.findIndex(entry => entry.id === props.selectedBlockId)
    : -1
  layerPosition.value = selectedIndex >= 0
    ? selectedIndex
    : Math.max(0, Math.floor((planeEntries.value.length - 1) / 2))
  focusedPlaneIndex.value = clampIndex(layerPosition.value)
  targetLayerPosition.value = layerPosition.value
}

function focusBlock(blockId: string): void {
  const index = planeEntries.value.findIndex(entry => entry.id === blockId)
  if (index >= 0) focusPlane(index)
}

function getFocusedBlockId(): string | null {
  return planeEntries.value[focusedPlaneIndex.value]?.id ?? null
}

function getNameInitial(name: string): string | undefined {
  const firstCharacter = Array.from(name.trimStart())[0]
  if (!firstCharacter) return undefined
  if (/^\p{Script=Han}$/u.test(firstCharacter)) {
    return pinyin(firstCharacter, { pattern: 'first', toneType: 'none' })
      .charAt(0)
      .toLocaleLowerCase()
  }
  return firstCharacter.toLocaleLowerCase()
}

function cycleLayerByInitial(initial: string, currentLayerOnly = false): boolean {
  const initialLetter = getNameInitial(initial)
  const entryCount = planeEntries.value.length
  if (!initialLetter || entryCount === 0) return false

  const focusedLayerIndex = planeEntries.value[focusedPlaneIndex.value]?.layerIndex
  for (let offset = 1; offset <= entryCount; offset += 1) {
    const index = (focusedPlaneIndex.value + offset) % entryCount
    const entry = planeEntries.value[index]
    if (!entry || (currentLayerOnly && entry.layerIndex !== focusedLayerIndex)) continue
    const nameInitial = getNameInitial(getPlaneName(entry))
    if (nameInitial !== initialLetter) continue
    focusPlane(index)
    return true
  }
  return false
}

watch(() => [props.face, props.sourceRoot, props.viewportWidth, props.viewportHeight], async () => {
  await nextTick()
  rebuildSnapshots()
}, { deep: true })

watch(planeEntries, () => {
  const next = clampIndex(focusedPlaneIndex.value)
  focusedPlaneIndex.value = next
  layerPosition.value = next
  targetLayerPosition.value = next
})

onMounted(() => {
  selectInitialLayer()
  rebuildSnapshots()
})

onBeforeUnmount(() => {
  stopAnimation()
  if (wheelResetTimer !== null) window.clearTimeout(wheelResetTimer)
})

defineExpose({ stepLayer, handleWheel, focusBlock, getFocusedBlockId, cycleLayerByInitial })
</script>

<style scoped>
.card-layer-view {
  position: absolute;
  inset: 0;
  z-index: 6;
  overflow: hidden;
  user-select: none;
  touch-action: none;
  perspective: 1400px;
  background: color-mix(in srgb, var(--oc-bg-raised) 24%, transparent);
  animation: layer-view-enter var(--oc-duration-normal) var(--oc-ease) both;
}

.card-layer-view__stack {
  position: absolute;
  inset: 0 112px 0 32px;
  transform-style: preserve-3d;
}

.card-layer-view__level {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transition: opacity var(--oc-duration-fast) var(--oc-ease);
  will-change: transform, opacity;
}

.card-layer-view__block-plane {
  position: absolute;
  left: 50%;
  top: 50%;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  transform-style: preserve-3d;
  pointer-events: none;
  cursor: pointer;
  will-change: transform;
  transition: opacity var(--oc-duration-fast) var(--oc-ease);
}

.card-layer-view__plane {
  position: absolute;
  inset: 0;
  border: 1px solid color-mix(in srgb, var(--oc-fg-default) 28%, transparent);
  background: color-mix(in srgb, var(--oc-bg-base) 62%, transparent);
  box-shadow: 24px 30px 44px color-mix(in srgb, #000000 17%, transparent);
  pointer-events: none;
}

.card-layer-view__block {
  position: absolute;
  display: block;
  padding: 0;
  overflow: visible;
  border: 0;
  border-radius: 2px;
  color: inherit;
  background: transparent;
  pointer-events: none;
}

.card-layer-view__level.is-active .card-layer-view__block-plane {
  pointer-events: auto;
}

.card-layer-view__block-plane:hover .card-layer-view__plane,
.card-layer-view__block-plane:focus-visible .card-layer-view__plane {
  border-color: color-mix(in srgb, var(--oc-accent) 76%, var(--oc-fg-default));
  box-shadow:
    24px 30px 44px color-mix(in srgb, #000000 17%, transparent),
    0 0 0 2px color-mix(in srgb, var(--oc-accent) 58%, transparent);
}

.card-layer-view__block-plane:focus-visible {
  outline: none;
}

.card-layer-view__block-plane.is-selected .card-layer-view__plane {
  border-color: var(--oc-accent);
  box-shadow:
    24px 30px 44px color-mix(in srgb, #000000 17%, transparent),
    0 0 0 2px color-mix(in srgb, var(--oc-accent) 72%, transparent),
    0 0 24px color-mix(in srgb, var(--oc-accent) 20%, transparent);
}

.card-layer-view__plane-index {
  position: absolute;
  left: 0;
  top: -8px;
  color: var(--oc-fg-default);
  font-size: 32px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  pointer-events: none;
  transform: translateY(-100%);
}

.card-layer-view__block-content {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  width: var(--layer-block-width);
  height: var(--layer-block-height);
  overflow: hidden;
  pointer-events: none;
  transform: scale(var(--layer-block-scale));
  transform-origin: 0 0;
}

.card-layer-view__block-content :deep(*) {
  pointer-events: none !important;
}

.card-layer-view__rail {
  position: absolute;
  top: 0;
  bottom: 0;
  overflow: visible;
  pointer-events: auto;
}

.card-layer-view__rail-line {
  position: absolute;
  top: 18px;
  bottom: 18px;
  left: 8px;
  width: 1px;
  background: color-mix(in srgb, var(--oc-fg-default) 28%, transparent);
}

.card-layer-view__tick {
  position: absolute;
  left: 2px;
  width: max-content;
  min-width: 100%;
  height: 24px;
  padding: 0 0 0 20px;
  border: 0;
  color: var(--oc-fg-subtle);
  background: transparent;
  font: inherit;
  font-size: var(--oc-text-xs);
  font-variant-numeric: tabular-nums;
  text-align: left;
  transform: translateY(-50%);
  cursor: pointer;
  transition:
    top var(--oc-duration-normal) var(--oc-ease),
    font-size var(--oc-duration-fast) var(--oc-ease),
    color var(--oc-duration-fast) var(--oc-ease);
}

.card-layer-view__tick::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 2px;
  width: 8px;
  height: 1px;
  background: currentColor;
}

.card-layer-view__tick:hover,
.card-layer-view__tick:focus-visible,
.card-layer-view__tick.is-active {
  color: var(--oc-fg-default);
  outline: none;
}

.card-layer-view__tick.is-selected {
  color: var(--oc-fg-accent);
}

.card-layer-view__tick-name {
  display: block;
  white-space: nowrap;
}

.card-layer-view__layer-boundary {
  position: absolute;
  left: 2px;
  width: 8px;
  height: 1px;
  background: color-mix(in srgb, var(--oc-fg-default) 38%, transparent);
  pointer-events: none;
}

.card-layer-view__layer-boundary-index {
  position: absolute;
  right: 12px;
  color: var(--oc-fg-subtle);
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  white-space: nowrap;
}

.card-layer-view__layer-boundary-index--upper {
  bottom: 6px;
}

.card-layer-view__layer-boundary-index--lower {
  top: 6px;
}

.card-layer-view__thumb {
  position: absolute;
  left: 8px;
  width: 13px;
  height: 13px;
  border: 2px solid var(--oc-bg-raised);
  border-radius: 50%;
  background: var(--oc-accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--oc-accent) 55%, transparent);
  transform: translate(-50%, -50%);
  will-change: top;
}

.card-layer-view__shortcut-legend {
  position: absolute;
  left: 18px;
  bottom: 18px;
  z-index: 120;
  display: grid;
  gap: 6px;
  color: var(--oc-fg-subtle);
  font-size: var(--oc-text-xs);
  pointer-events: none;
}

.card-layer-view__shortcut-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 20px;
}

.card-layer-view__shortcut-keys {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.card-layer-view__shortcut-separator {
  margin: 0 1px;
  color: var(--oc-fg-muted);
}

.card-layer-view__shortcut-label {
  white-space: nowrap;
}

@keyframes layer-view-enter {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .card-layer-view,
  .card-layer-view__level,
  .card-layer-view__block,
  .card-layer-view__tick {
    animation: none;
    transition: none;
  }
}
</style>
