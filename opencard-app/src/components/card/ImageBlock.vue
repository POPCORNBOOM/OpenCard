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
    <div class="image-block" :data-block-id="block.id" :style="wrapStyle" @click.stop="handleClick">
        <div
            v-if="imageLoadState !== 'loaded'"
            class="image-block__placeholder"
            role="img"
            :aria-label="imageLoadState === 'error' ? '图片加载失败' : '未配置图片'"
            :title="imageLoadState === 'error' ? '图片加载失败' : '未配置图片'"
        >
            <OcIcon
                :name="imageLoadState === 'error' ? 'status.warning' : 'file.media'"
                :tone="imageLoadState === 'error' ? 'warning' : 'muted'"
                size="lg"
            />
        </div>
        <img
            v-if="imageSrc"
            :key="imageSrc"
            class="image-block__image"
            :class="{ 'is-loaded': imageLoadState === 'loaded' }"
            :src="imageSrc"
            :alt="block.name ?? block.id"
            :style="imgStyle"
            @load="handleImageLoad"
            @error="handleImageError"
        />
    </div>
</template>
<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import type { ImageBlock } from '../../entities/card/model'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import { getBlockBoxStyles, getPositionStyles } from '../../utils/blockStyle'
import OcIcon from '../base/OcIcon.vue'
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
const imageLoadState = ref<'empty' | 'loading' | 'loaded' | 'error'>('empty')

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

watch(imageSrc, (src) => {
    imageLoadState.value = src ? 'loading' : 'empty'
}, { immediate: true })

function handleImageLoad(): void {
    imageLoadState.value = 'loaded'
}

function handleImageError(): void {
    imageLoadState.value = 'error'
}

function handleClick(event: MouseEvent) {
    editorContext?.handleBlockClick?.(props.block.id, event)
}
</script>

<style scoped>
.image-block__placeholder,
.image-block__image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
}

.image-block {
    position: relative;
}

.image-block__placeholder {
    display: grid;
    place-items: center;
    background: var(--oc-bg-subtle, rgba(255, 255, 255, 0.035));
    color: var(--oc-fg-muted);
}

.image-block__image {
    display: block;
    max-width: none;
    max-height: none;
    opacity: 0;
}

.image-block__image.is-loaded {
    opacity: 1;
}
</style>
