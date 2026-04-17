<template>
    <div :data-block-id="block.id" :style="blockStyle" @click.stop="handleClick">
        <div v-for="child in orderedChildren" :key="child.block.id" :style="getChildStyle(child)">
            <CardBlock :block="getChildRenderBlock(child)" layout-mode="static" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { CardBlock as CardBlockModel, FlowContainerBlock } from '../../entities/card/model'
import { getBlockBoxStyles, getPositionStyles, toCSSValue } from '../../utils/blockStyle'
import CardBlock from './CardBlock.vue'
import { cardEditorContextKey } from './cardEditorContext'

const props = withDefaults(defineProps<{
    block: FlowContainerBlock
    layoutMode?: 'absolute' | 'static'
}>(), {
    layoutMode: 'absolute',
})

const editorContext = inject(cardEditorContextKey, null)
const isTransformDisabled = computed(() =>
    editorContext?.transformDisabledBlockIds.value.has(props.block.id) ?? false
)

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
        ? getPositionStyles(props.block, { disableTransform: isTransformDisabled.value })
        : getBlockBoxStyles(props.block, { disableTransform: isTransformDisabled.value })
    const flexDir = directionMap[props.block.direction]
    const gap = toCSSValue(props.block.gap)
    return `${pos}; display: flex; flex-direction: ${flexDir}; gap: ${gap}`
})

const orderedChildren = computed(() =>
    [...props.block.children].sort((a, b) => a.location.index - b.location.index)
)

function getChildStyle(child: FlowContainerBlock['children'][number]) {
    const styles = [`order: ${child.location.index}`]
    if (child.block.width !== undefined) {
        styles.push(`width: ${toCSSValue(child.block.width)}`)
    }
    if (child.block.height !== undefined) {
        styles.push(`height: ${toCSSValue(child.block.height)}`)
    }
    if (child.location.align) {
        styles.push(`align-self: ${alignMap[child.location.align]}`)
    }
    if (child.block.zIndex !== undefined) {
        styles.push(`z-index: ${child.block.zIndex}`)
    }
    return styles.join('; ')
}

function getChildRenderBlock(child: FlowContainerBlock['children'][number]): CardBlockModel {
    const { block } = child
    const hasWidth = block.width !== undefined
    const hasHeight = block.height !== undefined

    if (!hasWidth && !hasHeight) {
        return block
    }

    return {
        ...block,
        width: hasWidth ? '100%' : block.width,
        height: hasHeight ? '100%' : block.height,
    } as CardBlockModel
}

function handleClick(event: MouseEvent) {
    editorContext?.handleBlockClick?.(props.block.id, event)
}
</script>
