<template>
  <OcDialog :open="open" :title="t('resourcePackage.builderTitle')" as="form" size="xl"
    height-mode="fixed" height="workspace" :padded="false" :scrollable="false"
    :dismissible="!busy" :close-on-backdrop="!busy" :aria-busy="busy"
    @request-close="close" @submit.prevent="build">
    <div class="resource-package-builder" :inert="busy ? true : undefined">
      <div class="resource-package-builder__workspace">
        <section class="resource-package-builder__selection" aria-labelledby="resource-package-selection-title">
          <div class="resource-package-builder__section-heading">
            <div>
              <OcText id="resource-package-selection-title" as="h3" size="sm">{{ t('resourcePackage.contents') }}</OcText>
              <OcText size="xs" tone="muted">{{ t('resourcePackage.contentsDescription') }}</OcText>
            </div>
            <OcButton icon-only size="sm" variant="ghost" icon="action.discard"
              :aria-label="t('resourcePackage.clearSelection')" :data-tooltip="t('resourcePackage.clearSelection')"
              :disabled="selectedCount === 0" @click="clearSelection" />
          </div>
          <OcPanel fill padding="none" overflow="auto">
            <OcTree v-if="treeData.rootKeys.length" fill :data="treeData" :actions="treeActions"
              :expanded-keys="expandedKeys" :virtualized="true" selection-mode="none" action-visibility="always"
              :aria-label="t('resourcePackage.contents')" @intent="handleTreeIntent" />
            <OcEmpty v-else tone="muted" inset="comfortable">{{ t('resourcePackage.noCandidates') }}</OcEmpty>
          </OcPanel>
        </section>

        <aside class="resource-package-builder__summary" aria-labelledby="resource-package-summary-title">
          <div class="resource-package-builder__section-heading">
            <div>
              <OcText id="resource-package-summary-title" as="h3" size="sm">{{ t('resourcePackage.packagePreview') }}</OcText>
              <OcText size="xs" tone="muted">{{ t('resourcePackage.packagePreviewDescription') }}</OcText>
            </div>
            <OcIcon name="file.package" size="lg" tone="opencard" />
          </div>
          <div class="resource-package-builder__fields">
            <label>
              <OcText as="span" size="sm">{{ t('resourcePackage.name') }}</OcText>
              <OcFieldInput full-width autofocus :value="name" :disabled="busy"
                @input="name = ($event.target as HTMLInputElement).value" />
            </label>
            <label>
              <OcText as="span" size="sm">{{ t('resourcePackage.key') }}</OcText>
              <OcFieldInput full-width mono :value="packageKey" :placeholder="generatedKey" :disabled="busy"
                @input="packageKey = ($event.target as HTMLInputElement).value" />
            </label>
            <label>
              <OcText as="span" size="sm">{{ t('resourcePackage.version') }}</OcText>
              <OcFieldInput full-width mono :value="version" :disabled="busy"
                @input="version = ($event.target as HTMLInputElement).value" />
            </label>
          </div>
          <OcText v-if="selectedCount" size="sm" tone="muted">
            {{ t('resourcePackage.selectedCount', { count: selectedCount }) }}
          </OcText>
          <div class="resource-package-builder__resource-count">
            <OcText as="span" size="sm" tone="muted">{{ t('resourcePackage.resources') }}</OcText>
            <code>{{ selectedResourceCount }}</code>
          </div>
          <OcText v-if="errorText" class="resource-package-builder__error" tone="danger" role="alert">{{ errorText }}</OcText>
        </aside>
      </div>
    </div>
    <template #footer>
      <OcButton type="button" :disabled="busy" @click="close">{{ t('resourcePackage.cancel') }}</OcButton>
      <OcButton type="submit" variant="solid" icon="file.package" :disabled="busy || !canBuild">
        {{ busy ? t('resourcePackage.building') : t('resourcePackage.build') }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../../../components/base/OcButton.vue'
import OcEmpty from '../../../components/base/OcEmpty.vue'
import OcFieldInput from '../../../components/base/OcFieldInput.vue'
import OcIcon from '../../../components/base/OcIcon.vue'
import OcPanel from '../../../components/base/OcPanel.vue'
import OcText from '../../../components/base/OcText.vue'
import OcDialog from '../../../components/standard/OcDialog.vue'
import OcTree from '../../../components/standard/OcTree.vue'
import { toKeySlug } from '../../../shared/model/keySlug'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent, OcTreeItem } from '../../../shared/ui/tree/tree.types'
import { buildResourcePackageFromProject } from '../services/buildResourcePackage'
import { fileSystemService } from '../services/fileSystemService'
import { useProjectStore } from '../store/projectStore'

const props = defineProps<{ open: boolean, projectRootPath: string, projectName: string, entries: readonly string[] }>()
const emit = defineEmits<{ close: [], built: [path: string] }>()
const { t } = useI18n()
const projectStore = useProjectStore()
const name = ref('')
const packageKey = ref('')
const version = ref('1.0.0')
const explicitlySelectedFamilyKeys = ref<Set<string>>(new Set())
const selectedCompositionKeys = ref<Set<string>>(new Set())
const selectedResourceIds = ref<Set<string>>(new Set())
const busy = ref(false)
const errorText = ref('')

type ResourceKind = 'icons' | 'images'
type PackageCandidate = {
  id: string
  kind: ResourceKind
  label: string
  detail?: string
  paths: readonly string[]
}
const categoryLabels: Record<ResourceKind, string> = {
  icons: 'resourcePackage.icons', images: 'resourcePackage.images',
}
const categoryIcons: Record<ResourceKind, 'file.project-icon' | 'file.image'> = {
  icons: 'file.project-icon', images: 'file.image',
}

function relativePath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  const root = props.projectRootPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  return normalized.toLocaleLowerCase().startsWith(`${root.toLocaleLowerCase()}/`)
    ? normalized.slice(root.length + 1)
    : normalized
}

function projectInternalPath(source: string): string {
  const normalized = source.replace(/\\/g, '/').replace(/^\/+/, '')
  return normalized.toLocaleLowerCase().startsWith('.opencard/') ? normalized : `.opencard/${normalized}`
}

const candidates = computed<readonly PackageCandidate[]>(() => [
  ...projectStore.projectIconSeries.value.map(series => ({
    id: `icon:${series.key}`, kind: 'icons' as const, label: series.name, detail: series.key,
    paths: [projectInternalPath(series.source)],
  })),
  ...props.entries.map(path => ({ path, relative: relativePath(path) }))
    .filter(entry => {
      const lower = entry.relative.toLocaleLowerCase()
      return /\.(png|jpe?g|gif|webp|svg)$/.test(lower)
        && !lower.startsWith('.git/') && lower !== '.git'
        && !lower.startsWith('.opencard/')
    })
    .map(entry => ({ id: `image:${entry.relative}`, kind: 'images' as const, label: entry.relative.split('/').pop() ?? entry.relative, detail: entry.relative, paths: [entry.relative] })),
])
const categories = computed(() => (Object.keys(categoryLabels) as ResourceKind[])
  .map(kind => ({ kind, entries: candidates.value.filter(entry => entry.kind === kind) }))
  .filter(group => group.entries.length > 0))
const requiredFamilyKeys = computed(() => new Set(projectStore.projectFontCompositions.value
  .filter(composition => selectedCompositionKeys.value.has(composition.key))
  .flatMap(composition => composition.members.map(member => member.fontKey))))
const selectedFamilyKeys = computed(() => new Set([
  ...explicitlySelectedFamilyKeys.value,
  ...requiredFamilyKeys.value,
]))
const expandedKeys = computed(() => [...expandedKeySet.value])
const expandedKeySet = ref<Set<string>>(new Set())
const selectedCount = computed(() => selectedFamilyKeys.value.size
  + selectedCompositionKeys.value.size + selectedResourceIds.value.size)
const selectedResourceCount = selectedCount
const generatedKey = computed(() => toKeySlug(name.value.trim(), ''))
const normalizedKey = computed(() => toKeySlug(packageKey.value.trim() || generatedKey.value, ''))
const canBuild = computed(() => Boolean(name.value.trim() && normalizedKey.value && version.value.trim() && selectedResourceCount.value > 0))

const treeActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  ['select', { title: t('resourcePackage.select'), icon: 'action.checkbox-blank' }],
  ['deselect', { title: t('resourcePackage.deselect'), icon: 'action.checkbox-marked' }],
]))
const treeData = computed<OcTreeData>(() => {
  const items = new Map<string, OcTreeItem>()
  const children = new Map<string, string[]>()
  const rootKeys: string[] = []
  const addChild = (parentKey: string, childKey: string): void => {
    const existing = children.get(parentKey) ?? []
    if (!existing.includes(childKey)) children.set(parentKey, [...existing, childKey])
  }
  const families = projectStore.projectFontFamilies.value
  const compositions = projectStore.projectFontCompositions.value
  if (families.length > 0 || compositions.length > 0) {
    const categoryKey = 'category:fonts'
    const familyGroupKey = 'font-group:families'
    const compositionGroupKey = 'font-group:compositions'
    rootKeys.push(categoryKey)
    items.set(categoryKey, {
      label: t('resourcePackage.fonts'), icon: 'file.font', iconTone: 'config',
      tail: `${selectedFamilyKeys.value.size + selectedCompositionKeys.value.size}/${families.length + compositions.length}`,
    })
    items.set(familyGroupKey, {
      label: t('resourcePackage.projectFonts'), icon: 'file.font',
      tail: `${selectedFamilyKeys.value.size}/${families.length}`,
    })
    items.set(compositionGroupKey, {
      label: t('resourcePackage.fontCompositions'), icon: 'data.layers',
      tail: `${selectedCompositionKeys.value.size}/${compositions.length}`,
    })
    children.set(categoryKey, [familyGroupKey, compositionGroupKey])
    children.set(familyGroupKey, families.map(family => {
      const key = `font-family:${family.key}`
      const selected = selectedFamilyKeys.value.has(family.key)
      items.set(key, {
        label: family.name, tail: family.key, icon: 'file.font', iconTone: selected ? 'active' : 'muted',
        actions: [selected ? 'deselect' : 'select'], contextActions: [selected ? 'deselect' : 'select'],
      })
      return key
    }))
    children.set(compositionGroupKey, compositions.map(composition => {
      const key = `font-composition:${composition.key}`
      const selected = selectedCompositionKeys.value.has(composition.key)
      items.set(key, {
        label: composition.name, tail: composition.key, icon: 'data.layers', iconTone: selected ? 'active' : 'muted',
        actions: [selected ? 'deselect' : 'select'], contextActions: [selected ? 'deselect' : 'select'],
      })
      return key
    }))
  }
  for (const group of categories.value) {
    const categoryKey = `category:${group.kind}`
    rootKeys.push(categoryKey)
    items.set(categoryKey, {
      label: t(categoryLabels[group.kind]), icon: categoryIcons[group.kind], iconTone: 'config',
      tail: `${group.entries.filter(entry => selectedResourceIds.value.has(entry.id)).length}/${group.entries.length}`,
    })
    for (const entry of group.entries) {
      const segments = (entry.detail ?? entry.label).split('/')
      const displaySegments = group.kind === 'images' ? segments : [entry.label]
      let parentKey = categoryKey
      let folderPath = ''
      for (const segment of displaySegments.slice(0, -1)) {
        folderPath = folderPath ? `${folderPath}/${segment}` : segment
        const folderKey = `folder:${group.kind}:${folderPath}`
        if (!items.has(folderKey)) {
          items.set(folderKey, { label: segment, icon: 'folder.generic', iconTone: 'muted' })
        }
        addChild(parentKey, folderKey)
        parentKey = folderKey
      }
      const selected = selectedResourceIds.value.has(entry.id)
      items.set(entry.id, {
        label: displaySegments[displaySegments.length - 1] ?? entry.label,
        tail: entry.detail,
        icon: categoryIcons[group.kind], iconTone: selected ? 'active' : 'muted',
        actions: [selected ? 'deselect' : 'select'], contextActions: [selected ? 'deselect' : 'select'],
      })
      addChild(parentKey, entry.id)
    }
  }
  return { rootKeys, items, children }
})

watch(() => props.open, open => {
  if (!open) return
  name.value = props.projectName
  packageKey.value = ''
  version.value = '1.0.0'
  explicitlySelectedFamilyKeys.value = new Set()
  selectedCompositionKeys.value = new Set()
  selectedResourceIds.value = new Set()
  expandedKeySet.value = new Set([
    'category:fonts', 'font-group:families', 'font-group:compositions',
    ...categories.value.map(group => `category:${group.kind}`),
  ])
  errorText.value = ''
})

function close(): void {
  if (!busy.value) emit('close')
}
function clearSelection(): void {
  explicitlySelectedFamilyKeys.value = new Set()
  selectedCompositionKeys.value = new Set()
  selectedResourceIds.value = new Set()
}
function handleTreeIntent(intent: OcTreeIntent): void {
  if (intent.type === 'expansion.change') {
    const next = new Set(expandedKeySet.value)
    if (intent.expanded) next.add(intent.key)
    else next.delete(intent.key)
    expandedKeySet.value = next
    return
  }
  if (intent.type !== 'action.invoke') return
  if (intent.key.startsWith('font-family:')) {
    const familyKey = intent.key.slice('font-family:'.length)
    const nextFamilies = new Set(explicitlySelectedFamilyKeys.value)
    if (intent.actionKey === 'select') nextFamilies.add(familyKey)
    if (intent.actionKey === 'deselect') {
      nextFamilies.delete(familyKey)
      selectedCompositionKeys.value = new Set([...selectedCompositionKeys.value].filter(compositionKey => {
        const composition = projectStore.projectFontCompositions.value.find(entry => entry.key === compositionKey)
        return !composition?.members.some(member => member.fontKey.toLocaleLowerCase() === familyKey.toLocaleLowerCase())
      }))
    }
    explicitlySelectedFamilyKeys.value = nextFamilies
    return
  }
  if (intent.key.startsWith('font-composition:')) {
    const compositionKey = intent.key.slice('font-composition:'.length)
    const next = new Set(selectedCompositionKeys.value)
    if (intent.actionKey === 'select') next.add(compositionKey)
    if (intent.actionKey === 'deselect') next.delete(compositionKey)
    selectedCompositionKeys.value = next
    return
  }
  const next = new Set(selectedResourceIds.value)
  if (intent.actionKey === 'select') next.add(intent.key)
  if (intent.actionKey === 'deselect') next.delete(intent.key)
  selectedResourceIds.value = next
}

async function build(): Promise<void> {
  if (!canBuild.value) return
  busy.value = true
  errorText.value = ''
  try {
    const outputPath = await fileSystemService.pickSavePath({
      defaultPath: `${normalizedKey.value}.ocpack`, fileTypeName: t('resourcePackage.fileType'),
      extensions: ['ocpack'], title: t('resourcePackage.buildTitle'),
    })
    if (!outputPath) return
    const selected = candidates.value.filter(candidate => selectedResourceIds.value.has(candidate.id))
    const result = await buildResourcePackageFromProject({
      fs: fileSystemService, projectRootPath: props.projectRootPath, key: normalizedKey.value,
      name: name.value.trim(), version: version.value.trim(),
      resourcePaths: selected.flatMap(candidate => candidate.paths),
      fontSelection: {
        familyKeys: [...selectedFamilyKeys.value],
        compositionKeys: [...selectedCompositionKeys.value],
      },
      outputPath,
    })
    emit('built', result.outputPath ?? '')
    emit('close')
  } catch (cause) {
    errorText.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.resource-package-builder { display: grid; grid-template-rows: minmax(0, 1fr); height: 100%; min-width: 0; min-height: 0; background: var(--oc-bg-inset); }
.resource-package-builder__fields { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(8rem, 1fr); gap: var(--oc-space-3); }
.resource-package-builder__fields label { display: grid; gap: var(--oc-space-1); min-width: 0; }
.resource-package-builder__workspace { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(18rem, .8fr); min-height: 0; }
.resource-package-builder__selection, .resource-package-builder__summary { min-width: 0; min-height: 0; overflow: hidden; }
.resource-package-builder__selection { display: grid; grid-template-rows: auto minmax(0, 1fr); border-right: var(--oc-border-width) solid var(--oc-border-muted); background: var(--oc-bg-base); }
.resource-package-builder__summary { padding: var(--oc-space-6); background: var(--oc-bg-inset); }
.resource-package-builder__summary .resource-package-builder__fields { grid-template-columns: 1fr; margin-top: var(--oc-space-5); }
.resource-package-builder__section-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--oc-space-3); padding: var(--oc-space-4) var(--oc-space-5); border-bottom: var(--oc-border-width) solid var(--oc-border-muted); }
.resource-package-builder__section-heading > div { display: grid; gap: var(--oc-space-1); min-width: 0; }
.resource-package-builder__section-heading h3 { margin: 0; }
.resource-package-builder__resource-count { display: flex; align-items: center; justify-content: space-between; gap: var(--oc-space-3); margin-top: var(--oc-space-4); padding-top: var(--oc-space-3); border-top: var(--oc-border-width) solid var(--oc-border-muted); }
.resource-package-builder__error { margin-top: var(--oc-space-5); }
@media (max-width: 760px) { .resource-package-builder__fields, .resource-package-builder__workspace { grid-template-columns: 1fr; } .resource-package-builder__workspace { overflow: auto; } .resource-package-builder__selection { min-height: 22rem; border-right: 0; border-bottom: var(--oc-border-width) solid var(--oc-border-muted); } }
</style>
