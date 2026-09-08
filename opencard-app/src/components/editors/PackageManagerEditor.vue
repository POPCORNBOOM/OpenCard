<template>
  <ProjectRegistryEditorShell icon="file.package" content-mode="workspace"
    :heading="t('packageManager.title')" :description="t('packageManager.description')">
    <template #actions>
      <OcButton icon="action.refresh" variant="ghost" :disabled="busy" @click="refresh">
        {{ t('packageManager.refresh') }}
      </OcButton>
      <OcButton icon="action.import" variant="soft" :disabled="busy" @click="importPackage">
        {{ t('packageManager.import') }}
      </OcButton>
    </template>
    <div class="package-manager">
      <OcText v-if="error" class="package-manager__error" tone="danger" role="alert">{{ error }}</OcText>
      <OcEmpty v-if="!rows.length" tone="muted" inset="comfortable">{{ t('packageManager.empty') }}</OcEmpty>
      <OcTree v-else fill :data="treeData" :aria-label="t('packageManager.title')" />
    </div>
    <OcDialog :open="Boolean(confirmRequest)" :title="t('packageManager.confirmTitle')"
      :description="confirmRequest?.message ?? ''" size="sm" @close="resolveConfirm(false)">
      <template #footer>
        <OcButton variant="ghost" @click="resolveConfirm(false)">{{ t('resourcePackageBuilder.cancel') }}</OcButton>
        <OcButton variant="solid" @click="resolveConfirm(true)">{{ t('packageManager.confirm') }}</OcButton>
      </template>
    </OcDialog>
  </ProjectRegistryEditorShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import type { ResourcePackageManifest } from '../../features/workspace/model/resourcePackage'
import type { OcTreeData } from '../../shared/ui/tree/tree.types'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import OcButton from '../base/OcButton.vue'
import OcEmpty from '../base/OcEmpty.vue'
import OcText from '../base/OcText.vue'
import OcDialog from '../standard/OcDialog.vue'
import OcTree from '../standard/OcTree.vue'
import ProjectRegistryEditorShell from './ProjectRegistryEditorShell.vue'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const projectStore = useProjectStore()
const busy = ref(false)
const error = ref('')
const confirmRequest = ref<{ message: string; resolve: (accepted: boolean) => void } | null>(null)
const rows = computed(() => [...projectStore.projectPackageManifests.value]
  .map(([key, manifest]) => ({ key, manifest }))
  .sort((left, right) => left.key.localeCompare(right.key)))
const treeData = computed<OcTreeData>(() => ({
  rootKeys: rows.value.map(row => row.key),
  items: new Map(rows.value.map(row => [row.key, {
    label: row.manifest.name,
    tail: t('packageManager.installed', { version: row.manifest.version }),
    icon: 'file.package',
    iconTone: 'config',
  }])),
  children: new Map(),
}))

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
  if (busy.value || !projectStore.projectPath.value) return
  const source = await fileSystemService.pickFile({
    title: t('packageManager.choose'),
    fileTypeName: 'OpenCard package',
    extensions: ['ocpack'],
    defaultPath: projectStore.projectPath.value,
  })
  if (!source) return
  busy.value = true
  error.value = ''
  try {
    await projectStore.installResourcePackageFile(source, requestConfirm)
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
</style>
