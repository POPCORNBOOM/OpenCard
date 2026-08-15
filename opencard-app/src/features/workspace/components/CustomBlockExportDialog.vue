<template>
  <OcDialog :open="open" :title="dialogTitle" as="form" size="lg" min-height="md" max-height="viewport"
    :dismissible="!busy" :close-on-backdrop="!busy" :aria-busy="busy"
    @request-close="requestClose" @submit="submit">
    <div class="custom-block-export-dialog" :inert="busy ? true : undefined">
      <OcText as="h3" size="sm">{{ fieldsLabel }}</OcText>
      <OcPanel class="custom-block-export-dialog__fields" fill padding="none" overflow="auto">
        <OcTree fill :data="treeData" :actions="treeActions" :selected-keys="[]"
          :expanded-keys="groupKeys" :aria-label="fieldsLabel"
          selection-mode="none" action-visibility="always" @intent="handleTreeIntent" />
      </OcPanel>
      <section class="custom-block-export-dialog__resources" :aria-label="resourcesLabel">
        <OcText as="h3" size="sm">{{ resourcesLabel }}</OcText>
        <div class="custom-block-export-dialog__resource-workspace">
          <OcPanel class="custom-block-export-dialog__resource-tree" fill padding="none" overflow="auto">
            <OcTree fill :data="resourceTreeData" :selected-keys="selectedResourceKeys"
              :expanded-keys="resourceGroupKeys" :aria-label="resourcesLabel"
              selection-mode="single" activation-mode="single-click" @intent="handleResourceTreeIntent" />
          </OcPanel>
          <OcPanel class="custom-block-export-dialog__resource-preview" fill padding="3" overflow="hidden">
            <template v-if="resourcePreviewItem">
              <OcText as="h4" size="sm" class="custom-block-export-dialog__preview-title">
                {{ resourcePreviewItem.label }}
              </OcText>
              <div v-if="resourcePreviewItem.kind === 'image'" class="custom-block-export-dialog__image-preview">
                <img :src="resourcePreviewItem.src" :alt="resourcePreviewItem.label" />
              </div>
              <div v-else-if="resourcePreviewItem.kind === 'font'"
                class="custom-block-export-dialog__font-preview" :style="{ fontFamily: resourcePreviewItem.fontFamily }">
                {{ fontPreviewText }}
              </div>
              <div v-else class="custom-block-export-dialog__icon-preview">
                <ProjectIconView v-if="resourcePreviewItem.entry" :entry="resourcePreviewItem.entry" mode="preview" />
              </div>
              <OcText as="p" size="xs" tone="muted" class="custom-block-export-dialog__preview-source">
                {{ resourcePreviewItem.source }}
              </OcText>
            </template>
            <OcText v-else-if="resourcePreviewLoading" size="sm" tone="muted">{{ resourcesLoadingLabel }}</OcText>
            <OcText v-else size="sm" tone="muted">{{ resourceEmptyLabel }}</OcText>
          </OcPanel>
        </div>
      </section>
      <div class="custom-block-export-dialog__metadata">
        <label class="custom-block-export-dialog__field">
          <OcText as="span" size="sm">{{ nameLabel }}</OcText>
          <OcFieldInput full-width autofocus :value="name" :aria-invalid="!name.trim()" :disabled="busy"
            @input="name = ($event.target as HTMLInputElement).value" />
        </label>
        <label class="custom-block-export-dialog__field">
          <OcText as="span" size="sm">{{ keyLabel }}</OcText>
          <OcFieldInput full-width mono :value="key" :placeholder="suggestedKey"
            :aria-invalid="!validKey" :disabled="busy"
            @input="key = ($event.target as HTMLInputElement).value" />
        </label>
      </div>
      <OcText v-if="errorText" as="p" size="sm" tone="danger" role="alert">{{ errorText }}</OcText>
    </div>
    <template #footer>
      <OcButton type="button" :disabled="busy" @click="requestClose">{{ cancelLabel }}</OcButton>
      <OcButton type="submit" variant="solid" :disabled="busy || !name.trim() || !validKey">
        {{ busy ? busyLabel : exportLabel }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import OcDialog from '../../../components/standard/OcDialog.vue'
import OcTree from '../../../components/standard/OcTree.vue'
import OcPanel from '../../../components/base/OcPanel.vue'
import OcButton from '../../../components/base/OcButton.vue'
import OcFieldInput from '../../../components/base/OcFieldInput.vue'
import OcText from '../../../components/base/OcText.vue'
import ProjectIconView from './ProjectIconView.vue'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent, OcTreeItem } from '../../../shared/ui/tree/tree.types'
import type { CustomBlockFieldAnalysis } from '../services/projectCustomBlockExportAnalyzer'
import { projectFontSources } from '../model/projectFontRegistry'
import type { ProjectCustomBlockResourceIndex } from '../model/projectCustomBlocks'
import type { ProjectCustomBlockResizePolicy } from '../model/projectCustomBlocks'
import { normalizeProjectCustomBlockKey } from '../model/projectCustomBlocks'
import { buildProjectIconCatalog, createProjectIconPreviewStyle, type ProjectIconCatalogEntry } from '../services/projectIconCatalog'
import { toKeySlug } from '../../../shared/model/keySlug'
import {
  createProjectCustomBlockFontSession,
  type ProjectCustomBlockFontSession,
} from '../services/projectCustomBlockFontLoader'
import { createProjectCustomBlockFontFamily } from '../services/projectCustomBlockResources'

const props = withDefaults(defineProps<{
  open: boolean
  dialogTitle: string
  fields: readonly CustomBlockFieldAnalysis[]
  resize: ProjectCustomBlockResizePolicy
  widthLabel: string
  heightLabel: string
  defaultName?: string
  defaultKey?: string
  nameLabel: string
  keyLabel: string
  cancelLabel: string
  exportLabel: string
  busyLabel: string
  busy?: boolean
  fieldsLabel: string
  exposedLabel: string
  privateLabel: string
  resourcesLabel?: string
  fontsLabel?: string
  iconsLabel?: string
  imagesLabel?: string
  resourcesLoadingLabel?: string
  resourceEmptyLabel?: string
  fontPreviewText?: string
  moveToExposedLabel: string
  moveToPrivateLabel: string
  formatReferenceCount: (count: number) => string
  errorText?: string
  resourceIndex?: ProjectCustomBlockResourceIndex | null
  resourceFiles?: ReadonlyMap<string, Uint8Array> | null
  resourceImageLabels?: ReadonlyMap<string, string> | null
  resourcePreviewLoading?: boolean
}>(), {
  defaultName: '', defaultKey: '', errorText: '', busy: false,
  resourcesLabel: 'Written resources', fontsLabel: 'Fonts', iconsLabel: 'Icons', imagesLabel: 'Images',
  resourcesLoadingLabel: 'Analyzing resources…', resourceEmptyLabel: 'No resources to write.',
  fontPreviewText: 'Aa Font preview',
  resourcePreviewLoading: false,
})

const emit = defineEmits<{
  close: []
  submit: [payload: { name: string; key: string; exposedFieldKeys: string[]; resize: ProjectCustomBlockResizePolicy }]
}>()

const name = ref(props.defaultName)
const key = ref('')
const exposed = ref(new Set<string>())
const selectedResourceKey = ref<string | null>(null)
const resourceUrls = ref(new Map<string, string>())
const resourceIconEntries = ref(new Map<string, ProjectIconCatalogEntry>())
const resourceFontFamilies = ref(new Map<string, string>())
let fontSession: ProjectCustomBlockFontSession | null = null
let resourceLoadRequest = 0
const groupKeys = ['group:exposed', 'group:private']
const resourceGroupKeys = ['resource-group:fonts', 'resource-group:icons', 'resource-group:images']
const suggestedKey = computed(() => toKeySlug(name.value, props.defaultKey || 'custom-block'))
const resolvedKey = computed(() => normalizeProjectCustomBlockKey(key.value.trim() || suggestedKey.value) ?? '')
const validKey = computed(() => Boolean(resolvedKey.value))

watch(() => props.open, open => {
  if (!open) return
  name.value = props.defaultName
  key.value = ''
  exposed.value = new Set([
    ...(!props.resize.widthLocked ? ['resize:width'] : []),
    ...(!props.resize.heightLocked ? ['resize:height'] : []),
  ])
  selectedResourceKey.value = null
}, { immediate: true })

watch(() => [props.resourceIndex, props.resourceFiles] as const, async ([index, files]) => {
  const request = ++resourceLoadRequest
  for (const url of resourceUrls.value.values()) URL.revokeObjectURL(url)
  fontSession?.release()
  fontSession = null
  resourceUrls.value = new Map()
  resourceIconEntries.value = new Map()
  resourceFontFamilies.value = new Map()
  if (!index || !files) return
  const urls = new Map<string, string>()
  for (const [path, bytes] of files) {
    const mime = path.toLowerCase().endsWith('.png') ? 'image/png'
      : path.toLowerCase().endsWith('.jpg') || path.toLowerCase().endsWith('.jpeg') ? 'image/jpeg'
        : path.toLowerCase().endsWith('.webp') ? 'image/webp'
          : 'application/octet-stream'
    urls.set(path, URL.createObjectURL(new Blob([bytes], { type: mime })))
  }
  resourceUrls.value = urls
  const catalog = await buildProjectIconCatalog(index.iconSeries, source => urls.get(source) ?? '')
  if (request !== resourceLoadRequest) return
  resourceIconEntries.value = new Map(catalog.entries.map(entry => [
    `resource:icon:${entry.seriesKey}:${entry.iconKey}`, entry,
  ]))
  const nextFontSession = await createProjectCustomBlockFontSession(new Map([['preview', {
    manifest: { customBlockKey: 'preview', resources: index },
    files,
  }]]))
  if (request !== resourceLoadRequest) {
    nextFontSession.release()
    return
  }
  fontSession = nextFontSession
  resourceFontFamilies.value = new Map((index.fonts ?? []).map(font => [
    `resource:font:${font.key}`,
    createProjectCustomBlockFontFamily('preview', font.key),
  ]))
  if (!selectedResourceKey.value || !resourceItemKeys.value.includes(selectedResourceKey.value)) {
    selectedResourceKey.value = resourceItemKeys.value[0] ?? null
  }
}, { immediate: true })

const treeActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  ['move-exposed', { title: props.moveToExposedLabel, icon: 'nav.arrow-up' }],
  ['move-private', { title: props.moveToPrivateLabel, icon: 'nav.arrow-down' }],
]))

const treeData = computed<OcTreeData>(() => {
  const items = new Map<string, OcTreeItem>()
  const children = new Map<string, readonly string[]>()
  const exposedKeys: string[] = []
  const privateKeys: string[] = []
  for (const [axis, label] of [['width', props.widthLabel], ['height', props.heightLabel]] as const) {
    const fieldKey = `resize:${axis}`
    const isExposed = exposed.value.has(fieldKey)
    ;(isExposed ? exposedKeys : privateKeys).push(fieldKey)
    items.set(fieldKey, {
      label,
      icon: 'layout.fill',
      draggable: true,
      actions: [isExposed ? 'move-private' : 'move-exposed'],
      contextActions: [isExposed ? 'move-private' : 'move-exposed'],
    })
  }
  for (const field of props.fields) {
    const fieldKey = `field:${field.key}`
    const isExposed = exposed.value.has(field.key)
    ;(isExposed ? exposedKeys : privateKeys).push(fieldKey)
    items.set(fieldKey, {
      label: field.title || field.key,
      tail: props.formatReferenceCount(field.referenceCount),
      icon: 'entity.block-custom',
      draggable: true,
      actions: [isExposed ? 'move-private' : 'move-exposed'],
      contextActions: [isExposed ? 'move-private' : 'move-exposed'],
    })
  }
  const exposedRoot = 'group:exposed'
  const privateRoot = 'group:private'
  items.set(exposedRoot, { label: props.exposedLabel, icon: 'entity.block-custom', draggable: false })
  items.set(privateRoot, { label: props.privateLabel, icon: 'entity.block-custom', draggable: false })
  children.set(exposedRoot, exposedKeys)
  children.set(privateRoot, privateKeys)
  return { rootKeys: [exposedRoot, privateRoot], items, children }
})

const resourceTreeData = computed<OcTreeData>(() => {
  const items = new Map<string, OcTreeItem>()
  const children = new Map<string, readonly string[]>()
  const fonts = (props.resourceIndex?.fonts ?? []).map(font => `resource:font:${font.key}`)
  const icons = [...resourceIconEntries.value.keys()]
  const images = (props.resourceIndex?.images ?? []).map(image => `resource:image:${image.key}`)
  items.set('resource-group:fonts', { label: props.fontsLabel, icon: 'file.font' })
  items.set('resource-group:icons', { label: props.iconsLabel, icon: 'file.image' })
  items.set('resource-group:images', { label: props.imagesLabel, icon: 'file.image' })
  children.set('resource-group:fonts', fonts)
  children.set('resource-group:icons', icons)
  children.set('resource-group:images', images)
  for (const font of props.resourceIndex?.fonts ?? []) {
    items.set(`resource:font:${font.key}`, { label: font.name || font.key, tail: font.key, icon: 'file.font' })
  }
  for (const entry of resourceIconEntries.value.values()) {
    items.set(`resource:icon:${entry.seriesKey}:${entry.iconKey}`, {
      label: entry.name || entry.iconKey,
      tail: entry.iconKey,
      icon: 'file.image',
      thumbnailStyle: createProjectIconPreviewStyle(entry),
      thumbnailLabel: entry.name || entry.iconKey,
    })
  }
  for (const image of props.resourceIndex?.images ?? []) {
    items.set(`resource:image:${image.key}`, {
      label: props.resourceImageLabels?.get(image.source) ?? image.key,
      tail: image.source,
      icon: 'file.image',
    })
  }
  return { rootKeys: resourceGroupKeys, items, children }
})

const resourceItemKeys = computed(() => [
  ...(props.resourceIndex?.fonts ?? []).map(font => `resource:font:${font.key}`),
  ...resourceIconEntries.value.keys(),
  ...(props.resourceIndex?.images ?? []).map(image => `resource:image:${image.key}`),
])
const selectedResourceKeys = computed(() => selectedResourceKey.value ? [selectedResourceKey.value] : [])
const resourcePreviewItem = computed(() => {
  const key = selectedResourceKey.value
  if (!key) return null
  if (key.startsWith('resource:font:')) {
    const font = props.resourceIndex?.fonts?.find(item => `resource:font:${item.key}` === key)
    const source = font?.kind === 'font'
      ? projectFontSources(font).join(', ')
      : font?.members.map(member => member.fontKey).join(' → ')
    return font ? { kind: 'font' as const, label: font.name || font.key, source, fontFamily: resourceFontFamilies.value.get(key) ?? 'sans-serif' } : null
  }
  if (key.startsWith('resource:image:')) {
    const image = props.resourceIndex?.images?.find(item => `resource:image:${item.key}` === key)
    const src = image ? resourceUrls.value.get(image.source) : undefined
    return image && src ? {
      kind: 'image' as const,
      label: props.resourceImageLabels?.get(image.source) ?? image.key,
      source: image.source,
      src,
    } : null
  }
  const entry = resourceIconEntries.value.get(key)
  return entry ? { kind: 'icon' as const, label: entry.name || entry.iconKey, source: entry.source, entry } : null
})

onBeforeUnmount(() => {
  resourceLoadRequest += 1
  for (const url of resourceUrls.value.values()) URL.revokeObjectURL(url)
  fontSession?.release()
})

function move(fieldKey: string, target: 'exposed' | 'private') {
  const next = new Set(exposed.value)
  if (target === 'exposed') next.add(fieldKey)
  else next.delete(fieldKey)
  exposed.value = next
}

function exposedKey(treeKey: string): string | null {
  if (treeKey.startsWith('field:')) return treeKey.slice(6)
  return treeKey === 'resize:width' || treeKey === 'resize:height' ? treeKey : null
}

function handleTreeIntent(intent: OcTreeIntent) {
  const fieldKey = 'key' in intent ? exposedKey(intent.key) : null
  if (intent.type === 'action.invoke' && fieldKey) {
    move(fieldKey, intent.actionKey === 'move-exposed' ? 'exposed' : 'private')
  }
  if (intent.type === 'move.request' && fieldKey) {
    if (intent.targetKey === 'group:exposed') move(fieldKey, 'exposed')
    if (intent.targetKey === 'group:private') move(fieldKey, 'private')
    const targetFieldKey = intent.targetKey ? exposedKey(intent.targetKey) : null
    if (targetFieldKey) move(fieldKey, exposed.value.has(targetFieldKey) ? 'exposed' : 'private')
  }
}

function handleResourceTreeIntent(intent: OcTreeIntent) {
  if (intent.type === 'selection.change') selectedResourceKey.value = intent.selectedKeys[0] ?? null
  if (intent.type === 'node.activate' && resourceItemKeys.value.includes(intent.key)) selectedResourceKey.value = intent.key
}

function submit() {
  if (props.busy) return
  emit('submit', {
    name: name.value.trim(),
    key: resolvedKey.value,
    exposedFieldKeys: props.fields.map(field => field.key).filter(fieldKey => exposed.value.has(fieldKey)),
    resize: {
      widthLocked: !exposed.value.has('resize:width'),
      heightLocked: !exposed.value.has('resize:height'),
    },
  })
}

function requestClose() {
  if (!props.busy) emit('close')
}
</script>

<style scoped>
.custom-block-export-dialog { display: grid; gap: var(--oc-space-4); }
.custom-block-export-dialog__fields { max-height: var(--oc-custom-block-export-fields-max-height); }
.custom-block-export-dialog__metadata { display: grid; grid-template-columns: 1fr 1fr; gap: var(--oc-space-3); }
.custom-block-export-dialog__field { display: grid; gap: var(--oc-space-1); }
.custom-block-export-dialog__resources { display: grid; gap: var(--oc-space-2); min-height: 0; }
.custom-block-export-dialog__resource-workspace { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--oc-space-3); min-height: var(--oc-size-lg); }
.custom-block-export-dialog__resource-tree, .custom-block-export-dialog__resource-preview { min-height: 0; }
.custom-block-export-dialog__resource-preview { display: grid; align-content: start; gap: var(--oc-space-3); }
.custom-block-export-dialog__preview-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.custom-block-export-dialog__preview-source { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.custom-block-export-dialog__image-preview, .custom-block-export-dialog__icon-preview { display: grid; place-items: center; min-height: var(--oc-size-lg); overflow: hidden; background: var(--oc-bg-raised); }
.custom-block-export-dialog__icon-preview { font-size: var(--oc-size-lg); }
.custom-block-export-dialog__image-preview img { max-width: 100%; max-height: var(--oc-size-lg); object-fit: contain; }
.custom-block-export-dialog__font-preview { display: grid; place-items: center; min-height: var(--oc-size-lg); font-size: var(--oc-text-xl); background: var(--oc-bg-raised); }
</style>
