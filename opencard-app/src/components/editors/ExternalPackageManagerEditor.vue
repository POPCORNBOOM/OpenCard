<template>
  <ProjectRegistryEditorShell icon="file.package" content-mode="workspace"
    :heading="t('externalPackageManager.title')" :description="t('externalPackageManager.description')">
    <template #actions>
      <OcButton icon="action.refresh" variant="ghost" :disabled="busy" :aria-label="t('externalPackageManager.refresh')"
        :data-tooltip="t('externalPackageManager.refresh')" @click="refresh">{{ t('externalPackageManager.refresh') }}</OcButton>
      <OcButton icon="action.import" variant="soft" :disabled="busy" @click="importPackage">
        {{ t('externalPackageManager.import') }}
      </OcButton>
    </template>
    <div class="external-package-manager">
      <OcText v-if="error" class="external-package-manager__error" tone="danger" role="alert">{{ error }}</OcText>
      <OcEmpty v-if="!rows.length" tone="muted" inset="comfortable">{{ t('externalPackageManager.empty') }}</OcEmpty>
      <OcTree v-else fill :data="treeData" :actions="treeActions"
        :aria-label="t('externalPackageManager.title')" @intent="handleTreeIntent" />
    </div>
  </ProjectRegistryEditorShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import OcButton from '../base/OcButton.vue'
import OcEmpty from '../base/OcEmpty.vue'
import OcText from '../base/OcText.vue'
import OcTree from '../standard/OcTree.vue'
import ProjectRegistryEditorShell from './ProjectRegistryEditorShell.vue'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import { projectPackageActions } from '../../features/workspace/model/projectPackageManifest'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent } from '../../shared/ui/tree/tree.types'
import type { ProjectPackageDifference, ProjectPackageAction } from '../../features/workspace/model/projectPackageManifest'
import {
  normalizeProjectPackageManifest,
  serializeProjectPackageManifest,
} from '../../features/workspace/model/projectPackageManifest'
import { PROJECT_PACKAGE_MANIFEST_FILE_NAME } from '../../features/workspace/model/projectStructure'

type PackageRow = ProjectPackageDifference | {
  readonly kind: 'installed'
  readonly key: string
  readonly requestedVersion: string
  readonly installedVersion?: string
}

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const projectStore = useProjectStore()
const busy = ref(false)
const error = ref('')
const rows = computed<readonly PackageRow[]>(() => {
  const environment = projectStore.projectResourceEnvironment.value
  const differences = new Map((environment.packageDifferences ?? []).map(difference => [difference.key, difference]))
  const declarations = environment.packageManifest?.packages ?? []
  const declared = declarations.map(requirement => differences.get(requirement.key) ?? {
    kind: 'installed' as const,
    key: requirement.key,
    requestedVersion: requirement.version,
    installedVersion: environment.packages?.get(requirement.key)?.manifest.version,
  })
  const extras = (environment.packageDifferences ?? []).filter(difference => difference.kind === 'extra')
    .filter(difference => !declarations.some(requirement => requirement.key === difference.key))
  return [...declared, ...extras]
})
const actionKeys = {
  'import-local-package': 'package.import-local',
  'check-repository': 'package.check-repository',
  'install-package': 'package.install',
  'update-package': 'package.update',
  'open-repository': 'package.open-repository',
  'remove-declaration': 'package.remove-declaration',
} as const

const treeActions: ReadonlyMap<string, OcTreeActionDefinition> = new Map([
  ['package.import-local', { title: t('externalPackageManager.importLocal'), icon: 'action.import' as const }],
  ['package.check-repository', { title: t('externalPackageManager.checkRepository'), icon: 'action.refresh' as const }],
  ['package.install', { title: t('externalPackageManager.install'), icon: 'action.download' as const }],
  ['package.update', { title: t('externalPackageManager.update'), icon: 'action.refresh' as const }],
  ['package.open-repository', { title: t('externalPackageManager.openRepository'), icon: 'action.export' as const }],
  ['package.remove-declaration', { title: t('externalPackageManager.removeDeclaration'), icon: 'action.delete' as const, iconTone: 'danger' as const }],
])

function rowActions(row: PackageRow): readonly string[] {
  if (row.kind === 'installed') return []
  return projectPackageActions(row).map(action => actionKeys[action])
}

const treeData = computed<OcTreeData>(() => ({
  rootKeys: rows.value.map(row => `${row.kind}:${row.key}`),
  items: new Map(rows.value.map(row => {
    const key = `${row.kind}:${row.key}`
    const actions = rowActions(row)
    return [key, {
      label: row.key,
      tail: row.kind === 'missing'
        ? t('externalPackageManager.missing', { version: row.requestedVersion ?? '' })
        : row.kind === 'version-mismatch'
          ? t('externalPackageManager.mismatch', { installed: row.installedVersion ?? '', requested: row.requestedVersion ?? '' })
          : row.kind === 'extra'
            ? t('externalPackageManager.extra')
            : t('externalPackageManager.installed', { version: row.installedVersion ?? row.requestedVersion }),
      icon: row.kind === 'extra' ? 'status.warning' : 'file.package',
      iconTone: row.kind === 'extra' ? 'warning' : 'config',
      actions,
    }]
  })),
  children: new Map(),
}))

watch(() => props.filePath, () => {
  emit('modified', false)
  error.value = ''
  void refresh()
}, { immediate: true })

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

async function handleTreeIntent(intent: OcTreeIntent): Promise<void> {
  if (intent.type !== 'action.invoke') return
  const row = rows.value.find(candidate => `${candidate.kind}:${candidate.key}` === intent.key)
  if (!row || row.kind === 'installed') return
  const action = Object.entries(actionKeys).find(([, key]) => key === intent.actionKey)?.[0] as ProjectPackageAction | undefined
  if (!action) return
  if (action === 'remove-declaration') {
    await removeDeclaration(row.key)
    return
  }
  if (action === 'check-repository') {
    await checkRepository(row)
    return
  }
  if (action === 'open-repository') {
    await openRepository(row)
    return
  }
  if ((action === 'install-package' || action === 'update-package') && row.repositoryPath) {
    await installRepository(row)
    return
  }
  await importPackage()
}

async function removeDeclaration(packageKey: string): Promise<void> {
  if (!projectStore.projectPath.value) return
  busy.value = true
  try {
    const path = `${projectStore.projectPath.value}/${PROJECT_PACKAGE_MANIFEST_FILE_NAME}`
    const manifest = normalizeProjectPackageManifest(await fileSystemService.readFile(path)).manifest
    await fileSystemService.writeFile(path, serializeProjectPackageManifest({
      ...manifest,
      packages: manifest.packages.filter(requirement => requirement.key !== packageKey),
    }))
    await refresh()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    busy.value = false
  }
}

async function checkRepository(row: Exclude<PackageRow, { kind: 'installed' }>): Promise<void> {
  if (!row.repositoryPath || !projectStore.projectPath.value) return
  busy.value = true
  try {
    const path = `${projectStore.projectPath.value}/${row.repositoryPath}`.replace(/\\/g, '/')
    if (!await fileSystemService.fileExists(path)) throw new Error(t('externalPackageManager.repositoryUnavailable', { path }))
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    busy.value = false
  }
}

async function openRepository(row: Exclude<PackageRow, { kind: 'installed' }>): Promise<void> {
  if (!row.repositoryPath || !projectStore.projectPath.value) return
  const path = `${projectStore.projectPath.value}/${row.repositoryPath}`.replace(/\\/g, '/')
  await fileSystemService.openWithDefaultApp(path)
}

async function installRepository(row: Exclude<PackageRow, { kind: 'installed' }>): Promise<void> {
  if (!row.repositoryPath || !projectStore.projectPath.value) return
  busy.value = true
  error.value = ''
  try {
    const path = `${projectStore.projectPath.value}/${row.repositoryPath}`.replace(/\\/g, '/')
    if (!await fileSystemService.fileExists(path)) throw new Error(t('externalPackageManager.repositoryUnavailable', { path }))
    await projectStore.installResourcePackageFile(path)
    await refresh()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    busy.value = false
  }
}

async function importPackage(): Promise<void> {
  if (busy.value || !projectStore.projectPath.value) return
  const source = await fileSystemService.pickFile({
    title: t('externalPackageManager.choose'),
    fileTypeName: 'OpenCard external package',
    extensions: ['ocpack'],
    defaultPath: projectStore.projectPath.value,
  })
  if (!source) return
  busy.value = true
  error.value = ''
  try {
    await projectStore.installResourcePackageFile(source)
    await refresh()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.external-package-manager { min-width: 0; min-height: 0; height: 100%; overflow: hidden; }
.external-package-manager__error { padding: var(--oc-space-3); }
</style>
