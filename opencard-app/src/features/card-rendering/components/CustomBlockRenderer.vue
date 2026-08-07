<template>
  <div class="custom-block-renderer" :class="{ 'is-error': !block.content }"
    :data-block-id="block.id" :style="blockStyle"
    :role="block.content ? undefined : 'alert'"
    :aria-label="block.content ? undefined : t('cardDesigner.customBlock.unavailable')"
    @click.stop="handleClick">
    <NativeBlockRenderer v-if="nativeContent" :block="nativeContent" layout-mode="static" />
    <template v-else>
      <OcIcon name="status.warning" tone="warning" size="md" />
      <span>{{ t('cardDesigner.customBlock.unavailable') }}</span>
      <code>{{ block.error }}</code>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OcIcon from '../../../components/base/OcIcon.vue'
import { getPositionStyles } from '../../../utils/blockStyle'
import { useCardEditorContext } from './cardEditorContext'
import type { RenderReadyCustomBlock } from '../render.types'
import NativeBlockRenderer from './NativeBlockRenderer.vue'

const props = withDefaults(defineProps<{
  block: RenderReadyCustomBlock
  layoutMode?: 'absolute' | 'static'
}>(), { layoutMode: 'absolute' })
const editorContext = useCardEditorContext()
const { t } = useI18n()
const nativeContent = computed(() => props.block.content?.type === 'custom-block' ? null : props.block.content)
const blockStyle = computed(() => props.layoutMode === 'absolute'
  ? getPositionStyles(props.block, { disableTransform: false })
  : `width: ${props.block.width}; height: ${props.block.height}`)

function handleClick(event: MouseEvent): void {
  editorContext.handleBlockClick(props.block.id, event)
}
</script>

<style scoped>
.custom-block-renderer.is-error {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--oc-space-2);
  color: var(--oc-color-text-muted);
  background: var(--oc-color-surface-subtle);
  border: var(--oc-border-width-default) dashed var(--oc-color-border-warning);
  overflow: hidden;
}

.custom-block-renderer code {
  color: inherit;
}
</style>
