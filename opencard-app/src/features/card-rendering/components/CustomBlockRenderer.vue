<template>
  <div :data-block-id="block.id" :style="blockStyle" @click.stop="handleClick">
    <span v-if="block.error">{{ block.error }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getPositionStyles } from '../../../utils/blockStyle'
import { useCardEditorContext } from './cardEditorContext'
import type { RenderReadyCustomBlock } from '../render.types'

const props = withDefaults(defineProps<{
  block: RenderReadyCustomBlock
  layoutMode?: 'absolute' | 'static'
}>(), { layoutMode: 'absolute' })
const editorContext = useCardEditorContext()
const blockStyle = computed(() => props.layoutMode === 'absolute'
  ? getPositionStyles(props.block, { disableTransform: false })
  : `width: ${props.block.width}; height: ${props.block.height}`)

function handleClick(event: MouseEvent): void {
  editorContext.handleBlockClick(props.block.id, event)
}
</script>
