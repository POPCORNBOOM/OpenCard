<template>
  <OcDialog :open="open" :title="dialogTitle" as="form" size="xl"
    :height-mode="activePage === 'preview' || advancedOpen ? 'fixed' : 'content'"
    :height="activePage === 'preview' || advancedOpen ? 'workspace' : undefined"
    :padded="false" :scrollable="false"
    :dismissible="!busy" :close-on-backdrop="!busy" :aria-busy="busy"
    @request-close="requestClose" @submit="submit">
    <div class="custom-block-export-dialog" :inert="busy ? true : undefined">
      <section v-show="activePage === 'package'" class="custom-block-export-dialog__package"
        role="tabpanel">
        <section class="custom-block-export-dialog__section custom-block-export-dialog__information">
          <OcText as="h3" size="sm">{{ t('cardDesigner.customBlock.packageInformation') }}</OcText>
          <div class="custom-block-export-dialog__metadata">
            <label class="custom-block-export-dialog__field">
              <OcText as="span" size="sm">{{ t('cardDesigner.customBlock.name') }}</OcText>
              <OcFieldInput full-width autofocus :value="name" :aria-invalid="!name.trim()"
                @input="name = ($event.target as HTMLInputElement).value" />
            </label>
            <label class="custom-block-export-dialog__field">
              <OcText as="span" size="sm">{{ t('cardDesigner.customBlock.key') }}</OcText>
              <OcFieldInput full-width mono :value="blockKey" :placeholder="suggestedBlockKey"
                :aria-invalid="!validBlockKey" @input="blockKey = ($event.target as HTMLInputElement).value" />
            </label>
            <OcButton type="button" variant="ghost" icon="tool.settings" @click="toggleAdvancedSettings">
              {{ advancedOpen ? t('cardDesigner.customBlock.simpleSettings') : t('cardDesigner.customBlock.advancedSettings') }}
            </OcButton>
          </div>
        </section>

        <div v-if="advancedOpen" class="custom-block-export-dialog__advanced">
          <nav class="custom-block-export-dialog__pages" :aria-label="t('cardDesigner.customBlock.pages')">
            <OcOptionGroup v-model="activePage" :options="pageOptions" appearance="sliding-outline"
              semantics="tabs" fill />
          </nav>
          <div class="custom-block-export-dialog__package-columns">
          <section class="custom-block-export-dialog__section custom-block-export-dialog__fields-section">
            <OcText as="h3" size="sm">{{ t('cardDesigner.customBlock.fields') }}</OcText>
            <OcPanel fill padding="none" overflow="auto">
              <OcTree fill :data="fieldTreeData" :actions="fieldTreeActions" :selected-keys="[]"
                :expanded-keys="fieldGroupKeys" :aria-label="t('cardDesigner.customBlock.fields')"
                selection-mode="none" action-visibility="always" @intent="handleFieldTreeIntent" />
            </OcPanel>
          </section>

          <section class="custom-block-export-dialog__section custom-block-export-dialog__resources-section">
            <div class="custom-block-export-dialog__section-heading">
              <OcText as="h3" size="sm">{{ t('cardDesigner.customBlock.resources') }}</OcText>
              <OcText size="xs" tone="muted">{{ selectedResourceIds.size }}/{{ resourceCandidates.length }}</OcText>
            </div>
            <OcPanel fill padding="none" overflow="auto">
              <CustomBlockResourceTree
                :candidates="resourceCandidates" :selected-ids="[...selectedResourceIds]"
                :ariaLabel="t('cardDesigner.customBlock.resources')"
                :automatic-label="t('cardDesigner.customBlock.resourceAutomatic')"
                :suggested-label="t('cardDesigner.customBlock.resourceSuggested')"
                :manual-label="t('cardDesigner.customBlock.resourceManual')"
                :excluded-label="t('cardDesigner.customBlock.resourceExcluded')"
                :missing-label="t('cardDesigner.customBlock.resourceMissing')"
                :nested-label="t('cardDesigner.customBlock.resourceNested')"
                :font-label="t('cardDesigner.customBlock.fonts')"
                :icon-label="t('cardDesigner.customBlock.icons')"
                :package-label="t('cardDesigner.customBlock.nestedPackages')"
                :image-label="t('cardDesigner.customBlock.otherImages')"
                :select-label="t('cardDesigner.customBlock.resourceSelect')"
                :deselect-label="t('cardDesigner.customBlock.resourceDeselect')"
                @update:selected-ids="selectedResourceIds = $event" />
            </OcPanel>
          </section>
          </div>
        </div>
      </section>

      <section v-show="activePage === 'preview'" class="custom-block-export-dialog__preview" role="tabpanel">
        <main class="custom-block-export-dialog__viewport-area">
          <CardViewport v-if="previewFace && previewResources" ref="viewportRef"
            class="custom-block-export-dialog__viewport" :face="previewFace"
            :show-info="false" :resource-context="previewResources"
            @viewport-transform-change="viewportScale = $event.scale"
            @viewport-size-change="fitPreview" />
          <OcEmpty v-else tone="muted" inset="comfortable">
            {{ previewError || ((analysisBusy || previewRefreshing) ? t('cardDesigner.customBlock.previewPreparing') : t('cardDesigner.customBlock.previewUnavailable')) }}
          </OcEmpty>
          <OcOverlayToolbar v-if="previewFace" class="custom-block-export-dialog__viewport-tools"
            :label="t('customBlockRegistry.preview.viewportControls')" :items="previewToolbarItems"
            @select="handleViewportToolbar" />
          <OcCard v-if="previewDiagnostics.length" class="custom-block-export-dialog__diagnostics" variant="glass" role="status">
            <OcText size="sm" tone="warning">{{ t('cardDesigner.customBlock.previewDiagnostics', { count: previewDiagnostics.length }) }}</OcText>
            <OcText v-for="diagnostic in previewDiagnostics.slice(0, 3)" :key="diagnostic" size="xs" tone="muted">
              {{ diagnostic }}
            </OcText>
          </OcCard>
        </main>

        <aside class="custom-block-export-dialog__properties">
          <OcCard fill :title="t('customBlockRegistry.preview.publicFields')" :actions="propertyActions"
            @action="resetPreviewOverrides">
            <OcPanel v-if="propertyInputs.length" fill tone="transparent" border="none" padding="none" overflow="auto">
              <PropertyEditor :inputs="propertyInputs" :categories="propertyCategories" sort-mode="category"
                @update-property="updatePreviewProperty" />
            </OcPanel>
            <OcEmpty v-else tone="muted" inset="comfortable">
              {{ t('customBlockRegistry.preview.noPublicFields') }}
            </OcEmpty>
          </OcCard>
        </aside>
      </section>
    </div>

    <template #footer>
      <OcButton type="button" :disabled="busy" @click="requestClose">{{ t('cardDesigner.customBlock.cancel') }}</OcButton>
      <OcButton type="submit" variant="solid"
        :disabled="busy || !name.trim() || !validBlockKey || !prepared">
        {{ busy ? t('cardDesigner.customBlock.exporting') : t('cardDesigner.customBlock.export') }}
      </OcButton>
    </template>
  </OcDialog>
  <OcDialog :open="confirmingDiagnostics" :title="t('cardDesigner.customBlock.confirmDiagnosticsTitle')"
    :description="t('cardDesigner.customBlock.confirmDiagnosticsDescription', { count: diagnostics.length })"
    size="sm" @request-close="confirmingDiagnostics = false">
    <OcText tone="warning">{{ t('cardDesigner.customBlock.confirmDiagnosticsHint') }}</OcText>
    <template #footer>
      <OcButton type="button" @click="confirmingDiagnostics = false">{{ t('cardDesigner.customBlock.cancel') }}</OcButton>
      <OcButton type="button" variant="solid" @click="confirmDiagnosticExport">
        {{ t('cardDesigner.customBlock.exportAnyway') }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CardDocument } from '../../../entities/card/model'
import { resolveCardPropertyFields } from '../../card-properties/cardPropertyFieldDefinitions'
import CardViewport from '../../card-rendering/components/CardViewport.vue'
import type { CardRenderResourceContext } from '../../card-rendering/cardRenderResources'
import type { RenderReadyCardFace } from '../../card-rendering/render.types'
import { cardIssueMessageKey } from '../../card-rendering/cardPipelineIssue'
import OcButton from '../../../components/base/OcButton.vue'
import OcEmpty from '../../../components/base/OcEmpty.vue'
import OcFieldInput from '../../../components/base/OcFieldInput.vue'
import OcPanel from '../../../components/base/OcPanel.vue'
import OcText from '../../../components/base/OcText.vue'
import OcCard, { type OcCardAction } from '../../../components/standard/OcCard.vue'
import OcDialog from '../../../components/standard/OcDialog.vue'
import OcOverlayToolbar, { createViewportToolbarItems } from '../../../components/standard/OcOverlayToolbar.vue'
import OcTree from '../../../components/standard/OcTree.vue'
import OcOptionGroup, { type OcOption } from '../../../components/standard/OcOptionGroup.vue'
import { toKeySlug } from '../../../shared/model/keySlug'
import PropertyEditor from '../../../shared/ui/property-editor/PropertyEditor.vue'
import type { PropertyEditorCategoryDefinition, PropertyEditorInput, PropertyEditorMutation } from '../../../shared/ui/property-editor/propertyEditor.types'
import { getPropertyFieldIcon } from '../../../shared/ui/property-editor/propertyFieldRegistry'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent, OcTreeItem } from '../../../shared/ui/tree/tree.types'
import { VIEWPORT_ZOOM_STEP } from '../../../shared/ui/viewport/viewportNavigation'
import {
  normalizeProjectCustomBlockKey,
} from '../model/projectCustomBlocks'
import { fileSystemService } from '../services/fileSystemService'
import { buildProjectCustomBlockManifest, buildProjectCustomBlockRoot } from '../services/buildProjectCustomBlockManifest'
import {
  prepareProjectCustomBlockExport,
  type PreparedProjectCustomBlockExport,
} from '../services/exportProjectCustomBlock'
import { createProjectCustomBlockPreview } from '../services/projectCustomBlockPreview'
import type { CustomBlockFieldAnalysis } from '../services/projectCustomBlockExportAnalyzer'
import type { ProjectCustomBlockResourceCandidate } from '../services/projectCustomBlockResources'
import { createProjectCustomBlockPropertySchema } from '../services/projectCustomBlockPublicFields'
import { useProjectStore } from '../store/projectStore'
import CustomBlockResourceTree from './CustomBlockResourceTree.vue'

const props = withDefaults(defineProps<{
  open: boolean
  dialogTitle: string
  document: CardDocument | null
  rootBlockId: string | null
  fields: readonly CustomBlockFieldAnalysis[]
  defaultName?: string
  defaultKey?: string
  projectRootPath: string
  busy?: boolean
  errorText?: string
}>(), { defaultName: '', defaultKey: '', busy: false, errorText: '' })
const emit = defineEmits<{
  close: []
  submit: [payload: {
    name: string
    blockKey: string
    exposedFieldKeys: string[]
    selectedResourceIds: Set<string>
    prepared: PreparedProjectCustomBlockExport
  }]
}>()
const { t, te } = useI18n()
const projectStore = useProjectStore()
const name = ref('')
const blockKey = ref('')
const exposed = ref(new Set<string>())
const selectedResourceIds = ref(new Set<string>())
const selectionInitialized = ref(false)
const prepared = shallowRef<PreparedProjectCustomBlockExport | null>(null)
const previewFace = shallowRef<RenderReadyCardFace | null>(null)
const previewResources = shallowRef<CardRenderResourceContext | null>(null)
const previewOverrides = ref<Record<string, unknown>>({})
const previewError = ref('')
const analysisBusy = ref(false)
const previewRefreshing = ref(false)
const packageDiagnostics = ref<string[]>([])
const confirmingDiagnostics = ref(false)
const viewportRef = ref<{ zoomBy: (factor: number) => void, fitView?: () => void, fitContent?: (rect: { left: number, top: number, width: number, height: number }) => void } | null>(null)
const viewportScale = ref(1)
let analysisRevision = 0
let manifestRevision = 0
let previewRevision = 0
let manifestQueued = false
let previewQueued = false
const activePage = ref<'package' | 'preview'>('package')
const advancedOpen = ref(false)
const pageOptions = computed<readonly OcOption[]>(() => [
  { value: 'package', label: t('cardDesigner.customBlock.packagePage') },
  { value: 'preview', label: t('cardDesigner.customBlock.previewPage') },
])
const fieldGroupKeys = ['group:exposed', 'group:private']

const suggestedBlockKey = computed(() => toKeySlug(name.value, props.defaultKey || 'custom-block'))
const validBlockKey = computed(() => Boolean(normalizeProjectCustomBlockKey(
  blockKey.value.trim() || suggestedBlockKey.value,
)))
const resourceCandidates = computed<readonly ProjectCustomBlockResourceCandidate[]>(() => prepared.value?.resourceAnalysis.candidates ?? [])
const previewToolbarItems = computed(() => createViewportToolbarItems(`${Math.round(viewportScale.value * 100)}%`))
const diagnostics = computed(() => props.errorText ? [props.errorText] : [])
const previewDiagnostics = computed(() => [...new Set([
  ...(previewError.value ? [previewError.value] : []),
  ...diagnostics.value,
  ...packageDiagnostics.value,
])])
const exposedFieldKeys = computed(() => props.fields.map(field => field.key).filter(key => exposed.value.has(key)))
const previewPropertyFieldKeys = computed(() => exposedFieldKeys.value)
const previewFitRect = computed(() => {
  const face = previewFace.value
  const child = face?.children?.[0]
  if (!face || !child) return null
  const width = resolvePreviewLength(child.block.width, face.width)
  const height = resolvePreviewLength(child.block.height, face.height)
  if (width === null || height === null || width <= 0 || height <= 0) return null
  return {
    left: resolvePreviewLength(child.location.x, face.width) ?? 0,
    top: resolvePreviewLength(child.location.y, face.height) ?? 0,
    width,
    height,
  }
})

const fieldTreeActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  ['move-exposed', { title: t('cardDesigner.customBlock.moveToExposed'), icon: 'status.eye' }],
  ['move-private', { title: t('cardDesigner.customBlock.moveToPrivate'), icon: 'status.eye-off' }],
]))
const fieldTreeData = computed<OcTreeData>(() => {
  const items = new Map<string, OcTreeItem>()
  const children = new Map<string, readonly string[]>()
  const publicKeys: string[] = []
  const privateKeys: string[] = []
  for (const field of props.fields) {
    const key = `field:${field.key}`
    const isPublic = exposed.value.has(field.key)
    ;(isPublic ? publicKeys : privateKeys).push(key)
    items.set(key, {
      label: field.title || (te(`propertyEditor.fields.${field.key}`) ? t(`propertyEditor.fields.${field.key}`) : field.key),
      tail: t(field.referenceCount === 1 ? 'cardDesigner.customBlock.referenceCountOne' : 'cardDesigner.customBlock.referenceCountOther', { count: field.referenceCount }),
      icon: getPropertyFieldIcon(field.fieldType),
      draggable: true,
      actions: [isPublic ? 'move-private' : 'move-exposed'],
    })
  }
  items.set('group:exposed', { label: t('cardDesigner.customBlock.exposed'), icon: 'status.eye' })
  items.set('group:private', { label: t('cardDesigner.customBlock.private'), icon: 'status.eye-off' })
  children.set('group:exposed', publicKeys)
  children.set('group:private', privateKeys)
  return { rootKeys: fieldGroupKeys, items, children }
})

const propertyActions = computed<OcCardAction[]>(() => [{
  key: 'reset-preview-values', icon: 'action.discard',
  title: t('customBlockRegistry.preview.reset'), disabled: Object.keys(previewOverrides.value).length === 0,
}])
function clonePreviewValue<T>(value: T, seen = new WeakMap<object, object>()): T {
  if (value === null || typeof value !== 'object') return value
  const source = value as object
  const existing = seen.get(source)
  if (existing) return existing as T
  const copy: unknown[] | Record<string, unknown> = Array.isArray(value) ? [] : {}
  seen.set(source, copy)
  for (const [key, entry] of Object.entries(source)) {
    ;(copy as Record<string, unknown>)[key] = clonePreviewValue(entry, seen)
  }
  return copy as T
}

const propertyInputs = computed<readonly PropertyEditorInput[]>(() => {
  const current = prepared.value
  if (!current || previewPropertyFieldKeys.value.length === 0) return []
  const schema = createProjectCustomBlockPropertySchema(current, previewPropertyFieldKeys.value)
  const fieldKeys = Object.keys(schema.fields)
  const defaults = Object.fromEntries(fieldKeys.map(key => [
    key,
    Object.prototype.hasOwnProperty.call(current.block, key)
      ? clonePreviewValue((current.block as Record<string, unknown>)[key])
      : '',
  ]))
  const values = { ...defaults, ...previewOverrides.value }
  const override = Object.fromEntries(Object.entries(schema.fields).map(([key, definition]) => [
    key,
    { ...definition, required: true, resettable: Object.prototype.hasOwnProperty.call(previewOverrides.value, key) },
  ]))
  const fields = resolveCardPropertyFields({ type: 'custom-block', ...values }, {
    allowDelete: false,
    translate: t,
    hasMessage: te,
    override,
    labels: schema.labels,
    customKeys: schema.customKeys,
  })
  return [{
    key: 'custom-block-export-preview', title: current.manifest.name, record: values,
    fields: Object.fromEntries(Object.entries(fields).filter(([key]) => schema.fields[key]).map(([key, definition]) => [key, { ...definition, category: 'publicFields' }])),
  }]
})
const propertyCategories = computed<ReadonlyMap<string, PropertyEditorCategoryDefinition>>(() => new Map([
  ['publicFields', { title: t('customBlockRegistry.preview.publicFields'), icon: 'entity.block-custom' }],
]))

function clearPreview(): void {
  previewFace.value = null
  previewResources.value = null
}

function resetWorkspace(): void {
  analysisRevision += 1
  manifestRevision += 1
  previewRevision += 1
  manifestQueued = false
  previewQueued = false
  analysisBusy.value = false
  previewRefreshing.value = false
  previewError.value = ''
  packageDiagnostics.value = []
  confirmingDiagnostics.value = false
  clearPreview()
}

watch(() => props.open, open => {
  resetWorkspace()
  if (!open) return
  name.value = props.defaultName
  activePage.value = 'package'
  advancedOpen.value = false
  blockKey.value = ''
  exposed.value = new Set(props.fields.filter(field => field.referenceCount > 0).map(field => field.key))
  selectedResourceIds.value = new Set()
  selectionInitialized.value = false
  previewOverrides.value = {}
  prepared.value = null
  scheduleAnalysis()
}, { immediate: true })
watch([() => props.document, () => props.rootBlockId], () => {
  if (!props.open) return
  selectionInitialized.value = false
  prepared.value = null
  clearPreview()
  scheduleAnalysis()
})
watch([name, blockKey, exposedFieldKeys], scheduleManifestRefresh, { deep: true })
watch(activePage, page => {
  if (page === 'preview') void nextTick().then(fitPreview)
})
watch(selectedResourceIds, schedulePreview, { deep: true })

function scheduleAnalysis(): void {
  if (!props.open) return
  const currentRevision = ++analysisRevision
  queueMicrotask(() => void rebuildPrepared(currentRevision))
}

async function rebuildPrepared(currentRevision: number): Promise<void> {
  if (!props.document || !props.rootBlockId || !validBlockKey.value) {
    if (currentRevision === analysisRevision) prepared.value = null
    return
  }
  analysisBusy.value = true
  previewError.value = ''
  try {
    const result = await prepareProjectCustomBlockExport({
      document: props.document,
      rootBlockId: props.rootBlockId,
      name: name.value,
      blockKey: blockKey.value.trim() || suggestedBlockKey.value,
      exposedFieldKeys: exposedFieldKeys.value,
      projectRootPath: props.projectRootPath,
      project: projectStore.resolvedProject.value,
      dictionary: projectStore.resolvedDictionary.value,
      projectFonts: projectStore.projectFonts.value,
      projectIconSeries: projectStore.projectIconSeries.value,
      customBlockManifestCatalog: projectStore.projectCustomBlockManifestCatalog.value,
      fs: fileSystemService,
    })
    if (currentRevision !== analysisRevision) return
    if ('blocked' in result) {
      prepared.value = null
      previewError.value = t('cardDesigner.customBlock.exportBindingError')
      return
    }
    prepared.value = result
    if (!selectionInitialized.value) {
      selectedResourceIds.value = new Set(result.resourceAnalysis.defaultSelectedIds)
      selectionInitialized.value = true
    } else {
      const available = new Set(result.resourceAnalysis.candidates.map(item => item.id))
      selectedResourceIds.value = new Set([...selectedResourceIds.value].filter(id => available.has(id)))
    }
    schedulePreview()
  } catch (cause) {
    if (currentRevision === analysisRevision) {
      prepared.value = null
      previewError.value = cause instanceof Error ? cause.message : String(cause)
    }
  } finally {
    if (currentRevision === analysisRevision) analysisBusy.value = false
  }
}

function scheduleManifestRefresh(): void {
  if (!props.open || !prepared.value || manifestQueued) return
  manifestQueued = true
  queueMicrotask(() => {
    manifestQueued = false
    void refreshPreparedManifest(++manifestRevision)
  })
}

async function refreshPreparedManifest(currentRevision: number): Promise<void> {
  const base = prepared.value
  if (!base || !validBlockKey.value) return
  try {
    const block = buildProjectCustomBlockRoot(base.block, exposedFieldKeys.value)
    const manifest = await buildProjectCustomBlockManifest({
      root: block,
      key: blockKey.value.trim() || suggestedBlockKey.value,
      name: name.value,
      exposedFieldKeys: exposedFieldKeys.value,
    })
    if (currentRevision !== manifestRevision) return
    prepared.value = { ...base, block, manifest }
    schedulePreview()
  } catch (cause) {
    if (currentRevision === manifestRevision) {
      previewError.value = cause instanceof Error ? cause.message : String(cause)
    }
  }
}

function schedulePreview(): void {
  if (!props.open || !prepared.value || previewQueued) return
  previewQueued = true
  queueMicrotask(() => {
    previewQueued = false
    void refreshPreview(++previewRevision)
  })
}

async function refreshPreview(currentRevision: number): Promise<void> {
  const base = prepared.value
  if (!base) return
  const selectedIds = new Set(selectedResourceIds.value)
  const overrides = { ...previewOverrides.value }
  const dependencyIds = base.resourceAnalysis.candidates.flatMap(candidate => (
    candidate.kind === 'custom-block' && candidate.packageId && selectedIds.has(candidate.id)
      ? [candidate.packageId]
      : []
  ))
  previewRefreshing.value = true
  try {
    await projectStore.ensureProjectCustomBlocksLoaded(dependencyIds)
    const nextPreview = await createProjectCustomBlockPreview({
      prepared: base,
      selectedResourceIds: selectedIds,
      overrides,
      sourceEnvironment: projectStore.projectResourceEnvironment.value,
      sourceFonts: projectStore.projectFonts.value,
      sourceIconSeries: projectStore.projectIconSeries.value,
      sourceIconCatalog: projectStore.projectIconCatalog.value,
      sourceCustomBlockCatalog: projectStore.projectCustomBlockRuntimeCatalog.value,
      remoteResourcePolicy: projectStore.renderEnvironment.value.remoteResourcePolicy,
    })
    if (currentRevision !== previewRevision) return
    previewFace.value = nextPreview.render.document.faces.front
    previewResources.value = nextPreview.render.resources
    previewError.value = ''
    packageDiagnostics.value = nextPreview.render.issues.map(item => t(cardIssueMessageKey(item.type), item.parameters ?? {}))
    await nextTick()
    fitPreview()
  } catch (cause) {
    if (currentRevision === previewRevision) {
      previewError.value = cause instanceof Error ? cause.message : String(cause)
    }
  } finally {
    if (currentRevision === previewRevision) previewRefreshing.value = false
  }
}

function resolvePreviewLength(value: string, parentSize: number): number | null {
  const normalized = value.trim()
  const numeric = Number.parseFloat(normalized)
  if (!Number.isFinite(numeric)) return null
  return normalized.endsWith('%') ? parentSize * numeric / 100 : numeric
}
function fieldKey(treeKey: string): string | null {
  if (treeKey.startsWith('field:')) return treeKey.slice(6)
  return treeKey.startsWith('field:') ? treeKey.slice(6) : null
}
function moveField(key: string, makePublic: boolean): void {
  const next = new Set(exposed.value)
  if (makePublic) next.add(key)
  else next.delete(key)
  exposed.value = next
  if (!makePublic) {
    const overrides = { ...previewOverrides.value }
    delete overrides[key]
    previewOverrides.value = overrides
  }
}
function handleFieldTreeIntent(intent: OcTreeIntent): void {
  const key = 'key' in intent ? fieldKey(intent.key) : null
  if (intent.type === 'action.invoke' && key) moveField(key, intent.actionKey === 'move-exposed')
  if (intent.type === 'move.request' && key) {
    if (intent.targetKey === 'group:exposed') moveField(key, true)
    else if (intent.targetKey === 'group:private') moveField(key, false)
  }
}
function updatePreviewProperty(mutation: PropertyEditorMutation): void {
  if (mutation.key !== 'custom-block-export-preview' || !previewPropertyFieldKeys.value.includes(mutation.fieldKey)) return
  const next = { ...previewOverrides.value }
  if (mutation.value === undefined) delete next[mutation.fieldKey]
  else next[mutation.fieldKey] = mutation.value
  previewOverrides.value = next
  schedulePreview()
}
function resetPreviewOverrides(): void {
  previewOverrides.value = {}
  schedulePreview()
}
function toggleAdvancedSettings(): void {
  if (advancedOpen.value) activePage.value = 'package'
  advancedOpen.value = !advancedOpen.value
}
function fitPreview(): void {
  if (previewFitRect.value && viewportRef.value?.fitContent) viewportRef.value.fitContent(previewFitRect.value)
  else viewportRef.value?.fitView?.()
}
function handleViewportToolbar({ key }: { key: string }): void {
  if (key === 'viewport.zoom-out') viewportRef.value?.zoomBy(1 / VIEWPORT_ZOOM_STEP)
  else if (key === 'viewport.fit') fitPreview()
  else if (key === 'viewport.zoom-in') viewportRef.value?.zoomBy(VIEWPORT_ZOOM_STEP)
}
async function emitExport(): Promise<void> {
  const base = prepared.value
  if (!base) return
  try {
    const block = buildProjectCustomBlockRoot(base.block, exposedFieldKeys.value)
    const manifest = await buildProjectCustomBlockManifest({
      root: block,
      key: blockKey.value.trim() || suggestedBlockKey.value,
      name: name.value,
      exposedFieldKeys: exposedFieldKeys.value,
    })
    emit('submit', {
      name: name.value.trim(),
      blockKey: (blockKey.value.trim() || suggestedBlockKey.value).toLocaleLowerCase(),
      exposedFieldKeys: exposedFieldKeys.value,
      selectedResourceIds: new Set(selectedResourceIds.value),
      prepared: { ...base, block, manifest },
    })
  } catch (cause) {
    previewError.value = cause instanceof Error ? cause.message : String(cause)
  }
}
function submit(): void {
  if (props.busy || !prepared.value || !validBlockKey.value) return
  if (diagnostics.value.length > 0) {
    confirmingDiagnostics.value = true
    return
  }
  void emitExport()
}
function confirmDiagnosticExport(): void {
  confirmingDiagnostics.value = false
  void emitExport()
}
function requestClose(): void { if (!props.busy) emit('close') }

onBeforeUnmount(() => {
  analysisRevision += 1
  manifestRevision += 1
  previewRevision += 1
})
</script>

<style scoped>
.custom-block-export-dialog { display: grid; grid-template-rows: auto minmax(0, 1fr); width: 100%; height: 100%; min-width: 0; min-height: 0; background: var(--oc-bg-inset); }
.custom-block-export-dialog__pages { padding: var(--oc-space-2) var(--oc-space-3); border-bottom: var(--oc-border-width) solid var(--oc-border-muted); background: var(--oc-bg-base); }
.custom-block-export-dialog__package { display: grid; grid-template-rows: auto minmax(0, 1fr); min-width: 0; min-height: 0; overflow: hidden; }
.custom-block-export-dialog__information { border-bottom: var(--oc-border-width) solid var(--oc-border-muted); }
.custom-block-export-dialog__package-columns { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-width: 0; min-height: 0; overflow: hidden; }
.custom-block-export-dialog__section { display: grid; align-content: start; gap: var(--oc-space-2); min-width: 0; min-height: 0; padding: var(--oc-space-3); background: var(--oc-bg-base); }
.custom-block-export-dialog__section h3 { margin: 0; }
.custom-block-export-dialog__section-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--oc-space-2); }
.custom-block-export-dialog__metadata { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--oc-space-3); }
.custom-block-export-dialog__metadata > :deep(.oc-button) { grid-column: 1 / -1; justify-self: start; }
.custom-block-export-dialog__field { display: grid; gap: var(--oc-space-1); min-width: 0; }
.custom-block-export-dialog__fields-section, .custom-block-export-dialog__resources-section { grid-template-rows: auto minmax(0, 1fr); }
.custom-block-export-dialog__fields-section { border-right: var(--oc-border-width) solid var(--oc-border-muted); }
.custom-block-export-dialog__preview { display: grid; grid-template-columns: minmax(0, 1fr) minmax(var(--oc-custom-block-list-min-width), var(--oc-custom-block-preview-properties-width)); min-width: 0; min-height: 0; overflow: hidden; }
.custom-block-export-dialog__viewport-area { position: relative; display: grid; place-items: center; min-width: 0; min-height: 0; overflow: hidden; background-color: var(--oc-bg-raised); background-image: var(--oc-viewport-dot-pattern); background-size: var(--oc-viewport-dot-size); background-position: var(--oc-viewport-dot-position); }
.custom-block-export-dialog__properties { min-width: 0; min-height: 0; overflow: hidden; border-left: var(--oc-border-width) solid var(--oc-border-muted); background: var(--oc-bg-base); }
.custom-block-export-dialog__properties > :deep(.oc-card) { border: 0; border-radius: 0; }
.custom-block-export-dialog__viewport { width: 100%; height: 100%; }
.custom-block-export-dialog__viewport-tools { position: absolute; right: var(--oc-floating-surface-gap); bottom: var(--oc-floating-surface-gap); z-index: var(--oc-z-overlay-toolbar); }
.custom-block-export-dialog__diagnostics { position: absolute; left: var(--oc-floating-surface-gap); bottom: var(--oc-floating-surface-gap); display: grid; gap: var(--oc-space-1); max-width: var(--oc-content-width-md); }
</style>
