<template>
    <div :style="blockStyle">
        <CardBlock v-for="child in block.blocks" :key="child.id" :block="child" />
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { FlowContainerBlock } from '../../core/Card'
import { getPositionStyles, toCSSValue } from '../../utils/blockStyle'
import CardBlock from './CardBlock.vue'

const props = defineProps<{ block: FlowContainerBlock }>()

const directionMap: Record<FlowContainerBlock['direction'], string> = {
    lr: 'row',
    rl: 'row-reverse',
    tb: 'column',
    bt: 'column-reverse',
}

const blockStyle = computed(() => {
    const pos = getPositionStyles(props.block)
    const flexDir = directionMap[props.block.direction]
    const gap = toCSSValue(props.block.gap)
    return `${pos}; display: flex; flex-direction: ${flexDir}; gap: ${gap}`
})
</script>
