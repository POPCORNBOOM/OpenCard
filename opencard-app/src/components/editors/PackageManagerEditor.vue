<template>
  <ProjectRegistryEditorShell icon="file.package" content-mode="workspace"
    :heading="t('packageManager.title')" :description="t('packageManager.description')">
    <template #actions>
      <OcButton icon="action.refresh" variant="ghost" :disabled="busy" @click="synchronizePackages">
        {{ t('packageManager.sync') }}
      </OcButton>
      <OcButton icon="action.add" variant="soft" :disabled="busy" @click="importPackage">
        {{ t('packageManager.add') }}
      </OcButton>
    </template>
    <div class="package-manager">
      <OcText v-if="error" class="package-manager__error" tone="danger" role="alert">{{ error }}</OcText>
      <OcEmpty v-if="!rows.length" tone="muted" inset="comfortable">{{ t('packageManager.empty') }}</OcEmpty>
      <OcTree v-else fill :data="treeData" :actions="actions" :aria-label="t('packageManager.title')" @intent="handleIntent" />
    </div>
    <OcDialog :open="Boolean(confirmRequest)" :title="t('packageManager.confirmTitle')"
      :description="confirmRequest?.message ?? ''" size="sm" @close="resolveConfirm(false)">
      <template #footer>
        <OcButton variant="ghost" @click="resolveConfirm(false)">{{ t('packageManager.cancel') }}</OcButton>
        <OcButton variant="solid" @click="resolveConfirm(true)">{{ t('packageManager.confirm') }}</OcButton>
      </template>
    </OcDialog>
    <OcDialog :open="addOpen" :title="t('packageManager.add')" size="sm" @close="addOpen = false">
      <OcOptionGroup v-model="addMode" :options="addModeOptions" />
      <div v-if="addMode === 'local'" class="package-manager__field">
        <OcButton icon="action.folder-plus" @click="choosePackage">{{ t('packageManager.choosePackages') }}</OcButton>
        <OcText>{{ localPaths.length ? t('packageManager.selectedFiles', { count: localPaths.length }) : t('packageManager.noFile') }}</OcText>
      </div>
      <div v-else class="package-manager__field">
        <label class="package-manager__source">
          <OcText as="span" size="sm">{{ t('packageManager.source') }}</OcText>
          <OcFieldInput as="textarea" resize="vertical" full-width mono :value="remoteSource"
            :aria-invalid="invalidRemoteEntries.length > 0" :placeholder="t('packageManager.sourcePlaceholder')"
            @input="updateRemoteSource" @change="updateRemoteSource" />
        </label>
        <OcText v-if="invalidRemoteEntries.length" tone="danger" size="sm" role="alert">
          {{ t('packageManager.invalidSource', { source: invalidRemoteEntries[0] }) }}
        </OcText>
        <OcText v-else tone="muted" size="sm">{{ t('packageManager.sourceHint') }}</OcText>
      </div>
      <template #footer><OcButton variant="ghost" @click="addOpen = false">{{ t('packageManager.cancel') }}</OcButton><OcButton variant="solid" :disabled="!canAdd" @click="addPackage">{{ t('packageManager.add') }}</OcButton></template>
    </OcDialog>
  </ProjectRegistryEditorShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import type { ResourcePackageManifest } from '../../features/workspace/model/resourcePackage'
import type { OcTreeData, OcTreeActionDefinition, OcTreeIntent } from '../../shared/ui/tree/tree.types'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import { createRemotePackageLocator, parseRemotePackageEntry } from '../../features/workspace/services/remotePackageSource'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import OcButton from '../base/OcButton.vue'
import OcEmpty from '../base/OcEmpty.vue'
import OcText from '../base/OcText.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcDialog from '../standard/OcDialog.vue'
import OcTree from '../standard/OcTree.vue'
import OcOptionGroup, { type OcOption } from '../standard/OcOptionGroup.vue'
import ProjectRegistryEditorShell from './ProjectRegistryEditorShell.vue'
import { notifyError, notifySuccess } from '../../features/notifications/titlebarNotices'
import { useShellProgressTasks } from '../../features/shell/composables/useShellProgressTasks'
const removeAction = (key: string) => `package-remove:${key}`

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const projectStore = useProjectStore()
const shellProgress = useShellProgressTasks()
const busy = ref(false)
const error = ref('')
const confirmRequest = ref<{ message: string; resolve: (accepted: boolean) => void } | null>(null)
const addOpen = ref(false)
const addMode = ref<'local' | 'remote'>('local')
const localPaths = ref<string[]>([])
const remoteSource = ref('')
const addModeOptions = computed<readonly OcOption[]>(() => [
  { value: 'local', label: t('packageManager.local') },
  { value: 'remote', label: t('packageManager.remote') },
])
const remoteEntries = computed(() => remoteSource.value.split(/[;\n]+/)
  .map(entry => entry.trim())
  .filter(Boolean)
  .map(entry => ({ entry, parsed: parseRemotePackageEntry(entry) })))
const invalidRemoteEntries = computed(() => remoteEntries.value.filter(item => !item.parsed).map(item => item.entry))
const canAdd = computed(() => addMode.value === 'local'
  ? localPaths.value.length > 0
  : remoteEntries.value.length > 0 && invalidRemoteEntries.value.length === 0)
type PackageRow = {
  key: string
  version: string
  source?: string | null
  status: 'missing' | 'version' | null
}
const rows = computed<PackageRow[]>(() => {
  return [...projectStore.projectPackageManifests.value]
    .map<PackageRow>(([key, required]) => {
      const actual = [...projectStore.projectResourcePackages.value]
        .find(([candidate]) => candidate.toLocaleLowerCase() === key.toLocaleLowerCase())?.[1]
      return {
        key,
        version: required.version,
        source: required.source,
        status: actual && actual.manifest.version !== required.version ? 'version' : actual ? null : 'missing',
      }
    })
    .sort((left, right) => left.key.localeCompare(right.key))
})
const treeData = computed<OcTreeData>(() => ({
  rootKeys: rows.value.map(row => row.key),
  items: new Map(rows.value.map(row => [row.key, {
    label: `${row.key}@${row.version}`,
    tail: [row.source?.trim() || t('packageManager.local'), row.status ? t(`packageManager.status.${row.status}`) : ''].filter(Boolean).join(' · '),
    actions: [removeAction(row.key)],
    icon: 'file.package',
    iconTone: row.status === 'missing' ? 'muted' : row.status === 'version' ? 'warning' : 'success',
  }])),
  children: new Map(),
}))
const actions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => {
  const next = new Map<string, OcTreeActionDefinition>()
  for (const row of rows.value) {
    next.set(removeAction(row.key), { title: t('packageManager.noLongerNeeded'), icon: 'action.delete', iconTone: 'danger' })
  }
  return next
})
function handleIntent(intent: OcTreeIntent): void {
  if (intent.type !== 'action.invoke') return
  if (intent.actionKey.startsWith('package-remove:')) void removePackage(intent.actionKey.slice('package-remove:'.length))
}
async function removePackage(key: string): Promise<void> { await projectStore.removeRequiredPackage(key); await refresh() }
watch(() => props.filePath, () => {
  emit('modified', false)
  error.value = ''
  void refresh()
}, { immediate: true })

function requestConfirm(next: ResourcePackageManifest, previous: ResourcePackageManifest): Promise<boolean> {
  return new Promise(resolve => {
    confirmRequest.value = {
      message: t('packageManager.confirmReplace', { name: next.name, previous: previous.version, version: next.version }),
      resolve,
    }
  })
}

function resolveConfirm(accepted: boolean): void {
  const request = confirmRequest.value
  confirmRequest.value = null
  request?.resolve(accepted)
}

async function refresh(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await projectStore.reloadProjectResourceEnvironment()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    busy.value = false
  }
}

async function importPackage(): Promise<void> {
  addOpen.value = true
}
async function synchronizePackages(): Promise<void> {
  const declared = projectStore.projectPackageManifests.value
  const extras = [...projectStore.projectResourcePackages.value.keys()]
    .filter(key => ![...declared.keys()].some(candidate => candidate.toLocaleLowerCase() === key.toLocaleLowerCase()))
  const pending = rows.value.filter(row => row.status !== null && row.source)
  if (!extras.length && !pending.length) { await refresh(); return }
  busy.value = true
  const taskKey = 'package-manager-install-all'
  const totalSteps = extras.length + pending.length
  let completedSteps = 0
  shellProgress.setTask({ key: taskKey, title: t('packageManager.sync'), progress: 0, cancellable: false })
  try {
    for (const key of extras) {
      await projectStore.removeResourcePackage(key)
      completedSteps += 1
      shellProgress.setTask({ key: taskKey, title: t('packageManager.sync'), progress: completedSteps / totalSteps, cancellable: false })
    }
    const result = await projectStore.installMissingRemotePackages(pending.map(row => ({ key: row.key, version: row.version, source: row.source })), (done) => {
      completedSteps = extras.length + done
      shellProgress.setTask({ key: taskKey, title: t('packageManager.sync'), progress: totalSteps ? completedSteps / totalSteps : 1, cancellable: false })
    })
    if (result.failed.length) notifyError(t('packageManager.installSummaryFailed', { count: result.failed.length }))
    else notifySuccess(t('packageManager.installSummary', { count: result.succeeded.length }))
    await projectStore.reloadProjectResourceEnvironment()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    shellProgress.removeTask(taskKey)
    busy.value = false
  }
}
function updateRemoteSource(event: Event): void {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) remoteSource.value = event.target.value
}
async function choosePackage(): Promise<void> {
  if (!projectStore.projectPath.value) return
  const options = {
    title: t('packageManager.choose'),
    fileTypeName: 'OpenCard package',
    extensions: ['ocpack'],
    defaultPath: projectStore.projectPath.value,
  }
  const sources = fileSystemService.pickFiles
    ? await fileSystemService.pickFiles(options)
    : [await fileSystemService.pickFile(options)].filter((source): source is string => Boolean(source))
  if (!sources.length) return
  localPaths.value = sources
}
async function addPackage(): Promise<void> {
  if (!canAdd.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    if (addMode.value === 'remote') {
      const entries = remoteEntries.value.map(item => {
        if (!item.parsed) throw new Error(t('packageManager.invalidSource', { source: item.entry }))
        return { key: item.parsed.key, version: item.parsed.version, source: createRemotePackageLocator(item.parsed) }
      })
      await projectStore.addRequiredPackages(entries)
    } else {
      for (const source of localPaths.value) await projectStore.installResourcePackageFile(source, { confirmReplacement: requestConfirm })
    }
    addOpen.value = false
    localPaths.value = []
    remoteSource.value = ''
    await refresh()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.package-manager { min-width: 0; min-height: 0; height: 100%; overflow: hidden; }
.package-manager__error { padding: var(--oc-space-3); }
.package-manager__field { display: grid; gap: var(--oc-space-2); margin-block: var(--oc-space-3); }
.package-manager__source { display: grid; gap: var(--oc-space-2); }
</style>
