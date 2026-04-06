<template>
    <div ref="cardCanvasRef" class="card-canvas" :style="canvasStyle">
        <div v-for="child in visibleChildren" :key="child.block.id" :style="getChildStyle(child)">
            <CardBlock :block="child.block" layout-mode="static" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import { CardDocument } from '../../core/Card'
import { getAbsolutePositionStyles } from '../../utils/blockStyle'
import CardBlock from './CardBlock.vue'
import { cardEditorContextKey } from './cardEditorContext'

const emit = defineEmits<{
    (e: 'block-click', blockId: string, event: MouseEvent): void
}>()

const props = withDefaults(defineProps<{
    document: CardDocument
    transformDisabledBlockIds?: string[]
    visibleRootBlockIds?: string[]
}>(), {
    transformDisabledBlockIds: () => [],
    visibleRootBlockIds: () => [],
})

const cardCanvasRef = ref<HTMLElement>()

const normalizedTransformDisabledBlockIds = computed(() => new Set(props.transformDisabledBlockIds))
const normalizedVisibleRootBlockIds = computed(() => new Set(props.visibleRootBlockIds))

const canvasStyle = computed((): Record<string, string> => ({
    position: 'relative',
    width: `${props.document.width}px`,
    height: `${props.document.height}px`,
    background: '#fff',
}))

const visibleChildren = computed(() => {
    if (normalizedVisibleRootBlockIds.value.size === 0) {
        return props.document.children
    }

    return props.document.children.filter(child =>
        normalizedVisibleRootBlockIds.value.has(child.block.id)
    )
})

function getChildStyle(child: CardDocument['children'][number]) {
    const zIndex = child.block.zIndex !== undefined ? `; z-index: ${child.block.zIndex}` : ''
    return `position: absolute; ${getAbsolutePositionStyles(child.location)}${zIndex}`
}

provide(cardEditorContextKey, {
    transformDisabledBlockIds: normalizedTransformDisabledBlockIds,
    handleBlockClick: (blockId, event) => {
        emit('block-click', blockId, event)
    },
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
