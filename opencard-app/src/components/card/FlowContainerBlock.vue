<template>
    <div :style="blockStyle">
        <div v-for="child in orderedChildren" :key="child.block.id" :style="getChildStyle(child.location)">
            <CardBlock :block="child.block" layout-mode="static" :use-wrapper="useWrapper" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FlowContainerBlock } from '../../core/Card'
import { getBlockBoxStyles, getPositionStyles, toCSSValue } from '../../utils/blockStyle'
import CardBlock from './CardBlock.vue'

const props = withDefaults(defineProps<{
    block: FlowContainerBlock
    layoutMode?: 'absolute' | 'static'
    useWrapper?: boolean
}>(), {
    layoutMode: 'absolute',
    useWrapper: true,
})

const directionMap: Record<FlowContainerBlock['direction'], string> = {
    lr: 'row',
    rl: 'row-reverse',
    tb: 'column',
    bt: 'column-reverse',
}

const alignMap: Record<NonNullable<FlowContainerBlock['children'][number]['location']['align']>, string> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    justify: 'stretch',
}

const blockStyle = computed(() => {
    const pos = props.layoutMode === 'absolute'
        ? getPositionStyles(props.block)
        : getBlockBoxStyles(props.block)
    const flexDir = directionMap[props.block.direction]
    const gap = toCSSValue(props.block.gap)
    return `${pos}; display: flex; flex-direction: ${flexDir}; gap: ${gap}`
})

const orderedChildren = computed(() =>
    [...props.block.children].sort((a, b) => a.location.index - b.location.index)
)

function getChildStyle(location: FlowContainerBlock['children'][number]['location']) {
    const styles = [`order: ${location.index}`]
    if (location.align) {
        styles.push(`align-self: ${alignMap[location.align]}`)
    }
    return styles.join('; ')
}
</script>
