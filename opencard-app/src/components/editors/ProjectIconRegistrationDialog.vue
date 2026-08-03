<template>
  <OcDialog class="project-icon-registration-dialog" :open="open"
    :title="t('projectConfig.icons.register')" as="form" size="md"
    min-height="md"
    close-on-backdrop :dismissible="!busy" @request-close="close" @submit="submit">
    <label class="project-icon-registration-dialog__field">
      <span>{{ t('projectConfig.icons.iconSetName') }}</span>
      <OcFieldInput full-width autofocus :value="iconSetName"
        :aria-invalid="!validName" @input="updateText('name', $event)" />
    </label>
    <label class="project-icon-registration-dialog__field">
      <span>{{ t('projectConfig.icons.iconSetKey') }}</span>
      <OcFieldInput full-width mono :value="iconSetKey"
        :aria-invalid="!validKey || !uniqueKey" @input="updateText('key', $event)" />
    </label>

    <label class="project-icon-registration-dialog__field">
      <span>{{ t('projectConfig.icons.file') }}</span>
      <span class="project-icon-registration-dialog__file-control">
        <OcFieldInput full-width mono readonly :value="selectedPath"
          :placeholder="t('projectConfig.icons.noFileSelected')" />
        <OcButton type="button" icon="nav.files" variant="outline" :disabled="busy" @click="pickIconFile">
          {{ t('projectConfig.icons.chooseFile') }}
        </OcButton>
      </span>
    </label>

    <div v-if="selectedPath" class="project-icon-registration-dialog__mode" role="status">
      <OcIcon :name="copyRequired ? 'action.copy' : 'action.check'" size="sm" tone="muted" />
      <OcText as="span" tone="muted" size="sm">
        {{ copyRequired ? t('projectConfig.icons.copyIntoProject') : t('projectConfig.icons.registerProjectFile') }}
      </OcText>
    </div>

    <label v-if="copyRequired" class="project-icon-registration-dialog__field">
      <span>{{ t('projectConfig.icons.copyDirectory') }}</span>
      <OcFieldInput full-width mono :value="copyDirectory" :aria-invalid="!normalizedCopyDirectory"
        @input="updateText('copyDirectory', $event)" />
    </label>

    <OcText v-if="validationMessage" tone="danger" size="sm" role="alert">
      {{ validationMessage }}
    </OcText>
    <OcText v-if="error" tone="danger" size="sm" role="alert">{{ error }}</OcText>

    <template #footer>
      <OcButton type="button" :disabled="busy" @click="close">{{ t('projectConfig.icons.cancel') }}</OcButton>
      <OcButton type="submit" variant="solid" :disabled="!canSubmit || busy">
        {{ t('projectConfig.icons.confirmRegister') }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script lang="ts">
export type ProjectIconRegistrationRequest = {
  name: string
  key: string
  sourcePath: string
  targetDirectory?: string
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  createAvailableProjectIconSeriesKey,
  normalizeProjectIconDirectory,
  projectIconKeyPattern,
  type ProjectIconSeries,
} from '../../features/workspace/model/projectIcons'
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
  getRelativeProjectPath: (path: string) => string | null
}>(), {
  series: () => [],
  defaultOpenPath: undefined,
  busy: false,
  error: '',
})
const emit = defineEmits<{
  close: []
  submit: [request: ProjectIconRegistrationRequest]
}>()
const { t } = useI18n()
const selectedPath = ref('')
const projectSource = ref<string | null>(null)
const copyRequired = ref(false)
const copyDirectory = ref('')
const iconSetName = ref('')
const iconSetKey = ref('')
const keyEdited = ref(false)

const normalizedName = computed(() => iconSetName.value.trim())
const validName = computed(() => normalizedName.value.length > 0)
const validKey = computed(() => projectIconKeyPattern.test(iconSetKey.value))
const uniqueKey = computed(() => !props.series.some(series => (
  series.key.toLocaleLowerCase() === iconSetKey.value.toLocaleLowerCase()
)))
const normalizedCopyDirectory = computed(() => normalizeProjectIconDirectory(copyDirectory.value))
const sourceAlreadyRegistered = computed(() => Boolean(projectSource.value && props.series.some(series => (
  series.source.toLocaleLowerCase() === projectSource.value?.toLocaleLowerCase()
))))
const canSubmit = computed(() => Boolean(
  selectedPath.value
  && validName.value
  && validKey.value
  && uniqueKey.value
  && !sourceAlreadyRegistered.value
  && (!copyRequired.value || normalizedCopyDirectory.value),
))
const validationMessage = computed(() => {
  if (!validName.value) return t('projectConfig.icons.invalidIconSetName')
  if (!validKey.value) return t('projectConfig.icons.invalidIconSetKey')
  if (!uniqueKey.value) return t('projectConfig.icons.iconSetKeyExists')
  if (!selectedPath.value) return ''
  if (copyRequired.value && !normalizedCopyDirectory.value) return t('projectConfig.icons.invalidCopyDirectory')
  if (sourceAlreadyRegistered.value) return t('projectConfig.icons.alreadyRegistered')
  return ''
})

watch(() => props.open, open => {
  if (!open) return
  selectedPath.value = ''
  projectSource.value = null
  copyRequired.value = false
  copyDirectory.value = props.defaultDirectory
  iconSetName.value = t('projectConfig.icons.defaultIconSetName')
  iconSetKey.value = createAvailableProjectIconSeriesKey(iconSetName.value, props.series)
  keyEdited.value = false
}, { immediate: true })

async function pickIconFile(): Promise<void> {
  const path = await fileSystemService.pickFile({
    title: t('projectConfig.icons.pickTitle'),
    fileTypeName: t('projectConfig.icons.fileType'),
    extensions: ['png', 'jpg', 'jpeg', 'webp'],
    defaultPath: props.defaultOpenPath,
  })
  if (!path) return
  selectedPath.value = path
  projectSource.value = props.getRelativeProjectPath(path)
  copyRequired.value = projectSource.value === null
  const derivedName = fileName(path).replace(/\.(?:png|jpe?g|webp)$/i, '')
  iconSetName.value = derivedName
  if (!keyEdited.value) iconSetKey.value = createAvailableProjectIconSeriesKey(derivedName, props.series)
}

function fileName(path: string): string {
  const segments = path.replace(/\\/g, '/').split('/')
  return segments[segments.length - 1] ?? path
}
function updateText(field: 'copyDirectory' | 'name' | 'key', event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) return
  if (field === 'copyDirectory') copyDirectory.value = event.target.value
  else if (field === 'name') {
    iconSetName.value = event.target.value
    if (!keyEdited.value) iconSetKey.value = createAvailableProjectIconSeriesKey(iconSetName.value, props.series)
  } else {
    iconSetKey.value = event.target.value
    keyEdited.value = true
  }
}
function close(): void {
  if (!props.busy) emit('close')
}
function submit(): void {
  if (!canSubmit.value) return
  emit('submit', {
    name: normalizedName.value,
    key: iconSetKey.value,
    sourcePath: selectedPath.value,
    ...(copyRequired.value && normalizedCopyDirectory.value
      ? { targetDirectory: normalizedCopyDirectory.value }
      : {}),
  })
}
</script>

<style scoped>
.project-icon-registration-dialog__mode,
.project-icon-registration-dialog__file-control {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
}

.project-icon-registration-dialog__field {
  display: grid;
  min-width: 0;
  gap: var(--oc-space-2);
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
}

.project-icon-registration-dialog__file-control > :first-child { min-width: 0; flex: 1; }
.project-icon-registration-dialog__mode { padding-block: var(--oc-space-2); border-block: var(--oc-border-width) solid var(--oc-border-muted); }
</style>
