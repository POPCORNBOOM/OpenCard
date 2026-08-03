<template>
  <ProjectRegistryEditorShell icon="file.font" :title="t('fontRegistry.title')"
    :description="t('fontRegistry.description')" @keydown.ctrl.s.prevent="save">
    <template v-if="document" #actions>
      <OcButton icon="action.add" variant="soft" :disabled="importBusy" @click="openRegistrationDialog()">
        {{ t('projectConfig.fonts.register') }}
      </OcButton>
    </template>

    <ProjectFontRegistryEditor v-if="document" :fonts="document.fonts" :busy="importBusy"
      :load-errors="projectStore.projectFontLoadErrors.value" :show-header="false"
      @update:fonts="updateFonts" @register-font="openRegistrationDialog()"
      @configure-font="openRegistrationDialog" />

    <ProjectRegistryRepairEditor v-else :model-value="props.modelValue ?? ''" :theme-id="themeId"
      :theme-overrides="themeOverrides" :title="t('fontRegistry.invalid')" :description="t('fontRegistry.repair')"
      @update:model-value="updateRawSource" @save="save" />

    <ProjectFontRegistrationDialog :open="registrationDialogOpen" :fonts="document?.fonts"
      :original-key="registrationOriginalKey" :busy="importBusy" :error="importError"
      :default-directory="settingsStore.settings.value.workspace.defaultFontImportDirectory"
      :default-open-path="projectDirectory" :get-relative-project-path="projectStore.getRelativeProjectPathIfInside"
      @close="closeRegistrationDialog" @submit="registerFont" />
  </ProjectRegistryEditorShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import { reportAppError } from '../../features/logging/appErrorCatalog'
import { useAppSettingsStore } from '../../features/settings/store/appSettingsStore'
import {
  parseProjectFontRegistryText,
  PROJECT_FONT_REGISTRY_FILE_NAME,
  serializeProjectFontRegistry,
  type ProjectFontRegistry,
  type ProjectFontRegistryDocument,
} from '../../features/workspace/model/projectFontRegistry'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import OcButton from '../base/OcButton.vue'
import ProjectFontRegistrationDialog, {
  type ProjectFontRegistrationRequest,
} from './ProjectFontRegistrationDialog.vue'
import ProjectFontRegistryEditor from './ProjectFontRegistryEditor.vue'
import ProjectRegistryEditorShell from './ProjectRegistryEditorShell.vue'
import ProjectRegistryRepairEditor from './ProjectRegistryRepairEditor.vue'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const projectStore = useProjectStore()
const settingsStore = useAppSettingsStore()
const document = ref<ProjectFontRegistryDocument | null>(null)
const importBusy = ref(false)
const importError = ref('')
const registrationDialogOpen = ref(false)
const registrationOriginalKey = ref<string>()

const themeId = computed(() => props.themeId ?? 'dark')
const themeOverrides = computed(() => props.themeOverrides ?? {})
const projectDirectory = computed(() => {
  const source = projectStore.projectPath.value || props.filePath
  const normalized = source.replace(/\\/g, '/').replace(/\/+$/, '')
  return normalized.endsWith(`/${PROJECT_FONT_REGISTRY_FILE_NAME}`)
    ? normalized.slice(0, -PROJECT_FONT_REGISTRY_FILE_NAME.length - 1)
    : normalized
})

watch(() => props.modelValue, content => {
  document.value = parseProjectFontRegistryText(content ?? '')
}, { immediate: true })

function commit(next: ProjectFontRegistryDocument): void {
  try {
    const content = serializeProjectFontRegistry(next)
    document.value = parseProjectFontRegistryText(content)
    emit('update:modelValue', content)
  } catch (error) {
    reportAppError('OC-E3006', error)
  }
}

function updateFonts(fonts: ProjectFontRegistry): void {
  commit(Object.keys(fonts).length > 0 ? { fonts } : {})
}

function openRegistrationDialog(originalKey?: string): void {
  if (!document.value || importBusy.value) return
  if (originalKey && !document.value.fonts?.[originalKey]) return
  importError.value = ''
  registrationOriginalKey.value = originalKey
  registrationDialogOpen.value = true
}

function closeRegistrationDialog(): void {
  if (importBusy.value) return
  registrationDialogOpen.value = false
  registrationOriginalKey.value = undefined
  importError.value = ''
}

async function registerFont(request: ProjectFontRegistrationRequest): Promise<void> {
  if (!document.value || importBusy.value) return
  importError.value = ''
  importBusy.value = true
  try {
    const fonts = document.value.fonts ?? {}
    const originalIdentity = request.originalKey?.toLocaleLowerCase()
    if (Object.keys(fonts).some(key => (
      key.toLocaleLowerCase() === request.key.toLocaleLowerCase()
      && key.toLocaleLowerCase() !== originalIdentity
    ))) {
      importError.value = t('projectConfig.fonts.keyExists')
      return
    }
    const original = request.originalKey ? fonts[request.originalKey] : undefined
    const source = original && request.sourcePath === original.source && !request.targetDirectory
      ? original.source
      : (await projectStore.importProjectFontFile(request.sourcePath, request.targetDirectory)).source
    if (Object.entries(fonts).some(([key, definition]) => (
      key.toLocaleLowerCase() !== originalIdentity
      && definition.source.toLocaleLowerCase() === source.toLocaleLowerCase()
    ))) {
      importError.value = t('projectConfig.fonts.alreadyRegistered')
      return
    }

    const definition = { name: request.name, source }
    const entries = request.originalKey
      ? Object.entries(fonts).map(([key, current]) => (
          key === request.originalKey ? [request.key, definition] as const : [key, current] as const
        ))
      : [...Object.entries(fonts), [request.key, definition] as const]
    updateFonts(Object.fromEntries(entries))
    registrationDialogOpen.value = false
    registrationOriginalKey.value = undefined
    importError.value = ''
  } catch (error) {
    reportAppError('OC-E3007', error)
    importError.value = t('projectConfig.fonts.registrationFailed')
  } finally {
    importBusy.value = false
  }
}

function updateRawSource(content: string): void {
  emit('update:modelValue', content)
}

function save(): void {
  if (document.value) emit('save')
}

defineExpose({ save })
</script>
