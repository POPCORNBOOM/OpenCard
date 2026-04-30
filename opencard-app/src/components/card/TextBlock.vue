<!-- 文本块组件：根据块属性渲染文本内容并映射文本布局样式。 -->
<template>
    <div :data-block-id="block.id" :style="blockStyle" @click.stop="handleClick">
        <span v-if="block.mode === 'plain'" class="text-block-content" v-text="block.content" />
        <div v-else class="text-block-content" v-html="block.content" />
    </div>
</template>
<script setup lang="ts">
import { computed, inject } from 'vue'
import { TextBlock } from '../../entities/card/model'
import { getBlockBoxStyles, getPositionStyles, toCSSValue } from '../../utils/blockStyle'
import { cardEditorContextKey } from './cardEditorContext'

type AnchorHorizontal = 'l' | 'c' | 'r'
type AnchorVertical = 't' | 'c' | 'b'

type ResolvedContentAnchor = {
    horizontal: AnchorHorizontal
    vertical: AnchorVertical
}

const verticalJustifyMap: Record<AnchorVertical, string> = {
    t: 'flex-start',
    c: 'center',
    b: 'flex-end',
}

const horizontalTextAlignMap: Record<Exclude<AnchorHorizontal, 'l'>, string> = {
    c: 'center',
    r: 'end',
}

const props = withDefaults(defineProps<{
    /** 文本块数据模型。 */
    block: TextBlock
    /** 布局模式：absolute 使用绝对定位，static 参与父容器流式布局。 */
    layoutMode?: 'absolute' | 'static'
}>(), {
    layoutMode: 'absolute',
})

const editorContext = inject(cardEditorContextKey, null)
const isTransformDisabled = computed(() =>
    editorContext?.transformDisabledBlockIds.value.has(props.block.id) ?? false
)

function resolveContentAnchor(rawAnchor: string | undefined): ResolvedContentAnchor {
    const normalized = typeof rawAnchor === 'string' ? rawAnchor.trim().toLowerCase() : ''
    if (normalized.length !== 2) {
        return { horizontal: 'l', vertical: 't' }
    }

    const horizontal = normalized[0]
    const vertical = normalized[1]
    const resolvedHorizontal: AnchorHorizontal = (horizontal === 'c' || horizontal === 'r') ? horizontal : 'l'
    const resolvedVertical: AnchorVertical = (vertical === 'c' || vertical === 'b') ? vertical : 't'
    return {
        horizontal: resolvedHorizontal,
        vertical: resolvedVertical,
    }
}

const blockStyle = computed(() => {
    const contentAnchor = resolveContentAnchor(props.block.contentAnchor)
    let style = props.layoutMode === 'absolute'
        ? getPositionStyles(props.block, { disableTransform: isTransformDisabled.value })
        : getBlockBoxStyles(props.block, { disableTransform: isTransformDisabled.value })
    if (props.block.fontSize) style += `; font-size: ${toCSSValue(props.block.fontSize)}`
    if (props.block.fontFamily) style += `; font-family: ${props.block.fontFamily}`
    if (props.block.fontWeight !== undefined) style += `; font-weight: ${props.block.fontWeight}`
    if (props.block.color) style += `; color: ${props.block.color}`
    if (props.block.textAlign) style += `; text-align: ${props.block.textAlign}`
    if (contentAnchor.horizontal !== 'l') style += `; text-align: ${horizontalTextAlignMap[contentAnchor.horizontal]}`
    if (contentAnchor.vertical !== 't') {
        style += '; display: flex; flex-direction: column'
        style += `; justify-content: ${verticalJustifyMap[contentAnchor.vertical]}`
    }
    if (props.block.lineHeight !== undefined) style += `; line-height: ${toCSSValue(props.block.lineHeight)}`
    if (props.block.writingMode) style += `; writing-mode: ${props.block.writingMode}`
    return style
})

function handleClick(event: MouseEvent) {
    editorContext?.handleBlockClick?.(props.block.id, event)
}
</script>

<style scoped>
.text-block-content {
    display: block;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
}
</style>
