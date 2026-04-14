<template>
    <div ref="cardCanvasRef" class="card-canvas" :style="canvasStyle">
        <CardBlock :block="rootContainerBlock" layout-mode="static" />
    </div>
</template>

<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import type { CardDocument, SimpleContainerBlock } from '../../core/Card'
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
const rootContainerBlock = computed<SimpleContainerBlock>(() => ({
    type: 'simple-container-block',
    id: props.document.id,
    name: props.document.name,
    width: `${props.document.width}px`,
    height: `${props.document.height}px`,
    children: visibleChildren.value,
}))

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
