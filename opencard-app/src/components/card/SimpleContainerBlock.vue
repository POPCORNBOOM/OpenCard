<template>
    <div :style="blockStyle">
        <div v-for="child in block.children" :key="child.block.id" :style="getChildStyle(child.location)">
            <CardBlock :block="child.block" layout-mode="static" />
        </div>
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { SimpleContainerBlock } from '../../core/Card'
import { getAbsolutePositionStyles, getBlockBoxStyles, getPositionStyles } from '../../utils/blockStyle'
import CardBlock from './CardBlock.vue'

const props = withDefaults(defineProps<{
    block: SimpleContainerBlock
    layoutMode?: 'absolute' | 'static'
}>(), {
    layoutMode: 'absolute',
})

const blockStyle = computed(() => {
    const style = props.layoutMode === 'absolute'
        ? getPositionStyles(props.block)
        : getBlockBoxStyles(props.block)
    return `${style}; position: relative`
})

function getChildStyle(location: SimpleContainerBlock['children'][number]['location']) {
    return `position: absolute; ${getAbsolutePositionStyles(location)}`
}
</script>
