<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CardViewport from '../card-rendering/components/CardViewport.vue'
import OcTree from '../../components/standard/OcTree.vue'
import type { OcTreeData, OcTreeIntent } from '../../shared/ui/tree/tree.types'
import { prepareCardRender, type CardRenderEnvironment } from '../card-rendering/renderPipeline'
import { normalizeCardDocument } from '../../entities/card/storage'
import type { EditorComparisonInput } from '../editor-runtime/registry/editorRegistry'
import { compareOcdocuments, type OcdocumentChangeKind } from '../version-control/ocdocumentDiff'
const props = defineProps<{ comparison: EditorComparisonInput; environment: Readonly<CardRenderEnvironment> }>()
const { t } = useI18n()
const faceKey = ref<'front' | 'back'>('front')
const transform = ref({ x: 0, y: 0, scale: 1 })
const selectedInstanceId = ref<string | null>(null)
const beforeDocument = computed(() => { try { return normalizeCardDocument(JSON.parse(props.comparison.before.content)).document } catch { return null } })
const afterDocument = computed(() => { try { return normalizeCardDocument(JSON.parse(props.comparison.after.content)).document } catch { return null } })
const diffModel = computed(() => compareOcdocuments(props.comparison.before.content, props.comparison.after.content))
function environmentFor(snapshot: EditorComparisonInput['before']): CardRenderEnvironment {
  return {
    ...props.environment,
    project: snapshot.project ?? props.environment.project,
    dictionary: snapshot.dictionary ?? props.environment.dictionary,
    projectIconCatalog: snapshot.projectIconCatalog ?? props.environment.projectIconCatalog,
    customBlockCatalog: snapshot.customBlockCatalog ?? props.environment.customBlockCatalog,
    remoteResourcePolicy: snapshot.remoteResourcePolicy ?? props.environment.remoteResourcePolicy,
  }
}
const selectedBeforeInstance = computed(() => selectedInstanceId.value && beforeDocument.value ? beforeDocument.value.instances.find(instance => instance.id === selectedInstanceId.value) ?? null : null)
const selectedAfterInstance = computed(() => selectedInstanceId.value && afterDocument.value ? afterDocument.value.instances.find(instance => instance.id === selectedInstanceId.value) ?? null : null)
const beforeRender = computed(() => beforeDocument.value ? prepareCardRender({ document: beforeDocument.value, instance: selectedBeforeInstance.value, resourceRootPath: props.comparison.before.resourceRootPath ?? null, environment: environmentFor(props.comparison.before) }) : null)
const afterRender = computed(() => afterDocument.value ? prepareCardRender({ document: afterDocument.value, instance: selectedAfterInstance.value, resourceRootPath: props.comparison.after.resourceRootPath ?? null, environment: environmentFor(props.comparison.after) }) : null)
const beforeFace = computed(() => beforeRender.value?.document.faces[faceKey.value] ?? null)
const afterFace = computed(() => afterRender.value?.document.faces[faceKey.value] ?? null)
function blockHighlightMap(side: 'before' | 'after') {
  const result = new Map<string, OcdocumentChangeKind>()
  if (!diffModel.value.ok) return result
  for (const change of diffModel.value.changes) {
    if (!change.blockId || change.faceKey !== faceKey.value) continue
    if (side === 'before' && change.kind === 'added') continue
    if (side === 'after' && change.kind === 'removed') continue
    const kind = change.kind
    const current = result.get(change.blockId)
    if (current === 'moved' || (current === 'changed' && kind !== 'moved')) continue
    result.set(change.blockId, kind)
  }
  return result
}
const beforeHighlights = computed(() => [...blockHighlightMap('before')].map(([blockId, kind]) => ({ blockId, kind })))
const afterHighlights = computed(() => [...blockHighlightMap('after')].map(([blockId, kind]) => ({ blockId, kind })))
const treeData = computed<OcTreeData>(() => {
  const items = new Map<string, OcTreeData['items'] extends ReadonlyMap<string, infer Item> ? Item : never>()
  const rootKeys = ['diff:blueprint']
  items.set('diff:blueprint', { label: t('cardDesigner.dataTable.blueprint'), icon: 'file.opencard' })
  const ids = new Set([...(beforeDocument.value?.instances ?? []).map(item => item.id), ...(afterDocument.value?.instances ?? []).map(item => item.id)])
  for (const id of ids) {
    const before = beforeDocument.value?.instances.find(item => item.id === id)
    const after = afterDocument.value?.instances.find(item => item.id === id)
    items.set(`diff:instance:${id}`, {
      label: after?.name || before?.name || id,
      icon: 'file.opencard',
      displayActions: { leading: [{ key: before && after ? 'same' : after ? 'added' : 'removed', icon: before && after ? 'action.check' : 'action.add', tone: after ? 'success' : 'danger' }] },
    })
    rootKeys.push(`diff:instance:${id}`)
  }
  return { rootKeys, items, children: new Map() }
})
function handleTreeIntent(intent: OcTreeIntent) {
  if (intent.type !== 'selection.change') return
  const key = intent.selectedKeys[0]
  selectedInstanceId.value = key?.startsWith('diff:instance:') ? key.slice('diff:instance:'.length) : null
}
</script>
<template>
  <section class="card-design-diff-view">
    <div class="card-design-diff-view__toolbar"><button type="button" :class="{ active: faceKey === 'front' }" @click="faceKey = 'front'">{{ t('sidebar.diffViewer.front') }}</button><button type="button" :class="{ active: faceKey === 'back' }" @click="faceKey = 'back'">{{ t('sidebar.diffViewer.back') }}</button></div>
    <div v-if="beforeRender && afterRender && beforeFace && afterFace" class="card-design-diff-view__body"><OcTree class="card-design-diff-view__tree" :data="treeData" :selected-keys="selectedInstanceId ? [`diff:instance:${selectedInstanceId}`] : ['diff:blueprint']" role="tree" selection-mode="single" activation-mode="none" @intent="handleTreeIntent" /><div class="card-design-diff-view__viewports"><CardViewport :face="beforeFace" :resource-context="beforeRender.resources" readonly :transform="transform" :diff-highlights="beforeHighlights" @viewport-transform-change="transform = $event" /><CardViewport :face="afterFace" :resource-context="afterRender.resources" readonly :transform="transform" :diff-highlights="afterHighlights" @viewport-transform-change="transform = $event" /></div></div>
    <p v-else class="card-design-diff-view__error">{{ t('sidebar.diffViewer.parseFailed', { message: 'invalid document' }) }}</p>
  </section>
</template>
<style scoped>
.card-design-diff-view { display:flex; flex-direction:column; width:100%; height:100%; min-width:0; min-height:0; background:var(--oc-bg-base); }
.card-design-diff-view__toolbar { display:flex; gap:var(--oc-space-2); padding:var(--oc-space-2); border-bottom:var(--oc-border-width) solid var(--oc-border-muted); }
.card-design-diff-view__toolbar button { min-height:var(--oc-size-sm); padding:0 var(--oc-space-3); border:0; border-radius:var(--oc-radius-sm); background:transparent; color:inherit; }
.card-design-diff-view__toolbar button.active { background:var(--oc-bg-selected); color:var(--oc-fg-accent); }
.card-design-diff-view__viewports { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); flex:1; min-height:0; gap:var(--oc-space-2); }
.card-design-diff-view__viewports > * { min-width:0; min-height:0; }
.card-design-diff-view__body { display:grid; grid-template-columns:minmax(180px, 240px) minmax(0, 1fr); flex:1; min-height:0; }
.card-design-diff-view__tree { min-height:0; border-right:var(--oc-border-width) solid var(--oc-border-muted); }
</style>
