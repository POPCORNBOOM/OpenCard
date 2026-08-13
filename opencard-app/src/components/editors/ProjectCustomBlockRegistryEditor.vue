<template>
  <ProjectRegistryEditorShell icon="file.custom-block" content-mode="workspace"
    :heading="t('customBlockRegistry.title')" :description="t('customBlockRegistry.description')"
    @keydown.ctrl.s.prevent="save">
    <template #actions>
      <OcButton icon="action.import" variant="soft" :disabled="busy" @click="addBlock">
        {{ t('customBlockRegistry.add') }}
      </OcButton>
    </template>
    <div v-if="document" class="custom-block-registry-editor">
      <OcText v-if="error" as="p" size="sm" tone="danger" role="alert">{{ error }}</OcText>
      <div class="custom-block-registry-editor__workbench">
        <aside class="custom-block-registry-editor__list">
          <OcTree v-if="treeData.rootKeys.length" fill :data="treeData" :actions="actions"
            :selected-keys="selectedPath ? [selectedPath] : []" selection-mode="single"
            :aria-label="t('customBlockRegistry.title')" @intent="handleIntent" />
          <OcEmpty v-else tone="muted" inset="comfortable">
            {{ t('customBlockRegistry.empty') }}
          </OcEmpty>
        </aside>

        <section class="custom-block-registry-editor__right"
          :style="{ '--oc-custom-block-preview-occlusion': `${propertyOcclusion}px` }">
          <main class="custom-block-registry-editor__preview">
            <CardViewport v-if="previewFace && previewResources" ref="viewportRef" class="custom-block-registry-editor__viewport"
              :face="previewFace" :restore-key="selectedPath ?? undefined" :show-info="false"
              :viewport-insets="previewViewportInsets"
              :resource-context="previewResources"
              @viewport-transform-change="handleViewportTransformChange"
              @viewport-size-change="handleViewportSizeChange" />
            <OcEmpty v-else tone="muted" inset="comfortable">
              {{ selectedEntry ? t('customBlockRegistry.preview.unavailable')
                : t('customBlockRegistry.preview.selectBlock') }}
            </OcEmpty>
            <OcOverlayToolbar v-if="previewFace" class="custom-block-registry-editor__viewport-tools"
              :label="t('customBlockRegistry.preview.viewportControls')" :items="previewToolbarItems"
              @select="handlePreviewToolbarSelect" />
            <OcCard v-if="issues.length" class="custom-block-registry-editor__issues"
              variant="glass" role="status">
              <OcText size="sm" tone="muted">
                {{ t('customBlockRegistry.preview.issues', { count: issues.length }) }}
              </OcText>
            </OcCard>
          </main>

          <OcViewportInspector v-model:expanded="propertyPanelExpanded" v-model:height="propertyPanelHeight"
            class="custom-block-registry-editor__properties" :heading="t('customBlockRegistry.preview.publicFields')"
            :actions="propertyCardActions" :expand-label="t('app.shell.expandBottomPanel')"
            :collapse-label="t('app.shell.collapseBottomPanel')"
            :resize-label="t('customBlockRegistry.preview.resizeProperties')"
            @action="handlePropertyCardAction" @occlusion-change="propertyOcclusion = $event">
            <OcPanel v-if="propertyInputs.length" fill tone="transparent" border="none" padding="none" overflow="auto">
              <PropertyEditor :inputs="propertyInputs" :categories="propertyCategories" sort-mode="category"
                @update-property="updateProperty" />
            </OcPanel>
            <OcEmpty v-else tone="muted" inset="comfortable">
              {{ selectedEntry?.catalogEntry
                ? t('customBlockRegistry.preview.noPublicFields')
                : t('customBlockRegistry.preview.unavailable') }}
            </OcEmpty>
          </OcViewportInspector>
        </section>
      </div>
    </div>
    <ProjectRegistryRepairEditor v-else :model-value="props.modelValue ?? ''" :theme-id="themeId"
      :theme-overrides="themeOverrides" :heading="t('customBlockRegistry.invalid')"
      :description="t('customBlockRegistry.repair')" @update:model-value="updateRawSource" @save="save" />
  </ProjectRegistryEditorShell>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../base/OcButton.vue'
import OcEmpty from '../base/OcEmpty.vue'
import OcPanel from '../base/OcPanel.vue'
import OcText from '../base/OcText.vue'
import OcTree from '../standard/OcTree.vue'
import OcOverlayToolbar, { createViewportToolbarItems } from '../standard/OcOverlayToolbar.vue'
import OcViewportInspector from '../standard/OcViewportInspector.vue'
import OcCard, { type OcCardAction } from '../standard/OcCard.vue'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import type { HistoryOperationMeta } from '../../features/editor-runtime/history/structuredHistory'
import CardViewport from '../../features/card-rendering/components/CardViewport.vue'
import { VIEWPORT_ZOOM_STEP } from '../../shared/ui/viewport/viewportNavigation'
import PropertyEditor from '../../shared/ui/property-editor/PropertyEditor.vue'
import {
  parseProjectCustomBlockRegistryText,
  serializeProjectCustomBlockRegistry,
  type ProjectCustomBlockRegistryDocument,
} from '../../features/workspace/model/projectCustomBlocks'
import { registerProjectCustomBlockPath, unregisterProjectCustomBlockPath } from '../../features/workspace/services/projectCustomBlockRegistry'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent } from '../../shared/ui/tree/tree.types'
import ProjectRegistryEditorShell from './ProjectRegistryEditorShell.vue'
import ProjectRegistryRepairEditor from './ProjectRegistryRepairEditor.vue'
import { useCustomBlockPreview } from './useCustomBlockPreview'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const projectStore = useProjectStore()
const document = ref<ProjectCustomBlockRegistryDocument | null>(null)
const busy = ref(false)
const error = ref('')
const themeId = computed(() => props.themeId ?? 'dark')
const themeOverrides = computed(() => props.themeOverrides ?? {})
const viewportRef = ref<{
  zoomBy: (factor: number) => void
  fitView?: (targetRect?: { left: number; top: number; width: number; height: number }) => void
  fitContent?: (contentRect: { left: number; top: number; width: number; height: number }) => void
} | null>(null)
const viewportScale = ref(1)
const propertyPanelExpanded = ref(true)
const propertyPanelHeight = ref<number | null>(null)
const propertyOcclusion = ref(0)
const viewportScaleLabel = computed(() => `${Math.round(viewportScale.value * 100)}%`)
const previewToolbarItems = computed(() => createViewportToolbarItems(viewportScaleLabel.value))
const previewViewportInsets = computed(() => ({ bottom: propertyOcclusion.value }))
const resourceRootPath = computed(() => props.resourceRootPath ?? null)
const {
  entries: previewEntries,
  selectedPath,
  selectedEntry,
  previewFace,
  previewResources,
  previewFitRect,
  issues,
  propertyInputs,
  propertyCategories,
  selectPath,
  updateProperty,
  resetActiveValues,
} = useCustomBlockPreview({
  document,
  catalog: projectStore.projectCustomBlockCatalog,
  manifestCatalog: projectStore.projectCustomBlockManifestCatalog,
  ensureLoaded: projectStore.ensureProjectCustomBlockLoaded,
  renderEnvironment: projectStore.renderEnvironment,
  resourceRootPath,
  translate: t,
  hasMessage: () => false,
})
const actions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  ['remove', { title: t('customBlockRegistry.remove'), icon: 'action.delete', iconTone: 'danger' }],
]))
const propertyCardActions = computed<OcCardAction[]>(() => [{
  key: 'reset-preview-values',
  icon: 'action.discard',
  title: t('customBlockRegistry.preview.reset'),
  disabled: propertyInputs.value.length === 0,
}])
const treeData = computed<OcTreeData>(() => {
  return {
    rootKeys: previewEntries.value.map(entry => entry.path),
    items: new Map(previewEntries.value.map(entry => [entry.path, {
      label: entry.catalogEntry?.manifest.name ?? entry.path.split('/').pop() ?? entry.path,
      tail: entry.path,
      icon: 'file.custom-block',
      actions: ['remove'],
      contextActions: ['remove'],
    }])),
    children: new Map(),
  }
})

watch(() => props.modelValue, content => {
  document.value = parseProjectCustomBlockRegistryText(content ?? '')
}, { immediate: true })

function commit(next: ProjectCustomBlockRegistryDocument): void {
  const content = serializeProjectCustomBlockRegistry(next)
  document.value = parseProjectCustomBlockRegistryText(content)
  emit('update:modelValue', content)
}

async function commitAndSave(next: ProjectCustomBlockRegistryDocument): Promise<void> {
  commit(next)
  await nextTick()
  emit('save')
}

async function addBlock(): Promise<void> {
  if (!document.value || busy.value) return
  error.value = ''
  const source = await fileSystemService.pickFile({
    title: t('customBlockRegistry.choose'),
    fileTypeName: 'OpenCard custom block',
    extensions: ['ocblock'],
    defaultPath: projectStore.projectPath.value,
  })
  if (!source) return
  busy.value = true
  try {
    const imported = await projectStore.importProjectCustomBlockFile(source)
    const current = imported.replacedSource
      ? unregisterProjectCustomBlockPath(document.value, imported.replacedSource)
      : document.value
    await commitAndSave(registerProjectCustomBlockPath(current, imported.source))
  } catch {
    error.value = t('customBlockRegistry.importFailed')
  } finally {
    busy.value = false
  }
}

function handleIntent(intent: OcTreeIntent): void {
  if (intent.type === 'selection.change') {
    const path = intent.selectedKeys[0]
    if (path) selectPath(path)
    return
  }
  if (!document.value || intent.type !== 'action.invoke' || intent.actionKey !== 'remove') return
  void commitAndSave(unregisterProjectCustomBlockPath(document.value, intent.key))
}

function handleViewportTransformChange(transform: { scale: number }): void {
  viewportScale.value = transform.scale
}

function handleViewportSizeChange(): void {
  fitPreview()
}

function fitPreview(): void {
  const viewport = viewportRef.value
  if (!viewport) return
  if (previewFitRect.value && viewport.fitContent) viewport.fitContent(previewFitRect.value)
  else viewport.fitView?.()
}

function zoomIn(): void {
  viewportRef.value?.zoomBy(VIEWPORT_ZOOM_STEP)
}

function zoomOut(): void {
  viewportRef.value?.zoomBy(1 / VIEWPORT_ZOOM_STEP)
}

function handlePreviewToolbarSelect({ key }: { key: string }): void {
  if (key === 'viewport.zoom-out') zoomOut()
  else if (key === 'viewport.fit') fitPreview()
  else if (key === 'viewport.zoom-in') zoomIn()
}

watch(selectedPath, async () => {
  viewportScale.value = 1
  await nextTick()
  fitPreview()
})

function handlePropertyCardAction(payload: { key: string }): void {
  if (payload.key === 'reset-preview-values') resetActiveValues()
}

function updateRawSource(content: string, history?: HistoryOperationMeta): void {
  emit('update:modelValue', content, history)
}

function save(): void {
  emit('save')
}

defineExpose({ save })
</script>

<style scoped>
.custom-block-registry-editor {
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas:
    "error"
    "workbench";
  background: var(--oc-bg-inset);
}

.custom-block-registry-editor > [role="alert"] {
  grid-area: error;
  padding: var(--oc-space-2) var(--oc-space-4);
  border-bottom: var(--oc-border-width) solid var(--oc-border-muted);
  background: var(--oc-bg-base);
}

.custom-block-registry-editor__workbench {
  grid-area: workbench;
  display: grid;
  grid-template-columns:
    minmax(var(--oc-custom-block-list-min-width), var(--oc-custom-block-list-width))
    minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
}

.custom-block-registry-editor__list,
.custom-block-registry-editor__right,
.custom-block-registry-editor__preview {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.custom-block-registry-editor__properties {
  min-width: 0;
  min-height: 0;
}

.custom-block-registry-editor__list {
  border-right: var(--oc-border-width) solid var(--oc-border-muted);
  background: var(--oc-bg-base);
}

.custom-block-registry-editor__preview {
  position: relative;
  display: grid;
  place-items: center;
  background-color: var(--oc-bg-raised);
  background-image: var(--oc-viewport-dot-pattern);
  background-size: var(--oc-viewport-dot-size);
  background-position: var(--oc-viewport-dot-position);
  width: 100%;
  height: 100%;
}

.custom-block-registry-editor__right {
  position: relative;
}

.custom-block-registry-editor__viewport {
  width: 100%;
  height: 100%;
}

.custom-block-registry-editor__viewport-tools {
  position: absolute;
  right: var(--oc-floating-surface-gap);
  bottom: calc(var(--oc-custom-block-preview-occlusion, 0px) + var(--oc-floating-surface-gap));
  z-index: var(--oc-z-overlay-toolbar);
}

.custom-block-registry-editor__issues {
  position: absolute;
  left: var(--oc-floating-surface-gap);
  bottom: calc(var(--oc-custom-block-preview-occlusion, 0px) + var(--oc-floating-surface-gap));
  max-width: var(--oc-content-width-md);
}

.custom-block-registry-editor__properties {
  --oc-viewport-inspector-default-height: var(--oc-custom-block-property-height);
}
</style>
