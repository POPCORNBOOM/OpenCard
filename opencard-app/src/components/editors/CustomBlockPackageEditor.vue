<template>
  <section class="custom-block-package-editor" :aria-label="t('customBlockPackage.title')">
    <header class="custom-block-package-editor__header">
      <OcIcon name="file.custom-block" tone="primary" size="lg" />
      <div>
        <h1>{{ manifest?.name || displayName }}</h1>
        <OcText tone="muted" size="sm">{{ t('customBlockPackage.subtitle') }}</OcText>
      </div>
    </header>

    <main class="custom-block-package-editor__content">
      <OcText v-if="loading" tone="muted">{{ t('customBlockPackage.loading') }}</OcText>
      <OcText v-else-if="loadError" tone="danger" role="alert">{{ loadError }}</OcText>
      <template v-else-if="manifest">
        <dl class="custom-block-package-editor__details">
          <div>
            <dt>{{ t('customBlockPackage.key') }}</dt>
            <dd><OcText mono>{{ manifest.customBlockKey }}</OcText></dd>
          </div>
          <div>
            <dt>{{ t('customBlockPackage.packagePath') }}</dt>
            <dd><OcText mono>{{ props.filePath }}</OcText></dd>
          </div>
          <div>
            <dt>{{ t('customBlockPackage.resize') }}</dt>
            <dd>{{ resizeDescription }}</dd>
          </div>
        </dl>
        <OcText v-if="!packageBlock" tone="danger" size="sm" role="status">
          {{ t('customBlockPackage.unavailable') }}
        </OcText>
        <OcText v-else-if="packageIssueCount" tone="muted" size="sm" role="status">
          {{ t('customBlockPackage.issuesFound', { count: packageIssueCount }) }}
        </OcText>

        <section class="custom-block-package-editor__fields">
          <OcText as="h2" size="sm" bold>{{ t('customBlockPackage.publicFields') }}</OcText>
          <OcText v-if="!publicFields.length" tone="muted" size="sm">
            {{ t('customBlockPackage.noPublicFields') }}
          </OcText>
          <ul v-else>
            <li v-for="field in publicFields" :key="field.key">
              <span>{{ field.title || field.key }}</span>
              <OcText mono tone="muted" size="sm">{{ field.key }} · {{ field.fieldType }}</OcText>
            </li>
          </ul>
        </section>

        <section v-if="importConflict" class="custom-block-package-editor__conflict"
          :aria-label="t('projectConfig.importConflict.title')">
          <OcText size="sm">
            {{ t('projectConfig.importConflict.message', { path: importConflict.existingSource }) }}
          </OcText>
          <OcOptionGroup :model-value="conflictResolution ?? ''" :options="conflictOptions"
            fill :columns="2" @update:model-value="selectConflictResolution" />
          <OcText v-if="selectedConflictPath" mono tone="muted" size="sm">
            {{ t('projectConfig.importConflict.selectedPath', { path: selectedConflictPath }) }}
          </OcText>
        </section>

        <OcText v-if="!projectStore.projectPath.value" tone="muted" size="sm">
          {{ t('customBlockPackage.projectRequired') }}
        </OcText>
        <OcText v-if="registerError" tone="danger" size="sm" role="alert">{{ registerError }}</OcText>
        <OcText v-if="registered" tone="accent" size="sm" role="status">
          {{ t('customBlockPackage.registered') }}
        </OcText>
        <div class="custom-block-package-editor__actions">
          <OcButton icon="action.import" variant="solid"
            :disabled="busy || !projectStore.projectPath.value || Boolean(importConflict && !conflictResolution)"
            @click="registerPackage">
            {{ busy ? t('customBlockPackage.registering')
              : existingEntry ? t('customBlockPackage.updateRegistration') : t('customBlockPackage.register') }}
          </OcButton>
        </div>
      </template>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import type { CardBlock } from '../../entities/card/model'
import { getTypePropertyEditorSchema, parseAdditionalFieldDefinitions } from '../../entities/card/schema'
import type { ProjectCustomBlockManifest, ProjectCustomBlockPackageIssue } from '../../features/workspace/model/projectCustomBlocks'
import { readProjectCustomBlockPackage } from '../../features/workspace/services/projectCustomBlock'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import {
  useProjectStore,
  type ProjectAssetImportConflict,
  type ProjectAssetImportResolution,
} from '../../features/workspace/store/projectStore'
import OcButton from '../base/OcButton.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcOptionGroup, { type OcOption } from '../standard/OcOptionGroup.vue'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const projectStore = useProjectStore()
const manifest = ref<ProjectCustomBlockManifest | null>(null)
const packageBlock = ref<CardBlock | null>(null)
const packageIssues = ref<readonly ProjectCustomBlockPackageIssue[]>([])
const loading = ref(true)
const loadError = ref('')
const busy = ref(false)
const registerError = ref('')
const registered = ref(false)
const importConflict = ref<ProjectAssetImportConflict | null>(null)
const conflictResolution = ref<ProjectAssetImportResolution | null>(null)
const conflictChecked = ref(false)
let loadVersion = 0

const displayName = computed(() => props.fileName || props.filePath.split(/[/\\]/).pop() || props.filePath)
const absolutePath = computed(() => {
  if (/^[a-z]:[/\\]/i.test(props.filePath) || props.filePath.startsWith('/')) return props.filePath
  const root = props.resourceRootPath?.replace(/[/\\]+$/, '')
  return root ? `${root}/${props.filePath}` : props.filePath
})
const existingEntry = computed(() => manifest.value
  ? projectStore.projectCustomBlockCatalog.value.get(manifest.value.customBlockKey.toLocaleLowerCase())
  : undefined)
const publicFields = computed(() => {
  if (!manifest.value || !packageBlock.value) return []
  const definitions = parseAdditionalFieldDefinitions(packageBlock.value.additionalFieldDefinition)
  const nativeSchema = getTypePropertyEditorSchema(packageBlock.value.type)
  return manifest.value.publicFieldKeys.flatMap(key => {
    const additional = definitions[key]
    if (additional) return [{ key, ...additional }]
    const native = nativeSchema[key]
    return native ? [{
      key,
      fieldType: native.fieldType,
      title: t(`propertyEditor.fields.${key}`),
      ...(typeof native.defaultValue === 'string' ? { defaultValue: native.defaultValue } : {}),
    }] : []
  })
})
const packageIssueCount = computed(() => packageIssues.value.length)
const resizeDescription = computed(() => {
  if (!manifest.value) return ''
  const { widthLocked, heightLocked } = manifest.value.resize
  if (widthLocked && heightLocked) return t('customBlockPackage.resizeLocked')
  if (widthLocked) return t('customBlockPackage.widthLocked')
  if (heightLocked) return t('customBlockPackage.heightLocked')
  return t('customBlockPackage.resizeFree')
})
const conflictOptions = computed<readonly OcOption[]>(() => [
  {
    value: 'rename-copy',
    label: t('projectConfig.importConflict.renameCopy', {
      name: projectAssetName(importConflict.value?.availableCopySource ?? ''),
    }),
  },
  {
    value: 'use-existing',
    label: t('projectConfig.importConflict.useExisting', {
      name: projectAssetName(importConflict.value?.existingSource ?? ''),
    }),
  },
])
const selectedConflictPath = computed(() => conflictResolution.value === 'use-existing'
  ? importConflict.value?.existingSource ?? ''
  : conflictResolution.value === 'rename-copy'
    ? importConflict.value?.availableCopySource ?? ''
    : '')

watch(() => props.filePath, () => void loadPackage(), { immediate: true })

async function loadPackage(): Promise<void> {
  const version = ++loadVersion
  loading.value = true
  loadError.value = ''
  manifest.value = null
  packageBlock.value = null
  packageIssues.value = []
  resetRegistrationState()
  try {
    const loaded = await readProjectCustomBlockPackage(fileSystemService, absolutePath.value)
    if (version !== loadVersion) return
    manifest.value = loaded.manifest
    packageBlock.value = loaded.block
    packageIssues.value = loaded.issues ?? []
  } catch (cause) {
    if (version === loadVersion) loadError.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    if (version === loadVersion) {
      loading.value = false
      emit('modified', false)
    }
  }
}

async function registerPackage(): Promise<void> {
  if (!manifest.value || !projectStore.projectPath.value || busy.value) return
  busy.value = true
  registerError.value = ''
  registered.value = false
  try {
    if (!conflictChecked.value) {
      importConflict.value = await projectStore.getProjectCustomBlockImportConflict(absolutePath.value)
      conflictChecked.value = true
      if (importConflict.value) return
    }
    if (importConflict.value && !conflictResolution.value) return
    await projectStore.registerProjectCustomBlockFile(
      absolutePath.value,
      conflictResolution.value ?? undefined,
    )
    registered.value = true
    importConflict.value = null
  } catch (cause) {
    registerError.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    busy.value = false
  }
}

function selectConflictResolution(value: string | number): void {
  if (value === 'rename-copy' || value === 'use-existing') conflictResolution.value = value
}

function resetRegistrationState(): void {
  registerError.value = ''
  registered.value = false
  importConflict.value = null
  conflictResolution.value = null
  conflictChecked.value = false
}

function projectAssetName(path: string): string {
  return path.split('/').pop() ?? path
}
</script>

<style scoped>
.custom-block-package-editor { display: grid; grid-template-rows: auto minmax(0, 1fr); width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; }
.custom-block-package-editor__header { display: flex; align-items: center; gap: var(--oc-space-3); padding: var(--oc-space-5); border-bottom: var(--oc-border-width) solid var(--oc-border-muted); }
.custom-block-package-editor__header > div { display: grid; min-width: 0; gap: var(--oc-space-1); }
.custom-block-package-editor__header h1 { margin: 0; overflow: hidden; font-size: var(--oc-text-lg); font-weight: var(--font-weight-ui-title); letter-spacing: 0; text-overflow: ellipsis; white-space: nowrap; }
.custom-block-package-editor__content { display: grid; align-content: start; gap: var(--oc-space-4); min-height: 0; padding: var(--oc-space-5); overflow: auto; }
.custom-block-package-editor__details { display: grid; gap: var(--oc-space-2); margin: 0; }
.custom-block-package-editor__details > div { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--oc-space-3); }
.custom-block-package-editor__details dt { color: var(--oc-fg-muted); }
.custom-block-package-editor__details dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
.custom-block-package-editor__fields { display: grid; gap: var(--oc-space-2); }
.custom-block-package-editor__fields h2 { margin: 0; }
.custom-block-package-editor__fields ul { display: grid; gap: var(--oc-space-2); margin: 0; padding: 0; list-style: none; }
.custom-block-package-editor__fields li { display: flex; align-items: center; justify-content: space-between; gap: var(--oc-space-3); padding-block: var(--oc-space-2); border-bottom: var(--oc-border-width) solid var(--oc-border-muted); }
.custom-block-package-editor__conflict { display: grid; gap: var(--oc-space-2); padding: var(--oc-space-3); border-radius: var(--oc-radius-sm); background: var(--oc-bg-warning-subtle); }
.custom-block-package-editor__conflict p { margin: 0; overflow-wrap: anywhere; }
.custom-block-package-editor__actions { display: flex; justify-content: flex-end; }
</style>
