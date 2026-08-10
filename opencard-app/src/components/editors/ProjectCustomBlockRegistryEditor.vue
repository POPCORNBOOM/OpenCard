<template>
  <ProjectRegistryEditorShell icon="file.custom-block" content-mode="workspace" header-mode="hidden"
    :heading="t('customBlockRegistry.title')" :description="t('customBlockRegistry.description')"
    @keydown.ctrl.s.prevent="save">
    <div v-if="document" class="custom-block-registry-editor" :class="{ 'is-comparison': isComparison }">
      <div class="custom-block-registry-editor__toolbar">
        <OcText as="h2" size="lg" bold>{{ t('customBlockRegistry.title') }}</OcText>
        <OcButton v-if="!isObserveOnly" icon="action.import" variant="solid" :disabled="busy" @click="addBlock">
          {{ t('customBlockRegistry.add') }}
        </OcButton>
      </div>
      <OcText as="p" size="sm" tone="muted">{{ t('customBlockRegistry.description') }}</OcText>
      <OcText v-if="error" as="p" size="sm" tone="danger" role="alert">{{ error }}</OcText>
      <div class="custom-block-registry-editor__body">
        <OcPanel fill padding="none" overflow="auto">
          <OcTree v-if="treeData.rootKeys.length" fill :data="treeData" :actions="actions"
            :selected-keys="selectedTreeKeys" :selection-mode="isComparison ? 'single' : 'none'"
            :activation-mode="isComparison ? 'none' : undefined"
            :aria-label="t('customBlockRegistry.title')" @intent="handleIntent" />
          <div v-else class="custom-block-registry-editor__empty">
            <OcText tone="muted">{{ t('customBlockRegistry.empty') }}</OcText>
          </div>
        </OcPanel>
        <section v-if="isComparison" class="custom-block-registry-editor__details">
          <template v-if="selectedPair">
            <div v-for="side in selectedPairSides" :key="side.key" class="custom-block-registry-editor__detail-side"
              :class="`is-${side.key}`">
              <header><strong>{{ side.marker }} · {{ side.label }}</strong></header>
              <OcEmpty v-if="!side.entry" tone="muted">{{ t('versioning.diff.missing') }}</OcEmpty>
              <dl v-else>
                <div><dt>{{ t('customBlockRegistry.path') }}</dt><dd>{{ side.entry.path }}</dd></div>
                <div><dt>{{ t('customBlockPackage.name') }}</dt><dd>{{ side.entry.manifest?.name ?? t('customBlockRegistry.packageUnavailable') }}</dd></div>
                <div><dt>{{ t('customBlockPackage.key') }}</dt><dd>{{ side.entry.manifest?.key ?? '—' }}</dd></div>
                <div><dt>{{ t('customBlockPackage.interfaceHash') }}</dt><dd>{{ side.entry.manifest?.interfaceHash ?? '—' }}</dd></div>
                <div><dt>{{ t('customBlockPackage.resize') }}</dt><dd>{{ resizeDescription(side.entry.manifest) }}</dd></div>
              </dl>
              <section v-if="side.entry?.manifest?.resources" class="custom-block-registry-editor__resources">
                <strong>{{ t('customBlockRegistry.resources') }}</strong>
                <ul>
                  <li v-for="resource in manifestResources(side.entry.manifest)" :key="resource">{{ resource }}</li>
                </ul>
              </section>
            </div>
          </template>
          <OcEmpty v-else tone="muted">{{ t('customBlockRegistry.noSelection') }}</OcEmpty>
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
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import {
  parseProjectCustomBlockRegistryText,
  serializeProjectCustomBlockRegistry,
  type ProjectCustomBlockManifest,
  type ProjectCustomBlockRegistryDocument,
} from '../../features/workspace/model/projectCustomBlocks'
import { readProjectCustomBlockPackage } from '../../features/workspace/services/projectCustomBlock'
import { registerProjectCustomBlockPath, unregisterProjectCustomBlockPath } from '../../features/workspace/services/projectCustomBlockRegistry'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent } from '../../shared/ui/tree/tree.types'
import { orderedPair, type OrderedPairEntry } from '../../shared/model/orderedPair'
import ProjectRegistryEditorShell from './ProjectRegistryEditorShell.vue'
import ProjectRegistryRepairEditor from './ProjectRegistryRepairEditor.vue'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const projectStore = useProjectStore()
const document = ref<ProjectCustomBlockRegistryDocument | null>(null)
const busy = ref(false)
const error = ref('')
const themeId = computed(() => props.themeId ?? 'dark')
const themeOverrides = computed(() => props.themeOverrides ?? {})
const isObserveOnly = computed(() => props.access === 'observe-only')
const isComparison = computed(() => isObserveOnly.value && props.comparisonContent !== undefined)
const comparisonCurrentContent = computed(() => props.comparisonSide === 'historical'
  ? props.comparisonContent ?? '' : props.modelValue ?? '')
const comparisonHistoricalContent = computed(() => props.comparisonSide === 'historical'
  ? props.modelValue ?? '' : props.comparisonContent ?? '')
const comparisonCurrentRoot = computed(() => props.comparisonSide === 'historical'
  ? props.comparisonResourceRootPath : props.resourceRootPath)
const comparisonHistoricalRoot = computed(() => props.comparisonSide === 'historical'
  ? props.resourceRootPath : props.comparisonResourceRootPath)
type RegistryEntry = { path: string; manifest: ProjectCustomBlockManifest | null }
type RegistryEntryWithIdentity = RegistryEntry & { identity: string }
const historicalEntries = ref<readonly RegistryEntry[]>([])
const currentEntries = ref<readonly RegistryEntry[]>([])
const selectedTreeKey = ref<string | null>(null)
let packageLoadGeneration = 0
const actions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  ['remove', { title: t('customBlockRegistry.remove'), icon: 'action.delete', iconTone: 'danger' }],
]))
const treeData = computed<OcTreeData>(() => {
  const pairs: readonly OrderedPairEntry<RegistryEntryWithIdentity>[] = isComparison.value
    ? comparisonPairs.value
    : (document.value?.blocks ?? []).map((path, index) => ({
      status: 'right-only' as const,
      leftItem: null,
      leftIndex: null,
      rightItem: { path, manifest: null, identity: path },
      rightIndex: index,
    }))
  return {
    rootKeys: pairs.map(pairKey),
    items: new Map(pairs.map(pair => {
      const key = pairKey(pair)
      const historical = pair.leftItem
      const current = pair.rightItem
      const changed = isComparison.value && pairChanged(pair)
      return [key, {
        label: (current?.path ?? historical?.path ?? key).split('/').pop() ?? key,
        tail: current?.path ?? historical?.path ?? key,
        icon: 'file.custom-block',
        changeMarkers: changed ? changeMarkers(pair) : undefined,
        actions: isObserveOnly.value ? [] : ['remove'],
        contextActions: isObserveOnly.value ? [] : ['remove'],
      }]
    })),
    children: new Map(),
  }
})

const selectedTreeKeys = computed(() => selectedTreeKey.value ? [selectedTreeKey.value] : [])
const comparisonPairs = computed(() => pairRegistryEntries(historicalEntries.value, currentEntries.value))
const selectedPair = computed(() => isComparison.value
  ? comparisonPairs.value.find(pair => pairKey(pair) === selectedTreeKey.value) ?? comparisonPairs.value[0] ?? null
  : null)
const selectedPairSides = computed(() => selectedPair.value ? [
  { key: 'historical' as const, marker: 'A', label: t('versioning.diff.historical'), entry: selectedPair.value.leftItem },
  { key: 'current' as const, marker: 'B', label: t('versioning.diff.current'), entry: selectedPair.value.rightItem },
] : [])

watch(() => props.modelValue, content => {
  document.value = parseProjectCustomBlockRegistryText(content ?? '')
  if (isComparison.value) {
    const current = parseProjectCustomBlockRegistryText(comparisonCurrentContent.value)
    const historical = parseProjectCustomBlockRegistryText(comparisonHistoricalContent.value)
    currentEntries.value = (current?.blocks ?? []).map(path => ({ path, manifest: null }))
    historicalEntries.value = (historical?.blocks ?? []).map(path => ({ path, manifest: null }))
  }
}, { immediate: true })
watch([
  () => props.modelValue,
  () => props.comparisonContent,
  () => props.resourceRootPath,
  () => props.comparisonResourceRootPath,
], () => void loadPackageEntries(), { immediate: true })

async function loadPackageEntries(): Promise<void> {
  const generation = ++packageLoadGeneration
  const currentDocument = parseProjectCustomBlockRegistryText(comparisonCurrentContent.value)
  const historicalDocument = parseProjectCustomBlockRegistryText(comparisonHistoricalContent.value)
  if (!isComparison.value || !currentDocument || !historicalDocument) {
    currentEntries.value = []
    historicalEntries.value = []
    return
  }
  const load = async (rootPath: string | null | undefined, paths: readonly string[]): Promise<readonly RegistryEntry[]> => {
    return await Promise.all(paths.map(async path => {
      try {
        const root = rootPath?.replace(/[/\\]+$/, '')
        const separator = root?.includes('\\') ? '\\' : '/'
        const absolutePath = root ? `${root}${separator}${path.replace(/[/\\]/g, separator)}` : path
        const packageData = await readProjectCustomBlockPackage(fileSystemService, absolutePath)
        return { path, manifest: packageData.manifest }
      } catch {
        return { path, manifest: null }
      }
    }))
  }
  const [historical, current] = await Promise.all([
    load(comparisonHistoricalRoot.value, historicalDocument.blocks ?? []),
    load(comparisonCurrentRoot.value, currentDocument.blocks ?? []),
  ])
  if (generation !== packageLoadGeneration) return
  historicalEntries.value = historical
  currentEntries.value = current
  if (!selectedTreeKey.value || !comparisonPairs.value.some(pair => pairKey(pair) === selectedTreeKey.value)) {
    selectedTreeKey.value = comparisonPairs.value[0] ? pairKey(comparisonPairs.value[0]) : null
  }
}

function commit(next: ProjectCustomBlockRegistryDocument): void {
  if (isObserveOnly.value) return
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
  if (isObserveOnly.value || !document.value || busy.value) return
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
  if (isComparison.value && intent.type === 'selection.change') {
    selectedTreeKey.value = intent.selectedKeys[0] ?? null
    return
  }
  if (isObserveOnly.value || !document.value || intent.type !== 'action.invoke' || intent.actionKey !== 'remove') return
  void commitAndSave(unregisterProjectCustomBlockPath(document.value, intent.key))
}

function pairRegistryEntries(historical: readonly RegistryEntry[], current: readonly RegistryEntry[]): readonly OrderedPairEntry<RegistryEntryWithIdentity>[] {
  const unmatchedHistorical = new Set(historical.map((_, index) => index))
  const currentItems = current.map((entry, index) => {
    const historicalIndex = historical.findIndex((candidate, candidateIndex) => {
      if (!unmatchedHistorical.has(candidateIndex)) return false
      return sameRegistryIdentity(candidate, entry)
    })
    if (historicalIndex >= 0) unmatchedHistorical.delete(historicalIndex)
    return {
      ...entry,
      identity: historicalIndex >= 0 ? `pair:${historicalIndex}` : `current:${index}`,
    }
  })
  const historicalItems = historical.map((entry, index) => ({
    ...entry,
    identity: `pair:${index}`,
  }))
  return orderedPair(historicalItems, currentItems, entry => entry.identity)
}

function sameRegistryIdentity(left: RegistryEntry, right: RegistryEntry): boolean {
  if (left.path.toLocaleLowerCase() === right.path.toLocaleLowerCase()) return true
  const leftKey = left.manifest?.key.toLocaleLowerCase()
  const rightKey = right.manifest?.key.toLocaleLowerCase()
  if (leftKey && rightKey && leftKey === rightKey) return true
  const leftHash = left.manifest?.interfaceHash
  const rightHash = right.manifest?.interfaceHash
  return Boolean(leftHash && rightHash && leftHash === rightHash)
}

function pairKey(pair: OrderedPairEntry<RegistryEntryWithIdentity>): string {
  return pair.rightItem?.path ?? pair.leftItem?.path ?? pair.status
}

function pairChanged(pair: OrderedPairEntry<RegistryEntryWithIdentity>): boolean {
  if (pair.status !== 'matched') return true
  return pair.leftItem?.path.toLocaleLowerCase() !== pair.rightItem?.path.toLocaleLowerCase()
    || JSON.stringify(pair.leftItem?.manifest) !== JSON.stringify(pair.rightItem?.manifest)
}

function changeMarkers(pair: OrderedPairEntry<RegistryEntryWithIdentity>): { icon: 'status.change-added' | 'status.change-removed'; tone: 'success' | 'danger' }[] {
  if (pair.status === 'left-only') return [{ icon: 'status.change-removed', tone: 'danger' }]
  if (pair.status === 'right-only') return [{ icon: 'status.change-added', tone: 'success' }]
  return [
    { icon: 'status.change-removed', tone: 'danger' },
    { icon: 'status.change-added', tone: 'success' },
  ]
}

function resizeDescription(manifest: ProjectCustomBlockManifest | null): string {
  if (!manifest) return t('customBlockRegistry.packageUnavailable')
  const { widthLocked, heightLocked } = manifest.resize
  if (widthLocked && heightLocked) return t('customBlockPackage.resizeLocked')
  if (widthLocked) return t('customBlockPackage.widthLocked')
  if (heightLocked) return t('customBlockPackage.heightLocked')
  return t('customBlockPackage.resizeFree')
}

function manifestResources(manifest: ProjectCustomBlockManifest): string[] {
  return [
    ...(manifest.resources?.fonts ?? []).map(resource => `${resource.name} · ${resource.source}`),
    ...(manifest.resources?.images ?? []).map(resource => `${resource.key} · ${resource.source}`),
    ...(manifest.resources?.iconSeries ?? []).map(series => `${series.name} · ${series.source}`),
  ]
}

function updateRawSource(content: string): void {
  if (isObserveOnly.value) return
  emit('update:modelValue', content)
}

function save(): void {
  if (isObserveOnly.value) return
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
  grid-template-rows: auto auto auto minmax(0, 1fr);
  gap: var(--oc-space-3);
  padding: var(--oc-space-4);
}

.custom-block-registry-editor__body {
  display: grid;
  grid-template-columns: minmax(14rem, 22rem) minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.custom-block-registry-editor:not(.is-comparison) .custom-block-registry-editor__body {
  grid-template-columns: minmax(0, 1fr);
}

.custom-block-registry-editor__details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-width: 0;
  min-height: 0;
  overflow: auto;
  background: var(--oc-bg-base);
}

.custom-block-registry-editor__detail-side {
  display: grid;
  align-content: start;
  gap: var(--oc-space-3);
  min-width: 0;
  padding: var(--oc-space-4);
  border-left: var(--oc-border-width) solid var(--oc-border-muted);
}

.custom-block-registry-editor__detail-side.is-historical { background: var(--oc-bg-danger-subtle); }
.custom-block-registry-editor__detail-side.is-current { background: var(--oc-bg-accent-subtle); }
.custom-block-registry-editor__detail-side header { color: var(--oc-fg-muted); font-size: var(--oc-text-sm); }
.custom-block-registry-editor__detail-side dl { display: grid; gap: var(--oc-space-2); margin: 0; }
.custom-block-registry-editor__detail-side dl > div { display: grid; gap: var(--oc-space-1); }
.custom-block-registry-editor__detail-side dt { color: var(--oc-fg-muted); font-size: var(--oc-text-sm); }
.custom-block-registry-editor__detail-side dd { margin: 0; overflow-wrap: anywhere; color: var(--oc-fg-default); }
.custom-block-registry-editor__resources { display: grid; gap: var(--oc-space-2); }
.custom-block-registry-editor__resources ul { display: grid; gap: var(--oc-space-1); margin: 0; padding-left: var(--oc-space-4); }

.custom-block-registry-editor__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oc-space-3);
}

.custom-block-registry-editor__empty {
  min-height: var(--oc-size-2xl);
  display: grid;
  place-items: center;
  padding: var(--oc-space-4);
}
</style>
