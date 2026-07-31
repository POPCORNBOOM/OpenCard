<template>
  <div class="qrcode-block" :data-block-id="block.id" :style="blockStyle" @click.stop="handleClick">
    <div
      v-if="renderState !== 'ready'"
      class="qrcode-block__placeholder"
      role="img"
      :aria-label="renderState === 'error' ? '二维码生成失败' : '未配置二维码内容'"
    >
      <OcIcon :name="renderState === 'error' ? 'status.warning' : 'entity.block-qrcode'"
        :tone="renderState === 'error' ? 'warning' : 'muted'" size="lg" />
    </div>
    <div v-else class="qrcode-block__graphic" role="img" :aria-label="block.name" v-html="svgMarkup" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import QRCode from 'qrcode'
import { getBlockBoxStyles, getPositionStyles } from '../../../utils/blockStyle'
import OcIcon from '../../../components/base/OcIcon.vue'
import { useCardEditorContext } from './cardEditorContext'
import type { RenderReadyQrCodeBlock } from '../render.types'

const props = withDefaults(defineProps<{
  block: RenderReadyQrCodeBlock
  layoutMode?: 'absolute' | 'static'
}>(), {
  layoutMode: 'absolute',
})

const editorContext = useCardEditorContext()
const isTransformDisabled = computed(() => editorContext.transformDisabledBlockIds.value.has(props.block.id))
const svgMarkup = ref('')
const renderState = ref<'empty' | 'loading' | 'ready' | 'error'>('empty')
let renderRevision = 0

const blockStyle = computed(() => {
  const style = props.layoutMode === 'absolute'
    ? getPositionStyles(props.block, { disableTransform: isTransformDisabled.value })
    : getBlockBoxStyles(props.block, { disableTransform: isTransformDisabled.value })
  return `${style}; overflow: hidden`
})

watch(
  [
    () => props.block.content,
    () => props.block.errorCorrection,
    () => props.block.foreground,
    () => props.block.backgroundColor,
    () => props.block.quietZone,
  ],
  async ([content, errorCorrection, foreground, backgroundColor, quietZone]) => {
    const revision = ++renderRevision
    if (!content) {
      svgMarkup.value = ''
      renderState.value = 'empty'
      return
    }

    renderState.value = 'loading'
    try {
      const markup = await QRCode.toString(content, {
        type: 'svg',
        errorCorrectionLevel: errorCorrection,
        margin: quietZone,
        color: { dark: foreground, light: backgroundColor },
      })
      if (revision !== renderRevision) return
      svgMarkup.value = markup
      renderState.value = 'ready'
    } catch {
      if (revision !== renderRevision) return
      svgMarkup.value = ''
      renderState.value = 'error'
    }
  },
  { immediate: true },
)

function handleClick(event: MouseEvent): void {
  editorContext.handleBlockClick(props.block.id, event)
}
</script>

<style scoped>
.qrcode-block {
  position: relative;
  display: grid;
  place-items: center;
}

.qrcode-block__placeholder,
.qrcode-block__graphic {
  position: absolute;
  inset: 0;
  display: grid;
  min-width: 0;
  min-height: 0;
  place-items: center;
}

.qrcode-block__placeholder {
  background: var(--oc-bg-subtle, rgba(255, 255, 255, 0.035));
  color: var(--oc-fg-muted);
}

.qrcode-block__graphic :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
