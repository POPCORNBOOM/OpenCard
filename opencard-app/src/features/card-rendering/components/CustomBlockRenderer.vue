<template>
  <div class="custom-block-renderer" :class="{ 'is-error': !block.content }"
    :data-block-id="block.id" :style="resolveBlockStyle()"
    :role="block.content ? undefined : 'alert'"
    :aria-label="block.content ? undefined : t('cardDesigner.customBlock.unavailable')"
    @click.stop="handleClick">
    <NativeBlockRenderer v-if="nativeContent" :block="nativeContent" layout-mode="static" />
    <template v-else>
      <OcIcon name="status.warning" tone="warning" size="md" />
      <span>{{ t('cardDesigner.customBlock.unavailable') }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue'
import { useI18n } from 'vue-i18n'
import OcIcon from '../../../components/base/OcIcon.vue'
import { getBlockBoxStyles, getPositionStyles } from '../../../utils/blockStyle'
import { cardEditorContextKey, useCardEditorContext } from './cardEditorContext'
import type { RenderReadyCustomBlock } from '../render.types'
import NativeBlockRenderer from './NativeBlockRenderer.vue'
import {
  EMPTY_PROJECT_ICON_CATALOG,
  projectIconIdentity,
  type ProjectIconCatalog,
} from '../../workspace/services/projectIconCatalog'
import { resolveCustomBlockAssetSrc, resolveCustomBlockFontFamily } from '../cardRenderResources'

const props = withDefaults(defineProps<{
  block: RenderReadyCustomBlock
  layoutMode?: 'absolute' | 'static'
}>(), { layoutMode: 'absolute' })
const editorContext = useCardEditorContext()
const { t } = useI18n()
const nativeContent = computed(() => props.block.content?.type === 'custom-block' ? null : props.block.content)
function resolveBlockStyle(): string {
  return props.layoutMode === 'absolute'
    ? getPositionStyles(props.block, { disableTransform: false })
    : getBlockBoxStyles(props.block, { disableTransform: false })
}
const scopedEntry = computed(() => editorContext.customBlockCatalog?.value.get(props.block.customBlockKey.toLowerCase()))
const scopedProjectIconCatalog = computed<ProjectIconCatalog>(() => {
  const scoped = scopedEntry.value?.iconCatalog ?? EMPTY_PROJECT_ICON_CATALOG
  const project = editorContext.projectIconCatalog?.value ?? EMPTY_PROJECT_ICON_CATALOG
  const entries = [...project.entries, ...scoped.entries]
  const series = [...project.series, ...scoped.series]
  return {
    series,
    entries,
    errors: [...scoped.errors, ...project.errors],
    seriesByKey: new Map(series.map(item => [item.key.toLowerCase(), item])),
    entriesByIdentity: new Map(entries.map(item => [projectIconIdentity(item.seriesKey, item.iconKey), item])),
  }
})

provide(cardEditorContextKey, {
  ...editorContext,
  resolveAssetSrc: source => /^resource:image:/i.test(source.trim())
    ? resolveCustomBlockAssetSrc(source, props.block.customBlockKey, {
        resourceRootPath: null,
        customBlockCatalog: editorContext.customBlockCatalog?.value ?? new Map(),
        projectIconCatalog: editorContext.projectIconCatalog?.value ?? EMPTY_PROJECT_ICON_CATALOG,
        richText: editorContext.richText?.value,
      })
    : editorContext.resolveAssetSrc(source),
  resolveFontFamily: value => resolveCustomBlockFontFamily(
    value,
    props.block.customBlockKey,
    {
      resourceRootPath: null,
      customBlockCatalog: editorContext.customBlockCatalog?.value ?? new Map(),
      projectIconCatalog: editorContext.projectIconCatalog?.value ?? EMPTY_PROJECT_ICON_CATALOG,
      richText: editorContext.richText?.value,
    },
    editorContext.resolveFontFamily,
  ),
  projectIconCatalog: scopedProjectIconCatalog,
})

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
  color: var(--oc-fg-muted);
  background: var(--oc-bg-warning-subtle);
  border: var(--oc-border-width) dashed var(--oc-border-default);
  overflow: hidden;
}

</style>
