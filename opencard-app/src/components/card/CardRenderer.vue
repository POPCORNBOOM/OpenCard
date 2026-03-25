<template>
    <div ref="cardCanvasRef" class="card-canvas" :style="canvasStyle">
        <div v-for="child in document.children" :key="child.block.id" :style="getChildStyle(child.location)">
            <CardBlock :block="child.block" layout-mode="static" :use-wrapper="useWrapper" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import { CardDocument } from '../../core/Card'
import { getAbsolutePositionStyles } from '../../utils/blockStyle'
import CardBlock from './CardBlock.vue'
import { cardEditorContextKey } from './cardEditorContext'

const props = withDefaults(defineProps<{
    document: CardDocument
    selectedBlockIds?: string[]
    useWrapper?: boolean
}>(), {
    selectedBlockIds: () => [],
    useWrapper: true,
})

const cardCanvasRef = ref<HTMLElement>()

const normalizedSelectedBlockIds = computed(() => new Set(props.selectedBlockIds))

const canvasStyle = computed((): Record<string, string> => ({
    position: 'relative',
    width: `${props.document.width}px`,
    height: `${props.document.height}px`,
    background: '#fff',
}))

function getChildStyle(location: CardDocument['children'][number]['location']) {
    return `position: absolute; ${getAbsolutePositionStyles(location)}`
}

provide(cardEditorContextKey, {
    selectedBlockIds: normalizedSelectedBlockIds,
})

defineExpose({
    getCanvasElement: () => cardCanvasRef.value,
})
</script>

<style scoped>
.card-canvas {
    user-select: none;
    display: inline-block;
}
</style>
