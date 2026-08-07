<template>
  <div class="custom-block-renderer" :data-block-id="block.id" :style="blockStyle"
    role="alert" :aria-label="t('cardDesigner.customBlock.unavailable')" @click.stop="handleClick">
    <OcIcon name="status.warning" tone="warning" size="md" />
    <span>{{ t('cardDesigner.customBlock.unavailable') }}</span>
    <code>{{ block.error }}</code>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OcIcon from '../../../components/base/OcIcon.vue'
import { getPositionStyles } from '../../../utils/blockStyle'
import { useCardEditorContext } from './cardEditorContext'
import type { RenderReadyCustomBlock } from '../render.types'

const props = withDefaults(defineProps<{
  block: RenderReadyCustomBlock
  layoutMode?: 'absolute' | 'static'
}>(), { layoutMode: 'absolute' })
const editorContext = useCardEditorContext()
const { t } = useI18n()
const blockStyle = computed(() => props.layoutMode === 'absolute'
  ? getPositionStyles(props.block, { disableTransform: false })
  : `width: ${props.block.width}; height: ${props.block.height}`)

function handleClick(event: MouseEvent): void {
  editorContext.handleBlockClick(props.block.id, event)
}
</script>

<style scoped>
.custom-block-renderer {
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
