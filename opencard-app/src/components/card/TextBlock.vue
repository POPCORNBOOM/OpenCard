<template>
    <div :style="blockStyle">
        <span v-if="block.mode === 'plain'" v-text="block.content" />
        <div v-else v-html="block.content" />
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { TextBlock } from '../../core/Card'
import { getPositionStyles, toCSSValue } from '../../utils/blockStyle'

const props = defineProps<{ block: TextBlock }>()

const blockStyle = computed(() => {
    let style = getPositionStyles(props.block)
    if (props.block.fontSize) style += `; font-size: ${toCSSValue(props.block.fontSize)}`
    if (props.block.fontFamily) style += `; font-family: ${props.block.fontFamily}`
    if (props.block.fontWeight !== undefined) style += `; font-weight: ${props.block.fontWeight}`
    if (props.block.color) style += `; color: ${props.block.color}`
    if (props.block.backgroundColor) style += `; background-color: ${props.block.backgroundColor}`
    if (props.block.textAlign) style += `; text-align: ${props.block.textAlign}`
    if (props.block.lineHeight !== undefined) style += `; line-height: ${toCSSValue(props.block.lineHeight)}`
    return style
})
</script>
