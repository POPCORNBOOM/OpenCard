<template>
    <div ref="cardCanvasRef" class="card-canvas" :style="canvasStyle">
        <div v-for="child in document.children" :key="child.block.id" :style="getChildStyle(child.location)">
            <CardBlock :block="child.block" layout-mode="static" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { CardDocument } from '../../core/Card'
import { getAbsolutePositionStyles } from '../../utils/blockStyle'
import CardBlock from './CardBlock.vue'

const props = defineProps<{
    document: CardDocument
}>()

const cardCanvasRef = ref<HTMLElement>()

const canvasStyle = computed((): Record<string, string> => ({
    position: 'relative',
    width: `${props.document.width}px`,
    height: `${props.document.height}px`,
    background: '#fff'
}))

function getChildStyle(location: CardDocument['children'][number]['location']) {
    return `position: absolute; ${getAbsolutePositionStyles(location)}`
}

// 暴露给父组件使用
defineExpose({
    getCanvasElement: () => cardCanvasRef.value
})
</script>

<style scoped>
.card-canvas {
    user-select: none;
    display: inline-block;
}
</style>
