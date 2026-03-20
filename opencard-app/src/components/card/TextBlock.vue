<template>
    <div :style="blockStyle">
        <div v-if="block.mode === 'plain'" v-text="block.content" />
        <div v-else-if="block.mode === 'markdown'" v-html="block.content" />
        <div v-else-if="block.mode === 'richtext'" v-html="block.content" />
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { TextBlock } from '../../core/cardDocument';
import { getPositionStyles, toCSSValue } from '../../utils/blockStyle';

const props = defineProps<{
    block: TextBlock
}>()

const blockStyle = computed(() => {
    let style = getPositionStyles(props.block)

    // 添加文本特定样式
    if (props.block.fontSize) style += `; font-size: ${toCSSValue(props.block.fontSize)}`
    if (props.block.fontFamily) style += `; font-family: ${props.block.fontFamily}`
    if (props.block.fontWeight) style += `; font-weight: ${props.block.fontWeight}`
    if (props.block.color) style += `; color: ${props.block.color}`
    if (props.block.backgroundColor) style += `; background-color: ${props.block.backgroundColor}`
    if (props.block.textAlign) style += `; text-align: ${props.block.textAlign}`
    if (props.block.lineHeight) style += `; line-height: ${toCSSValue(props.block.lineHeight)}`

    return style
})
</script>