<template>
  <ProjectRegistryEditorShell icon="file.custom-block" content-mode="workspace"
    :heading="t('customBlockRegistry.title')" :description="t('customBlockRegistry.description')">
    <template #actions>
      <OcButton icon="action.import" variant="soft" :disabled="busy" @click="addBlock">
        {{ t('customBlockRegistry.add') }}
      </OcButton>
    </template>
    <div class="custom-block-registry-editor">
      <OcText v-if="error" as="p" size="sm" tone="danger" role="alert">{{ error }}</OcText>
      <div class="custom-block-registry-editor__workbench">
        <aside class="custom-block-registry-editor__list">
          <OcTree v-if="treeData.rootKeys.length" fill :data="treeData" :actions="actions"
            :selected-keys="selectedPackageId ? [selectedPackageId] : []" selection-mode="single"
            :aria-label="t('customBlockRegistry.title')" @intent="handleIntent" />
          <OcEmpty v-else tone="muted" inset="comfortable">
            {{ t('customBlockRegistry.empty') }}
          </OcEmpty>
        </aside>

        <section class="custom-block-registry-editor__right"
          :style="{ '--oc-custom-block-preview-occlusion': `${propertyOcclusion}px` }">
          <main class="custom-block-registry-editor__preview">
            <CardViewport v-if="previewFace && previewResources" ref="viewportRef"
              class="custom-block-registry-editor__viewport" :face="previewFace"
              :restore-key="selectedPackageId ?? undefined" :show-info="false"
              :viewport-insets="previewViewportInsets" :resource-context="previewResources"
              @viewport-transform-change="handleViewportTransformChange"
              @viewport-size-change="fitPreview" />
            <OcEmpty v-else tone="muted" inset="comfortable">
              {{ selectedEntry ? t('customBlockRegistry.preview.unavailable')
                : t('customBlockRegistry.preview.selectBlock') }}
            </OcEmpty>
            <OcOverlayToolbar v-if="previewFace" class="custom-block-registry-editor__viewport-tools"
              :label="t('customBlockRegistry.preview.viewportControls')" :items="previewToolbarItems"
              @select="handlePreviewToolbarSelect" />
            <OcCard v-if="issues.length" class="custom-block-registry-editor__issues" variant="glass" role="status">
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
  </ProjectRegistryEditorShell>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import CardViewport from '../../features/card-rendering/components/CardViewport.vue'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent } from '../../shared/ui/tree/tree.types'
import { VIEWPORT_ZOOM_STEP } from '../../shared/ui/viewport/viewportNavigation'
import PropertyEditor from '../../shared/ui/property-editor/PropertyEditor.vue'
import OcButton from '../base/OcButton.vue'
import OcEmpty from '../base/OcEmpty.vue'
import OcPanel from '../base/OcPanel.vue'
import OcText from '../base/OcText.vue'
import OcCard, { type OcCardAction } from '../standard/OcCard.vue'
import OcOverlayToolbar, { createViewportToolbarItems } from '../standard/OcOverlayToolbar.vue'
import OcTree from '../standard/OcTree.vue'
import OcViewportInspector from '../standard/OcViewportInspector.vue'
import ProjectRegistryEditorShell from './ProjectRegistryEditorShell.vue'
import { useCustomBlockPreview } from './useCustomBlockPreview'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t, te } = useI18n()
const projectStore = useProjectStore()
const busy = ref(false)
const error = ref('')
const viewportRef = ref<{ zoomBy: (factor: number) => void, fitView?: () => void, fitContent?: (rect: { left: number, top: number, width: number, height: number }) => void } | null>(null)
const viewportScale = ref(1)
const propertyPanelExpanded = ref(true)
const propertyPanelHeight = ref<number | null>(null)
const propertyOcclusion = ref(0)
const resourceRootPath = computed(() => props.resourceRootPath ?? projectStore.projectPath.value ?? null)
const previewViewportInsets = computed(() => ({ bottom: propertyOcclusion.value }))
const previewToolbarItems = computed(() => createViewportToolbarItems(`${Math.round(viewportScale.value * 100)}%`))

const {
  entries,
  selectedPackageId,
  selectedEntry,
  previewFace,
  previewResources,
  previewFitRect,
  issues,
  propertyInputs,
  propertyCategories,
  selectPackage,
  updateProperty,
  resetActiveValues,
} = useCustomBlockPreview({
  catalog: projectStore.projectCustomBlockCatalog,
  manifestCatalog: projectStore.projectCustomBlockManifestCatalog,
  ensureLoaded: projectStore.ensureProjectCustomBlockLoaded,
  renderEnvironment: projectStore.renderEnvironment,
  resourceRootPath,
  translate: t,
  hasMessage: te,
})

const actions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  ['reveal', { title: t('customBlockRegistry.reveal'), icon: 'status.folder-open' }],
  ['remove', { title: t('customBlockRegistry.remove'), icon: 'action.delete', iconTone: 'danger' }],
]))
const propertyCardActions = computed<OcCardAction[]>(() => [{
  key: 'reset-preview-values',
  icon: 'action.discard',
  title: t('customBlockRegistry.preview.reset'),
  disabled: propertyInputs.value.length === 0,
}])
const treeData = computed<OcTreeData>(() => ({
  rootKeys: entries.value.map(entry => entry.packageId),
  items: new Map(entries.value.map(entry => [entry.packageId, {
    label: entry.descriptor.manifest.name,
    tail: [
      `${entry.packageId} · ${entry.descriptor.manifest.version} · ${t(`customBlockRegistry.status.${entry.descriptor.unavailable ? 'error' : entry.descriptor.loadState}`)}`,
      entry.descriptor.installationPath,
    ],
    icon: entry.descriptor.unavailable ? 'status.warning' : 'file.custom-block',
    actions: ['reveal', 'remove'],
    contextActions: ['reveal', 'remove'],
  }])),
  children: new Map(),
}))

watch(() => props.filePath, () => {
  emit('modified', false)
  void projectStore.reloadProjectCustomBlocks()
}, { immediate: true })

async function addBlock(): Promise<void> {
  if (busy.value) return
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
    const installed = await projectStore.installProjectCustomBlockFile(source)
    selectPackage(installed.packageId)
  } catch {
    error.value = t('customBlockRegistry.importFailed')
  } finally {
    busy.value = false
  }
}

function handleIntent(intent: OcTreeIntent): void {
  if (intent.type === 'selection.change') {
    const packageId = intent.selectedKeys[0]
    if (packageId) selectPackage(packageId)
    return
  }
  if (intent.type !== 'action.invoke') return
  if (intent.actionKey === 'reveal') void projectStore.revealProjectCustomBlock(intent.key)
  if (intent.actionKey === 'remove') void projectStore.uninstallProjectCustomBlock(intent.key)
}

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
watch(selectedPackageId, async () => { viewportScale.value = 1; await nextTick(); fitPreview() })
</script>

<style scoped>
.custom-block-registry-editor { min-width: 0; min-height: 0; height: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr); background: var(--oc-bg-inset); }
.custom-block-registry-editor > [role="alert"] { padding: var(--oc-space-2) var(--oc-space-4); border-bottom: var(--oc-border-width) solid var(--oc-border-muted); background: var(--oc-bg-base); }
.custom-block-registry-editor__workbench { display: grid; grid-template-columns: minmax(var(--oc-custom-block-list-min-width), var(--oc-custom-block-list-width)) minmax(0, 1fr); min-width: 0; min-height: 0; }
.custom-block-registry-editor__list { min-width: 0; min-height: 0; overflow: hidden; border-right: var(--oc-border-width) solid var(--oc-border-muted); background: var(--oc-bg-base); }
.custom-block-registry-editor__right, .custom-block-registry-editor__preview { min-width: 0; min-height: 0; overflow: hidden; }
.custom-block-registry-editor__right { position: relative; }
.custom-block-registry-editor__preview { position: relative; display: grid; place-items: center; width: 100%; height: 100%; background-color: var(--oc-bg-raised); background-image: var(--oc-viewport-dot-pattern); background-size: var(--oc-viewport-dot-size); background-position: var(--oc-viewport-dot-position); }
.custom-block-registry-editor__viewport { width: 100%; height: 100%; }
.custom-block-registry-editor__viewport-tools { position: absolute; right: var(--oc-floating-surface-gap); bottom: calc(var(--oc-custom-block-preview-occlusion, 0px) + var(--oc-floating-surface-gap)); z-index: var(--oc-z-overlay-toolbar); }
.custom-block-registry-editor__issues { position: absolute; left: var(--oc-floating-surface-gap); bottom: calc(var(--oc-custom-block-preview-occlusion, 0px) + var(--oc-floating-surface-gap)); max-width: var(--oc-content-width-md); }
.custom-block-registry-editor__properties { --oc-viewport-inspector-default-height: var(--oc-custom-block-property-height); min-width: 0; min-height: 0; }
</style>
