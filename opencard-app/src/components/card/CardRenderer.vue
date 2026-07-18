<!-- 卡片渲染器：将 CardDocument 渲染为静态画布并可选择裁切超出文档尺寸的内容。 -->
<template>
    <div ref="cardCanvasRef" class="card-canvas" :class="{ 'card-canvas--clipped': props.clipToDocument }"
        :style="canvasStyle">
        <CardBlock :block="rootContainerBlock" layout-mode="static" />
    </div>
</template>

<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import type { CardDocument, SimpleContainerBlock } from '../../entities/card/model'
import CardBlock from './CardBlock.vue'
import { cardEditorContextKey } from './cardEditorContext'

const emit = defineEmits<{
    /** 块点击事件：上抛被点击 blockId 与原始鼠标事件。 */
    (e: 'block-click', blockId: string, event: MouseEvent): void
}>()

const props = withDefaults(defineProps<{
    /** 要渲染的卡片文档（允许为空）。 */
    document: CardDocument | null
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
    width: `${props.document?.width ?? 0}px`,
    height: `${props.document?.height ?? 0}px`,
    background: props.document?.background ?? '#FFFFFF',
}))

const visibleChildren = computed(() => {
    if (!props.document) {
        return []
    }

    if (normalizedVisibleRootBlockIds.value.size === 0) {
        return props.document.children
    }

    return props.document.children.filter(child =>
        normalizedVisibleRootBlockIds.value.has(child.block.id)
    )
})
const rootContainerBlock = computed<SimpleContainerBlock>(() => {
    if (!props.document) {
        return {
            type: 'simple-container-block',
            id: '__empty__',
            name: 'Empty Document',
            width: '0px',
            height: '0px',
            children: [],

        }
    }

    return {
        type: 'simple-container-block',
        id: props.document.id,
        name: props.document.name,
        width: `${props.document.width}px`,
        height: `${props.document.height}px`,
        children: visibleChildren.value,
        background: props.document?.background ?? '#FFFFFF',

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
