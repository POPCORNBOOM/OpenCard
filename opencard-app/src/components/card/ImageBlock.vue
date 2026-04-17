<!--
  使用说明：
  - 输入 `block` 提供图片块结构与样式字段
  - `layoutMode` 决定走绝对定位还是静态布局样式

  职责边界：
  - 负责图片块渲染与样式投影
  - 只通过编辑器上下文回传点击意图 不处理文档写回

  主要输出事件：
  - 无 通过注入的 `handleBlockClick` 上抛选择意图
-->
<template>
    <div :data-block-id="block.id" :style="wrapStyle" @click.stop="handleClick">
        <img :src="imageSrc" :alt="block.id" :style="imgStyle" />
    </div>
</template>
<script setup lang="ts">
import { computed, inject } from 'vue'
import { ImageBlock } from '../../entities/card/model'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import { getBlockBoxStyles, getPositionStyles } from '../../utils/blockStyle'
import { cardEditorContextKey } from './cardEditorContext'

const props = withDefaults(defineProps<{
    block: ImageBlock
    layoutMode?: 'absolute' | 'static'
}>(), {
    layoutMode: 'absolute',
})

const editorContext = inject(cardEditorContextKey, null)
const isTransformDisabled = computed(() =>
    editorContext?.transformDisabledBlockIds.value.has(props.block.id) ?? false
)

const { resolveAssetSrc } = useProjectStore()

const wrapStyle = computed(() => {
    const style = props.layoutMode === 'absolute'
        ? getPositionStyles(props.block, { disableTransform: isTransformDisabled.value })
        : getBlockBoxStyles(props.block, { disableTransform: isTransformDisabled.value })
    return `${style}; overflow: hidden`
})

const imgStyle = computed(() => {
    const fit = props.block.fit
    return `width: 100%; height: 100%; object-fit: ${fit}; display: block`
})

const imageSrc = computed(() => {
    const imagePath = props.block.image
    return resolveAssetSrc(imagePath)
})

function handleClick(event: MouseEvent) {
    editorContext?.handleBlockClick?.(props.block.id, event)
}
</script>
