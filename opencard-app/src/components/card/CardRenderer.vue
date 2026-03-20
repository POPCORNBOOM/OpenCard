<template>
    <div ref="cardCanvasRef" class="card-canvas" :style="canvasStyle">
        <CardBlock v-for="block in document.blocks" :key="block.id" :block="block" />
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { CardDocument } from '../../core/cardDocument'
import CardBlock from './CardBlock.vue'

const props = defineProps<{
    document: CardDocument
}>()

const cardCanvasRef = ref<HTMLElement>()

const canvasStyle = computed(() => ({
    position: 'relative',
    width: `${props.document.canvas.width}px`,
    height: `${props.document.canvas.height}px`,
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