<template>
  <div :data-block-id="block.id" :style="blockStyle" @click.stop="handleClick">
    <svg class="shape-block__svg" viewBox="0 0 100 100" preserveAspectRatio="none"
      role="img" :aria-label="block.name">
      <defs v-if="closedShapePath && block.strokeAlignment !== 'center'">
        <clipPath :id="clipPathId">
          <path :d="closedShapePath" />
        </clipPath>
        <mask :id="outsideMaskId" maskUnits="userSpaceOnUse" x="-100" y="-100" width="300" height="300">
          <rect x="-100" y="-100" width="300" height="300" fill="white" />
          <path :d="closedShapePath" fill="black" />
        </mask>
      </defs>

      <line v-if="block.shape === 'line'" x1="0" y1="50" x2="100" y2="50" :style="lineStyle" />
      <template v-else>
        <path class="shape-block__fill" :d="closedShapePath" :fill="block.fill" />
        <path v-if="block.strokeWidth > 0" class="shape-block__stroke" :d="closedShapePath"
          :style="closedStrokeStyle" :clip-path="insideClipPath" :mask="outsideMask" />
      </template>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import type { CSSProperties } from 'vue'
import { getBlockBoxStyles, getPositionStyles } from '../../utils/blockStyle'
import { useCardEditorContext } from './cardEditorContext'
import type { RenderReadyShapeBlock } from './render.types'

const props = withDefaults(defineProps<{
  block: RenderReadyShapeBlock
  layoutMode?: 'absolute' | 'static'
}>(), {
  layoutMode: 'absolute',
})

const editorContext = useCardEditorContext()
const isTransformDisabled = computed(() => editorContext.transformDisabledBlockIds.value.has(props.block.id))

const blockStyle = computed(() => props.layoutMode === 'absolute'
  ? getPositionStyles(props.block, { disableTransform: isTransformDisabled.value })
  : getBlockBoxStyles(props.block, { disableTransform: isTransformDisabled.value }))

const definitionId = useId().replace(/:/g, '')
const clipPathId = 'shape-clip-' + definitionId
const outsideMaskId = 'shape-outside-' + definitionId

const closedShapePath = computed(() => {
  if (props.block.shape === 'rectangle') return 'M0 0H100V100H0Z'
  if (props.block.shape === 'ellipse') return 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z'
  if (props.block.shape === 'triangle') return 'M50 0L100 100H0Z'
  if (props.block.shape === 'diamond') return 'M50 0L100 50L50 100L0 50Z'
  return ''
})

const insideClipPath = computed(() =>
  props.block.strokeAlignment === 'inside' ? 'url(#' + clipPathId + ')' : undefined
)
const outsideMask = computed(() =>
  props.block.strokeAlignment === 'outside' ? 'url(#' + outsideMaskId + ')' : undefined
)

const dashArray = computed(() => {
  if (props.block.strokeStyle === 'dashed') return '8 5'
  if (props.block.strokeStyle === 'dotted') return '2 4'
  return undefined
})

const effectiveClosedStrokeWidth = computed(() =>
  props.block.strokeAlignment === 'center' ? props.block.strokeWidth : props.block.strokeWidth * 2
)

function createStrokeStyle(width: number): CSSProperties {
  return {
    fill: 'none',
    stroke: props.block.stroke,
    strokeWidth: width,
    strokeDasharray: dashArray.value,
    strokeLinejoin: props.block.strokeJoin,
    strokeLinecap: props.block.strokeCap,
    strokeMiterlimit: props.block.strokeMiterLimit,
    vectorEffect: 'non-scaling-stroke',
  }
}

const closedStrokeStyle = computed<CSSProperties>(() =>
  createStrokeStyle(effectiveClosedStrokeWidth.value)
)
const lineStyle = computed<CSSProperties>(() =>
  createStrokeStyle(props.block.strokeWidth)
)

function handleClick(event: MouseEvent): void {
  editorContext.handleBlockClick(props.block.id, event)
}
</script>

<style scoped>
.shape-block__svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
</style>
