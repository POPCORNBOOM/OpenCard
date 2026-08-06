<template>
  <OcDialog class="project-icon-pack-dialog" :open="open" :title="t('projectConfig.icons.importPack')"
    as="form" size="md" min-height="md" close-on-backdrop :dismissible="!busy"
    @request-close="close" @submit="submit">
    <label class="project-icon-pack-dialog__field">
      <span>{{ t('projectConfig.icons.packFile') }}</span>
      <span class="project-icon-pack-dialog__file-control">
        <OcFieldInput full-width mono readonly :value="selectedPath"
          :aria-invalid="!selectedPath" :placeholder="t('projectConfig.icons.noPackSelected')" />
        <OcButton type="button" icon="nav.files" variant="outline" :disabled="busy" @click="pickIconPackFile">
          {{ t('projectConfig.icons.choosePack') }}
        </OcButton>
      </span>
    </label>

    <label class="project-icon-pack-dialog__field">
      <span>{{ t('projectConfig.icons.packName') }}</span>
      <OcFieldInput full-width :value="packName" :aria-invalid="Boolean(selectedPath) && !packName.trim()"
        @input="updateText('name', $event)" />
    </label>

    <label class="project-icon-pack-dialog__field">
      <span>{{ t('projectConfig.icons.packKey') }}</span>
      <OcFieldInput full-width mono :value="packKey" :placeholder="generatedKey"
        :aria-invalid="Boolean(packKey) && (!validKey || !uniqueKey)" @input="updateText('key', $event)" />
    </label>

    <div v-if="selectedPath" class="project-icon-pack-dialog__mode" role="status">
      <OcIcon name="action.copy" size="sm" tone="muted" />
      <OcText as="span" tone="muted" size="sm">{{ t('projectConfig.icons.packCopyIntoProject') }}</OcText>
    </div>

    <label v-if="selectedPath" class="project-icon-pack-dialog__field">
      <span>{{ t('projectConfig.icons.copyDirectory') }}</span>
      <OcFieldInput full-width mono :value="copyDirectory" :aria-invalid="!normalizedCopyDirectory"
        @input="updateText('copyDirectory', $event)" />
    </label>

    <OcText v-if="validationMessage" tone="danger" size="sm" role="alert">{{ validationMessage }}</OcText>
    <OcText v-if="error || packError" tone="danger" size="sm" role="alert">{{ error || packError }}</OcText>

    <template #footer>
      <OcButton type="button" :disabled="busy" @click="close">{{ t('projectConfig.icons.cancel') }}</OcButton>
      <OcButton type="submit" variant="solid" :disabled="!canSubmit || busy">
        {{ t('projectConfig.icons.confirmImportPack') }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script lang="ts">
export type ProjectIconPackImportRequest = {
  packPath: string
  name: string
  key: string
  targetDirectory: string
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { createAvailableProjectIconSeriesKey, normalizeProjectIconDirectory, projectIconKeyPattern, type ProjectIconSeries } from '../../features/workspace/model/projectIcons'
import { readProjectIconPack, type ProjectIconPack } from '../../features/workspace/services/projectIconPack'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcDialog from '../standard/OcDialog.vue'

const props = withDefaults(defineProps<{
  open: boolean
  series?: readonly ProjectIconSeries[]
  defaultDirectory: string
  defaultOpenPath?: string
  busy?: boolean
  error?: string
}>(), { series: () => [], defaultOpenPath: undefined, busy: false, error: '' })
const emit = defineEmits<{
  close: []
  submit: [request: ProjectIconPackImportRequest]
}>()
const { t } = useI18n()
const selectedPath = ref('')
const packName = ref('')
const packKey = ref('')
const copyDirectory = ref('')
const pack = ref<ProjectIconPack | null>(null)
const packError = ref('')

const normalizedCopyDirectory = computed(() => normalizeProjectIconDirectory(copyDirectory.value))
const generatedKey = computed(() => createAvailableProjectIconSeriesKey(packName.value, props.series ?? []))
const effectiveKey = computed(() => packKey.value || generatedKey.value)
const validKey = computed(() => projectIconKeyPattern.test(effectiveKey.value))
const uniqueKey = computed(() => !(props.series ?? []).some(series => (
  series.key.toLocaleLowerCase() === effectiveKey.value.toLocaleLowerCase()
)))
const canSubmit = computed(() => Boolean(
  pack.value && selectedPath.value && packName.value.trim() && validKey.value && uniqueKey.value
  && normalizedCopyDirectory.value,
))
const validationMessage = computed(() => {
  if (!selectedPath.value) return ''
  if (!pack.value) return t('projectConfig.icons.invalidPack')
  if (!packName.value.trim()) return t('projectConfig.icons.invalidPackName')
  if (!validKey.value) return t('projectConfig.icons.invalidIconSetKey')
  if (!uniqueKey.value) return t('projectConfig.icons.iconSetKeyExists')
  if (!normalizedCopyDirectory.value) return t('projectConfig.icons.invalidCopyDirectory')
  return ''
})

watch(() => props.open, open => {
  if (!open) return
  selectedPath.value = ''
  packName.value = ''
  packKey.value = ''
  copyDirectory.value = props.defaultDirectory
  pack.value = null
  packError.value = ''
}, { immediate: true })

async function pickIconPackFile(): Promise<void> {
  const path = await fileSystemService.pickFile({
    title: t('projectConfig.icons.pickPackTitle'),
    fileTypeName: t('projectConfig.icons.packFileType'),
    extensions: ['ociconpack'],
    defaultPath: props.defaultOpenPath,
  })
  if (!path) return
  selectedPath.value = path
  packKey.value = ''
  packError.value = ''
  try {
    pack.value = await readProjectIconPack(fileSystemService, path)
    packName.value = pack.value.manifest.name || fileName(path).replace(/\.ociconpack$/i, '')
  } catch {
    pack.value = null
    packName.value = fileName(path).replace(/\.ociconpack$/i, '')
    packError.value = t('projectConfig.icons.invalidPack')
  }
}

function updateText(field: 'copyDirectory' | 'name' | 'key', event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) return
  if (field === 'copyDirectory') copyDirectory.value = event.target.value
  else if (field === 'name') packName.value = event.target.value
  else packKey.value = event.target.value
}

function close(): void {
  if (!props.busy) emit('close')
}

function submit(): void {
  if (!canSubmit.value || !normalizedCopyDirectory.value) return
  emit('submit', {
    packPath: selectedPath.value,
    name: packName.value.trim(),
    key: effectiveKey.value,
    targetDirectory: normalizedCopyDirectory.value,
  })
}

function fileName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path
}
</script>

<style scoped>
.project-icon-pack-dialog__mode,
.project-icon-pack-dialog__file-control {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
}
.project-icon-pack-dialog__field { display: grid; min-width: 0; gap: var(--oc-space-2); color: var(--oc-fg-muted); font-size: var(--oc-text-sm); }
.project-icon-pack-dialog__file-control > :first-child { min-width: 0; flex: 1; }
.project-icon-pack-dialog__mode { padding-block: var(--oc-space-2); border-block: var(--oc-border-width) solid var(--oc-border-muted); }
</style>
