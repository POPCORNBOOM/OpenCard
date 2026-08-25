<template>
  <ProjectRegistryEditorShell icon="file.custom-block" content-mode="workspace"
    :heading="definition?.name ?? t('customBlockRegistry.preview.title')"
    :description="definition?.key ?? props.fileName ?? ''">
    <div class="custom-block-editor">
      <main class="custom-block-editor__preview">
        <CardViewport v-if="previewFace && previewResources" ref="viewportRef"
          class="custom-block-editor__viewport" :face="previewFace" :restore-key="props.filePath"
          :show-info="false" :resource-context="previewResources"
          @viewport-transform-change="handleViewportTransformChange" @viewport-size-change="fitPreview" />
        <OcEmpty v-else tone="muted" inset="comfortable">
          {{ error || t('customBlockRegistry.preview.unavailable') }}
        </OcEmpty>
        <OcOverlayToolbar v-if="previewFace" class="custom-block-editor__viewport-tools"
          :label="t('customBlockRegistry.preview.viewportControls')" :items="previewToolbarItems"
          @select="handlePreviewToolbarSelect" />
      </main>
      <aside class="custom-block-editor__properties">
        <OcCard fill :title="t('customBlockRegistry.preview.publicFields')" :actions="propertyCardActions"
          @action="handlePropertyCardAction">
          <OcPanel v-if="propertyInputs.length" fill tone="transparent" border="none" padding="none" overflow="auto">
            <PropertyEditor :inputs="propertyInputs" :categories="propertyCategories" sort-mode="category"
              @update-property="handlePropertyUpdate" />
          </OcPanel>
          <OcEmpty v-else tone="muted" inset="comfortable">
            {{ t('customBlockRegistry.preview.noPublicFields') }}
          </OcEmpty>
        </OcCard>
      </aside>
    </div>
  </ProjectRegistryEditorShell>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import CardViewport from '../../features/card-rendering/components/CardViewport.vue'
import OcEmpty from '../base/OcEmpty.vue'
import OcPanel from '../base/OcPanel.vue'
import OcCard, { type OcCardAction } from '../standard/OcCard.vue'
import OcOverlayToolbar, { createViewportToolbarItems } from '../standard/OcOverlayToolbar.vue'
import PropertyEditor from '../../shared/ui/property-editor/PropertyEditor.vue'
import type { PropertyEditorMutation } from '../../shared/ui/property-editor/propertyEditor.types'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import { VIEWPORT_ZOOM_STEP } from '../../shared/ui/viewport/viewportNavigation'
import ProjectRegistryEditorShell from './ProjectRegistryEditorShell.vue'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import { readProjectCustomBlockDefinitionFile, writeProjectCustomBlockDefinitionFile } from '../../features/workspace/services/projectCustomBlock'
import { useCustomBlockPreview } from './useCustomBlockPreview'
import type { ProjectCustomBlockCatalog } from '../../features/workspace/model/projectCustomBlocks'
import type { ProjectCustomBlockDefinitionCatalogEntry } from '../../features/workspace/services/projectCustomBlockDefinition'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t, te } = useI18n()
const projectStore = useProjectStore()
const definition = shallowRef<ProjectCustomBlockDefinitionCatalogEntry['definition'] | null>(null)
const error = ref('')
const viewportRef = ref<{ zoomBy: (factor: number) => void, fitView?: () => void, fitContent?: (rect: { left: number, top: number, width: number, height: number }) => void } | null>(null)
const viewportScale = ref(1)
const definitionCatalog = shallowRef<ReadonlyMap<string, ProjectCustomBlockDefinitionCatalogEntry>>(new Map())
const catalog = shallowRef<ProjectCustomBlockCatalog>(new Map())
const resourceRootPath = computed(() => props.resourceRootPath ?? projectStore.projectPath.value ?? null)
const previewToolbarItems = computed(() => createViewportToolbarItems(`${Math.round(viewportScale.value * 100)}%`))

const preview = useCustomBlockPreview({
  catalog,
  definitionCatalog,
  ensureLoaded: async key => catalog.value.get(key.toLocaleLowerCase()) ?? null,
  renderEnvironment: projectStore.renderEnvironment,
  resourceRootPath,
  translate: t,
  hasMessage: te,
})
const {
  previewFace, previewResources, previewFitRect, propertyInputs, propertyCategories,
  selectPackage, updateProperty, resetActiveValues,
} = preview
const propertyCardActions = computed<OcCardAction[]>(() => [{
  key: 'reset-preview-values', icon: 'action.discard',
  title: t('customBlockRegistry.preview.reset'), disabled: propertyInputs.value.length === 0,
}])

onMounted(async () => {
  try {
    const loaded = await readProjectCustomBlockDefinitionFile(fileSystemService, props.filePath)
    if (!loaded.definition) throw new Error(loaded.issues[0]?.message ?? 'Custom block definition is unavailable')
    definition.value = loaded.definition
    const key = loaded.definition.key.toLocaleLowerCase()
    const entry = { definition: loaded.definition, path: props.filePath, resourceRootPath: projectStore.projectPath.value ?? '' }
    definitionCatalog.value = new Map([[key, entry]])
    catalog.value = new Map([[key, entry]])
    selectPackage(key)
    emit('modified', false)
    await nextTick()
    fitPreview()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
})

function handleViewportTransformChange(transform: { scale: number }): void { viewportScale.value = transform.scale }
function fitPreview(): void {
  if (previewFitRect.value && viewportRef.value?.fitContent) viewportRef.value.fitContent(previewFitRect.value)
  else viewportRef.value?.fitView?.()
}
function handlePreviewToolbarSelect({ key }: { key: string }): void {
  if (key === 'viewport.zoom-out') viewportRef.value?.zoomBy(1 / VIEWPORT_ZOOM_STEP)
  else if (key === 'viewport.fit') fitPreview()
  else if (key === 'viewport.zoom-in') viewportRef.value?.zoomBy(VIEWPORT_ZOOM_STEP)
}
function handlePropertyCardAction(payload: { key: string }): void {
  if (payload.key === 'reset-preview-values') resetActiveValues()
}
async function handlePropertyUpdate(mutation: PropertyEditorMutation): Promise<void> {
  updateProperty(mutation)
  const current = definition.value
  if (!current || mutation.key !== 'custom-block-preview') return
  if (!current.publicFieldKeys.includes(mutation.fieldKey)) return
  const root = current.root as unknown as Record<string, unknown>
  if (mutation.value === undefined) delete root[mutation.fieldKey]
  else root[mutation.fieldKey] = structuredClone(mutation.value)
  emit('modified', true)
  await writeProjectCustomBlockDefinitionFile(fileSystemService, projectStore.projectPath.value ?? '', {
    ...current,
    root: current.root,
  })
  emit('modified', false)
}
</script>

<style scoped>
.custom-block-editor { min-width: 0; min-height: 0; height: 100%; display: grid; grid-template-columns: minmax(0, 1fr) minmax(var(--oc-custom-block-list-min-width), var(--oc-custom-block-preview-properties-width)); background: var(--oc-bg-inset); }
.custom-block-editor__preview { position: relative; min-width: 0; min-height: 0; display: grid; place-items: center; overflow: hidden; background: var(--oc-bg-raised); background-image: var(--oc-viewport-dot-pattern); background-size: var(--oc-viewport-dot-size); background-position: var(--oc-viewport-dot-position); }
.custom-block-editor__viewport { width: 100%; height: 100%; }
.custom-block-editor__viewport-tools { position: absolute; right: var(--oc-floating-surface-gap); bottom: var(--oc-floating-surface-gap); z-index: var(--oc-z-overlay-toolbar); }
.custom-block-editor__properties { min-width: 0; min-height: 0; overflow: hidden; border-left: var(--oc-border-width) solid var(--oc-border-muted); background: var(--oc-bg-base); }
.custom-block-editor__properties > :deep(.oc-card) { border: 0; border-radius: 0; }
</style>
