<template>
    <div ref="cardCanvasRef" class="card-canvas" :style="canvasStyle">
        <CardBlock v-for="block in document.blocks" :key="block.id" :block="block" />
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { CardDocument } from '../../core/Card'
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