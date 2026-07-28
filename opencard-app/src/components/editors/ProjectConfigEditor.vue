<template>
  <section class="project-profile-editor" :aria-label="t('projectConfig.title')" @keydown.ctrl.s.prevent="save">
    <div class="project-profile-editor__content">
      <header class="project-profile-editor__header">
        <OcIcon name="file.opencard-project" size="lg" />
        <div class="project-profile-editor__heading">
          <h1>{{ t('projectConfig.title') }}</h1>
          <OcText tone="muted" size="sm">{{ filePath }}</OcText>
        </div>
      </header>

      <template v-if="profile">
        <div class="project-profile-editor__form">
          <label class="project-profile-editor__field" data-field-key="name">
            <OcText as="span" size="sm">{{ t('projectConfig.fields.name') }}</OcText>
            <OcFieldInput full-width :value="profile.name ?? ''" @input="updateProfileField('name', $event)" />
          </label>
          <label class="project-profile-editor__field" data-field-key="description">
            <OcText as="span" size="sm">{{ t('projectConfig.fields.description') }}</OcText>
            <OcFieldInput as="textarea" full-width resize="vertical" :value="profile.description ?? ''"
              @input="updateProfileField('description', $event)" />
          </label>
          <label class="project-profile-editor__field" data-field-key="version">
            <OcText as="span" size="sm">{{ t('projectConfig.fields.version') }}</OcText>
            <OcFieldInput full-width :value="profile.version ?? ''" @input="updateProfileField('version', $event)" />
          </label>
        </div>

        <ProjectFontRegistryEditor
          :fonts="profile.fonts"
          :busy="fontImportBusy"
          :error="fontImportError"
          @update:fonts="updateFonts"
          @import-font="importFont"
          @import-face="importFontFace"
        />

        <section class="project-profile-editor__remote-resources">
          <div class="project-profile-editor__section-heading">
            <h2>{{ t('projectConfig.remoteResources.title') }}</h2>
            <OcText tone="muted" size="sm">{{ t('projectConfig.remoteResources.description') }}</OcText>
          </div>
          <OcOptionGroup
            class="project-profile-editor__remote-mode"
            :model-value="remoteResourceMode"
            :options="remoteResourceModeOptions"
            appearance="sliding-outline"
            fill
            @update:model-value="updateRemoteResourceMode"
          />
          <div v-if="remoteResourceMode === 'allowlist'" class="project-profile-editor__host-list">
            <div class="project-profile-editor__field-caption">
              <OcText as="span" size="sm">{{ t('projectConfig.remoteResources.allowedHosts') }}</OcText>
              <OcButton icon-only size="sm" variant="ghost" icon="status.unknown"
                :data-tooltip="t('projectConfig.remoteResources.hostHelp')"
                :aria-label="t('projectConfig.remoteResources.hostHelp')" />
            </div>
            <div v-for="(host, index) in remoteHostDrafts" :key="index"
              class="project-profile-editor__host-row">
              <OcFieldInput full-width mono :value="host" :aria-label="t('projectConfig.remoteResources.allowedHosts')"
                :aria-invalid="!isRemoteHostValid(host)" @input="updateRemoteHost(index, $event)" />
              <OcButton icon-only size="md" variant="ghost" icon="action.delete" icon-tone="danger"
                :data-tooltip="t('projectConfig.remoteResources.removeHost')"
                :aria-label="t('projectConfig.remoteResources.removeHost')" @click="removeRemoteHost(index)" />
            </div>
            <OcButton class="project-profile-editor__add-host" size="sm" variant="ghost" icon="action.add"
              @click="addRemoteHost">
              {{ t('projectConfig.remoteResources.addHost') }}
            </OcButton>
          </div>
        </section>

        <section class="project-profile-editor__dictionary">
          <div>
            <h2>{{ t('projectConfig.dictionary.title') }}</h2>
            <OcText tone="muted" size="sm">{{ t('projectConfig.dictionary.description') }}</OcText>
          </div>
          <OcButton
            :icon="dictionaryExists ? 'nav.arrow-right' : 'action.add'"
            variant="soft"
            @click="openOrCreateDictionary"
          >
            {{ dictionaryExists
              ? t('projectConfig.dictionary.open')
              : t('projectConfig.dictionary.create') }}
          </OcButton>
        </section>
      </template>

      <section v-else class="project-profile-editor__repair" role="alert">
        <div class="project-profile-editor__diagnostic">
          <OcIcon name="status.error" tone="danger" />
          <div>
            <strong>{{ t('projectConfig.invalid') }}</strong>
            <OcText tone="muted" size="sm">{{ t('projectConfig.repairHint') }}</OcText>
          </div>
        </div>
        <div class="project-profile-editor__source">
          <MonacoEditor
            :model-value="modelValue ?? ''"
            language="json"
            :theme-id="themeId"
            @update:model-value="updateRawSource"
            @save="save"
          />
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import {
  createProjectFontRegistration,
} from '../../features/workspace/model/projectFonts'
import {
  normalizeProjectAllowedHost,
  parseProjectMetadataText,
  serializeProjectMetadata,
  type ProjectFontRegistry,
  type ProjectProfile,
} from '../../features/workspace/model/projectMetadata'
import { PROJECT_DICTIONARY_FILE_NAME } from '../../features/workspace/model/projectDictionary'
import { resolveFileType } from '../../features/workspace/model/fileTypes'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import OcOptionGroup, { type OcOption } from '../standard/OcOptionGroup.vue'
import MonacoEditor from './MonacoEditor.vue'
import ProjectFontRegistryEditor from './ProjectFontRegistryEditor.vue'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const projectStore = useProjectStore()
const profile = ref<ProjectProfile | null>(null)
const dictionaryExists = ref(false)
const fontImportBusy = ref(false)
const fontImportError = ref('')
const remoteHostDrafts = ref<string[]>([])

const themeId = computed(() => props.themeId ?? 'dark')
const remoteResourceMode = computed(() => profile.value?.remoteResources?.mode ?? 'deny')
const remoteResourceModeOptions = computed<readonly OcOption[]>(() => [
  { value: 'deny', label: t('projectConfig.remoteResources.deny') },
  { value: 'allowlist', label: t('projectConfig.remoteResources.allowlist') },
  { value: 'allow-all', label: t('projectConfig.remoteResources.allowAll') },
])
const hasInvalidRemoteHostDraft = computed(() => remoteResourceMode.value === 'allowlist'
  && remoteHostDrafts.value.some(host => !isRemoteHostValid(host)))

watch(() => props.modelValue, content => {
  const nextProfile = parseProjectMetadataText(content ?? '')
  profile.value = nextProfile
  remoteHostDrafts.value = nextProfile?.remoteResources?.mode === 'allowlist'
    ? [...nextProfile.remoteResources.allowedHosts]
    : []
}, { immediate: true })

watch(() => projectStore.indexedEntries.value, () => {
  dictionaryExists.value = projectStore.indexedEntries.value.some(entry => (
    !entry.isDirectory
    && resolveFileType(
      projectStore.resolveProjectPath(entry.name),
      projectStore.projectPath.value,
    ).id === 'opencard-dictionary'
  ))
}, { immediate: true })

function updateProfileField(fieldKey: 'name' | 'description' | 'version', event: Event) {
  if (!profile.value || !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) return
  const value = event.target.value
  const next: ProjectProfile = { ...profile.value, [fieldKey]: value }
  if (value === '') delete next[fieldKey]
  updateProfile(next)
}

function updateFonts(fonts: ProjectFontRegistry) {
  if (!profile.value) return
  const next: ProjectProfile = { ...profile.value, fonts }
  if (Object.keys(fonts).length === 0) delete next.fonts
  updateProfile(next)
}

function updateRemoteResourceMode(mode: string) {
  if (!profile.value || !['deny', 'allowlist', 'allow-all'].includes(mode)) return
  const next: ProjectProfile = { ...profile.value }
  remoteHostDrafts.value = []
  if (mode === 'deny') delete next.remoteResources
  else if (mode === 'allowlist') next.remoteResources = { mode, allowedHosts: [] }
  else next.remoteResources = { mode: 'allow-all' }
  updateProfile(next)
}

function isRemoteHostValid(host: string): boolean {
  return normalizeProjectAllowedHost(host) !== null
}

function commitRemoteHostDrafts() {
  if (!profile.value || profile.value.remoteResources?.mode !== 'allowlist') return
  const normalizedHosts = remoteHostDrafts.value.map(normalizeProjectAllowedHost)
  if (normalizedHosts.some(host => host === null)) return
  updateProfile({
    ...profile.value,
    remoteResources: {
      mode: 'allowlist',
      allowedHosts: [...new Set(normalizedHosts as string[])],
    },
  })
}

function updateRemoteHost(index: number, event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  remoteHostDrafts.value[index] = event.target.value
  commitRemoteHostDrafts()
}

function addRemoteHost() {
  remoteHostDrafts.value.push('')
}

function removeRemoteHost(index: number) {
  remoteHostDrafts.value.splice(index, 1)
  commitRemoteHostDrafts()
}

function updateProfile(next: ProjectProfile) {
  try {
    const serialized = serializeProjectMetadata(next)
    profile.value = next
    emit('update:modelValue', serialized)
  } catch (error) {
    console.error('[project-profile] Invalid profile draft', error)
  }
}

async function pickAndImportFont(targetId?: string) {
  if (!profile.value || fontImportBusy.value) return
  fontImportError.value = ''
  fontImportBusy.value = true
  try {
    const selectedPath = await fileSystemService.pickFile({
      title: t('projectConfig.fonts.pickTitle'),
      fileTypeName: t('projectConfig.fonts.fileType'),
      extensions: ['woff', 'woff2', 'ttf', 'otf'],
    })
    if (!selectedPath) return
    const imported = await projectStore.importProjectFontFile(selectedPath)
    const fonts = profile.value.fonts ?? {}
    if (Object.values(fonts).some(definition => definition.faces.some(face => face.source === imported.source))) {
      fontImportError.value = t('projectConfig.fonts.alreadyRegistered')
      return
    }
    const registration = createProjectFontRegistration(imported.source, fonts)
    if (targetId && fonts[targetId]) {
      updateFonts({
        ...fonts,
        [targetId]: {
          ...fonts[targetId],
          faces: [...fonts[targetId].faces, ...registration.definition.faces],
        },
      })
      return
    }
    updateFonts({ ...fonts, [registration.id]: registration.definition })
  } catch (error) {
    console.error('[project-profile] Failed to import font:', error)
    fontImportError.value = t('projectConfig.fonts.importFailed')
  } finally {
    fontImportBusy.value = false
  }
}

async function importFont() {
  await pickAndImportFont()
}

async function importFontFace(id: string) {
  await pickAndImportFont(id)
}

function updateRawSource(content: string) {
  emit('update:modelValue', content)
}

async function openOrCreateDictionary() {
  const path = projectStore.resolveProjectPath(PROJECT_DICTIONARY_FILE_NAME)
  try {
    if (!dictionaryExists.value) {
      await projectStore.createFile(PROJECT_DICTIONARY_FILE_NAME, '{}')
      dictionaryExists.value = true
    }
    emit('open-file', path)
  } catch (error) {
    console.error('[project-profile] Failed to open dictionary:', { path, error })
  }
}

function save() {
  if (profile.value && !hasInvalidRemoteHostDraft.value) emit('save')
}

defineExpose({ save })
</script>

<style scoped>
.project-profile-editor {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  background: var(--oc-bg-base);
  color: var(--oc-fg-default);
}

.project-profile-editor__content {
  box-sizing: border-box;
  width: 100%;
  max-width: var(--oc-content-width-md);
  min-height: 100%;
  margin-inline: auto;
  padding: var(--oc-space-6) var(--oc-space-5);
}

.project-profile-editor__header,
.project-profile-editor__dictionary,
.project-profile-editor__diagnostic {
  display: flex;
  align-items: center;
  gap: var(--oc-space-3);
}

.project-profile-editor__header {
  padding-bottom: var(--oc-space-4);
  border-bottom: 1px solid var(--oc-border-muted);
}

.project-profile-editor__heading {
  min-width: 0;
}

.project-profile-editor h1,
.project-profile-editor h2 {
  margin: 0;
  font-weight: var(--font-weight-ui-title);
  letter-spacing: 0;
}

.project-profile-editor h1 {
  margin-bottom: var(--oc-space-1);
  font-size: var(--oc-text-lg);
}

.project-profile-editor h2 {
  margin-bottom: var(--oc-space-1);
  font-size: var(--oc-text-base);
}

.project-profile-editor__form {
  display: grid;
  gap: var(--oc-space-3);
  padding-block: var(--oc-space-5);
}

.project-profile-editor__field,
.project-profile-editor__host-list {
  display: grid;
  gap: var(--oc-space-1);
}

.project-profile-editor__field textarea {
  min-height: 88px;
}

.project-profile-editor__dictionary {
  justify-content: space-between;
  border-top: 1px solid var(--oc-border-muted);
  padding-top: var(--oc-space-5);
}

.project-profile-editor__remote-resources {
  display: grid;
  gap: var(--oc-space-3);
  padding-block: var(--oc-space-5);
  border-top: 1px solid var(--oc-border-muted);
}

.project-profile-editor__remote-mode {
  width: 100%;
  max-width: 240px;
}

.project-profile-editor__section-heading {
  display: grid;
  gap: var(--oc-space-1);
}

.project-profile-editor__host-row {
  display: flex;
  align-items: flex-start;
  gap: var(--oc-space-1);
}

.project-profile-editor__field-caption {
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-1);
}

.project-profile-editor__add-host {
  justify-self: start;
}

.project-profile-editor__dictionary > div {
  min-width: 0;
}

.project-profile-editor__repair {
  display: grid;
  grid-template-rows: auto minmax(360px, 1fr);
  gap: var(--oc-space-4);
  min-height: 560px;
  padding-top: var(--oc-space-5);
}

.project-profile-editor__diagnostic {
  align-items: flex-start;
}

.project-profile-editor__diagnostic div {
  display: grid;
  gap: var(--oc-space-1);
}

.project-profile-editor__source {
  min-height: 360px;
  overflow: hidden;
  border: 1px solid var(--oc-border-muted);
}

@media (max-width: 640px) {
  .project-profile-editor__content {
    padding-inline: var(--oc-space-3);
  }

  .project-profile-editor__dictionary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
