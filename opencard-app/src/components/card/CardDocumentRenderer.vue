<!-- 卡片文档渲染器：只接收可直接渲染的完整文档，并可选择裁切超出文档尺寸的内容。 -->
<template>
    <div ref="cardCanvasRef" class="card-canvas" :class="{ 'card-canvas--clipped': props.clipToDocument }"
        :style="canvasStyle">
        <CardBlockRenderer :block="rootContainerBlock" layout-mode="static" />
    </div>
</template>

<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import CardBlockRenderer from './CardBlockRenderer.vue'
import { cardEditorContextKey } from './cardEditorContext'
import type { RenderReadyCardDocument, RenderReadySimpleContainerBlock } from './render.types'

const emit = defineEmits<{
    /** 块点击事件：上抛被点击 blockId 与原始鼠标事件。 */
    (e: 'block-click', blockId: string, event: MouseEvent): void
}>()

const props = withDefaults(defineProps<{
    /** 已完成解析、校验和默认值回退的卡片文档。 */
    cardDocument: RenderReadyCardDocument
    /** 不允许被变换的块 ID 列表。 */
    transformDisabledBlockIds?: string[]
    /** 根层可见块 ID 列表（为空时显示全部）。 */
    visibleRootBlockIds?: string[]
    /** 是否裁切超出文档尺寸的内容。 */
    clipToDocument?: boolean
}>(), {
    transformDisabledBlockIds: () => [],
    visibleRootBlockIds: () => [],
    clipToDocument: false,
})

const cardCanvasRef = ref<HTMLElement>()

const normalizedTransformDisabledBlockIds = computed(() => new Set(props.transformDisabledBlockIds))
const normalizedVisibleRootBlockIds = computed(() => new Set(props.visibleRootBlockIds))

const canvasStyle = computed((): Record<string, string> => ({
    position: 'relative',
    width: `${props.cardDocument.width}px`,
    height: `${props.cardDocument.height}px`,
    background: props.cardDocument.background,
}))

const visibleChildren = computed(() => {
    if (normalizedVisibleRootBlockIds.value.size === 0) {
        return props.cardDocument.children
    }

    return props.cardDocument.children.filter(child =>
        normalizedVisibleRootBlockIds.value.has(child.block.id)
    )
})
const rootContainerBlock = computed<RenderReadySimpleContainerBlock>(() => {
    return {
        type: 'simple-container-block',
        id: props.cardDocument.id,
        name: props.cardDocument.name,
        width: `${props.cardDocument.width}px`,
        height: `${props.cardDocument.height}px`,
        children: visibleChildren.value,
        borderColor: '#000000',
        borderWidth: 0,
        borderStyle: 'solid',
        borderRadius: '',
        background: props.cardDocument.background,
        translateX: '0px',
        translateY: '0px',
        scaleX: 1,
        scaleY: 1,
        transformAnchor: 'cc',
        zIndex: 0,
        rotation: 0,
        opacity: 1,
        customCss: '',
    }
})

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

.card-canvas--clipped {
    overflow: hidden;
}
</style>
