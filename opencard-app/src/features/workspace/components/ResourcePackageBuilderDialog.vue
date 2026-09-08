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
              <OcFieldInput variant="underline" full-width autofocus :value="name" :disabled="busy"
                @input="name = ($event.target as HTMLInputElement).value" />
            </label>
            <label>
              <OcText as="span" size="sm">{{ t('resourcePackage.key') }}</OcText>
              <OcFieldInput variant="underline" full-width mono :value="packageKey" :placeholder="generatedKey" :disabled="busy"
                @input="packageKey = ($event.target as HTMLInputElement).value" />
            </label>
            <label>
              <OcText as="span" size="sm">{{ t('resourcePackage.version') }}</OcText>
              <OcFieldInput variant="underline" full-width mono :value="version" :disabled="busy"
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
import { resolveFileType } from '../model/fileTypes'
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
const selectedFamilyKeys = ref<Set<string>>(new Set())
const selectedCompositionKeys = ref<Set<string>>(new Set())
const selectedIconSeriesKeys = ref<Set<string>>(new Set())
const selectedImageIds = ref<Set<string>>(new Set())
const busy = ref(false)
const errorText = ref('')

type PackageCandidate = {
  id: string
  label: string
  detail?: string
}

function projectRelativePath(path: string): string | null {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/g, '')
  const root = props.projectRootPath.replace(/\\/g, '/').replace(/\/+$/g, '')
  if (!root) return null
  const absolute = normalized.startsWith('/') || /^[a-z]:\//i.test(normalized)
  const relative = absolute
    ? normalized.toLocaleLowerCase().startsWith(`${root.toLocaleLowerCase()}/`)
      ? normalized.slice(root.length + 1)
      : ''
    : normalized
  const segments = relative.split('/')
  return relative && !/^[a-z]:/i.test(relative)
    && segments.every(segment => segment && segment !== '.' && segment !== '..')
    ? relative
    : null
}

const imageCandidates = computed<readonly PackageCandidate[]>(() => [
  ...props.entries.map(projectRelativePath)
    .filter((relative): relative is string => Boolean(relative))
    .filter(relative => {
      const lower = relative.toLocaleLowerCase()
      return resolveFileType(relative, props.projectRootPath).id === 'image'
        && !lower.startsWith('.git/') && lower !== '.git'
        && !lower.startsWith('.opencard/')
    })
    .map(relative => ({
      id: `image:${relative}`,
      label: relative.split('/').pop() ?? relative,
      detail: relative,
    })),
])
const expandedKeys = computed(() => [...expandedKeySet.value])
const expandedKeySet = ref<Set<string>>(new Set())
const selectedCount = computed(() => selectedFamilyKeys.value.size
  + selectedCompositionKeys.value.size + selectedIconSeriesKeys.value.size + selectedImageIds.value.size)
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
  const iconSeries = projectStore.projectIconSeries.value
  if (iconSeries.length > 0) {
    const categoryKey = 'category:icons'
    rootKeys.push(categoryKey)
    items.set(categoryKey, {
      label: t('resourcePackage.icons'), icon: 'file.project-icon', iconTone: 'config',
      tail: `${selectedIconSeriesKeys.value.size}/${iconSeries.length}`,
    })
    children.set(categoryKey, iconSeries.map(series => {
      const key = `icon-series:${series.key}`
      const selected = selectedIconSeriesKeys.value.has(series.key)
      items.set(key, {
        label: series.name, tail: series.key, icon: 'file.project-icon', iconTone: selected ? 'active' : 'muted',
        actions: [selected ? 'deselect' : 'select'], contextActions: [selected ? 'deselect' : 'select'],
      })
      return key
    }))
  }
  if (imageCandidates.value.length > 0) {
    const categoryKey = 'category:images'
    rootKeys.push(categoryKey)
    items.set(categoryKey, {
      label: t('resourcePackage.images'), icon: 'file.image', iconTone: 'config',
      tail: `${imageCandidates.value.filter(entry => selectedImageIds.value.has(entry.id)).length}/${imageCandidates.value.length}`,
    })
    for (const entry of imageCandidates.value) {
      const segments = (entry.detail ?? entry.label).split('/')
      let parentKey = categoryKey
      let folderPath = ''
      for (const segment of segments.slice(0, -1)) {
        folderPath = folderPath ? `${folderPath}/${segment}` : segment
        const folderKey = `folder:images:${folderPath}`
        if (!items.has(folderKey)) {
          items.set(folderKey, { label: segment, icon: 'folder.generic', iconTone: 'muted' })
        }
        addChild(parentKey, folderKey)
        parentKey = folderKey
      }
      const selected = selectedImageIds.value.has(entry.id)
      items.set(entry.id, {
        label: segments[segments.length - 1] ?? entry.label,
        tail: entry.detail,
        icon: 'file.image', iconTone: selected ? 'active' : 'muted',
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
  selectedFamilyKeys.value = new Set()
  selectedCompositionKeys.value = new Set()
  selectedIconSeriesKeys.value = new Set()
  selectedImageIds.value = new Set()
  expandedKeySet.value = new Set([
    'category:fonts', 'font-group:families', 'font-group:compositions', 'category:icons', 'category:images',
  ])
  errorText.value = ''
})

function close(): void {
  if (!busy.value) emit('close')
}
function clearSelection(): void {
  selectedFamilyKeys.value = new Set()
  selectedCompositionKeys.value = new Set()
  selectedIconSeriesKeys.value = new Set()
  selectedImageIds.value = new Set()
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
    const nextFamilies = new Set(selectedFamilyKeys.value)
    if (intent.actionKey === 'select') nextFamilies.add(familyKey)
    if (intent.actionKey === 'deselect') nextFamilies.delete(familyKey)
    selectedFamilyKeys.value = nextFamilies
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
  if (intent.key.startsWith('icon-series:')) {
    const seriesKey = intent.key.slice('icon-series:'.length)
    const next = new Set(selectedIconSeriesKeys.value)
    if (intent.actionKey === 'select') next.add(seriesKey)
    if (intent.actionKey === 'deselect') next.delete(seriesKey)
    selectedIconSeriesKeys.value = next
    return
  }
  const next = new Set(selectedImageIds.value)
  if (intent.actionKey === 'select') next.add(intent.key)
  if (intent.actionKey === 'deselect') next.delete(intent.key)
  selectedImageIds.value = next
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
    const selected = imageCandidates.value.filter(candidate => selectedImageIds.value.has(candidate.id))
    const result = await buildResourcePackageFromProject({
      fs: fileSystemService, projectRootPath: props.projectRootPath, key: normalizedKey.value,
      name: name.value.trim(), version: version.value.trim(),
      imageSelection: { paths: selected.map(candidate => candidate.detail ?? candidate.label) },
      fontSelection: {
        familyKeys: [...selectedFamilyKeys.value],
        compositionKeys: [...selectedCompositionKeys.value],
      },
      iconSelection: { seriesKeys: [...selectedIconSeriesKeys.value] },
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
