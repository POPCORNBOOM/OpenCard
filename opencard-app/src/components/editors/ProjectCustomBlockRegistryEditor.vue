<template>
  <ProjectRegistryEditorShell icon="file.custom-block" content-mode="workspace" header-mode="hidden"
    :heading="t('customBlockRegistry.title')" :description="t('customBlockRegistry.description')"
    @keydown.ctrl.s.prevent="save">
    <div v-if="document" class="custom-block-registry-editor">
      <div class="custom-block-registry-editor__toolbar">
        <OcText as="h2" size="lg" bold>{{ t('customBlockRegistry.title') }}</OcText>
        <OcButton v-if="!isObserveOnly" icon="action.import" variant="solid" :disabled="busy" @click="addBlock">
          {{ t('customBlockRegistry.add') }}
        </OcButton>
      </div>
      <OcText as="p" size="sm" tone="muted">{{ t('customBlockRegistry.description') }}</OcText>
      <OcText v-if="error" as="p" size="sm" tone="danger" role="alert">{{ error }}</OcText>
      <OcPanel fill padding="none" overflow="auto">
        <OcTree v-if="treeData.rootKeys.length" fill :data="treeData" :actions="actions"
          :selected-keys="[]" selection-mode="none" :aria-label="t('customBlockRegistry.title')"
          @intent="handleIntent" />
        <div v-else class="custom-block-registry-editor__empty">
          <OcText tone="muted">{{ t('customBlockRegistry.empty') }}</OcText>
        </div>
      </OcPanel>
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
import OcPanel from '../base/OcPanel.vue'
import OcText from '../base/OcText.vue'
import OcTree from '../standard/OcTree.vue'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import {
  parseProjectCustomBlockRegistryText,
  serializeProjectCustomBlockRegistry,
  type ProjectCustomBlockRegistryDocument,
} from '../../features/workspace/model/projectCustomBlocks'
import { registerProjectCustomBlockPath, unregisterProjectCustomBlockPath } from '../../features/workspace/services/projectCustomBlockRegistry'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent } from '../../shared/ui/tree/tree.types'
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
const comparisonPaths = computed(() => new Set(
  parseProjectCustomBlockRegistryText(props.comparisonContent ?? '')?.blocks ?? [],
))
const actions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  ['remove', { title: t('customBlockRegistry.remove'), icon: 'action.delete', iconTone: 'danger' }],
]))
const treeData = computed<OcTreeData>(() => {
  const paths = document.value?.blocks ?? []
  return {
    rootKeys: [...paths],
    items: new Map(paths.map(path => {
      const differs = isObserveOnly.value && !comparisonPaths.value.has(path)
      const isHistorical = props.comparisonSide === 'historical'
      return [path, {
        label: path.split('/').pop() ?? path,
        tail: path,
        icon: differs ? (isHistorical ? 'action.remove' : 'action.add') : 'file.custom-block',
        iconTone: differs ? (isHistorical ? 'danger' : 'success') : undefined,
        actions: isObserveOnly.value ? [] : ['remove'],
        contextActions: isObserveOnly.value ? [] : ['remove'],
      }]
    })),
    children: new Map(),
  }
})

watch(() => props.modelValue, content => {
  document.value = parseProjectCustomBlockRegistryText(content ?? '')
}, { immediate: true })

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
  if (isObserveOnly.value || !document.value || intent.type !== 'action.invoke' || intent.actionKey !== 'remove') return
  void commitAndSave(unregisterProjectCustomBlockPath(document.value, intent.key))
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
