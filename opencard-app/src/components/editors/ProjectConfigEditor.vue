<template>
  <section ref="editorRoot" class="project-profile-editor" :aria-label="t('projectConfig.title')"
    @scroll.passive="updateActiveSection" @keydown.ctrl.s.prevent="save">
    <div class="project-profile-editor__layout" :class="{ 'project-profile-editor__layout--single': !profile }">
      <main class="project-profile-editor__content">
        <header class="project-profile-editor__header">
          <OcIcon name="file.opencard-project" size="lg" />
          <div class="project-profile-editor__heading">
            <h1>{{ t('projectConfig.title') }}</h1>
            <OcText tone="muted" size="sm">{{ filePath }}</OcText>
          </div>
        </header>

      <template v-if="profile">
        <ProjectConfigSection section-id="project-profile-section-information"
          :heading="t('projectConfig.sections.information')"
          :expand-label="t('projectConfig.sections.expand', { section: t('projectConfig.sections.information') })"
          :collapse-label="t('projectConfig.sections.collapse', { section: t('projectConfig.sections.information') })"
          :collapsed="isProjectSectionCollapsed('information')"
          @toggle="toggleProjectSection('information')">
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
        </ProjectConfigSection>

        <ProjectConfigSection section-id="project-profile-section-remote-resources"
          :heading="t('projectConfig.remoteResources.title')"
          :description="t('projectConfig.remoteResources.description')"
          :expand-label="t('projectConfig.sections.expand', { section: t('projectConfig.remoteResources.title') })"
          :collapse-label="t('projectConfig.sections.collapse', { section: t('projectConfig.remoteResources.title') })"
          :collapsed="isProjectSectionCollapsed('remote-resources')"
          @toggle="toggleProjectSection('remote-resources')">
          <div class="project-profile-editor__remote-resources">
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
                <OcFieldInput full-width mono :value="host"
                  :aria-label="t('projectConfig.remoteResources.allowedHosts')"
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
          </div>
        </ProjectConfigSection>

        <ProjectConfigSection section-id="project-profile-section-dictionary"
          :heading="t('projectConfig.dictionary.title')" :description="t('projectConfig.dictionary.description')"
          :expand-label="t('projectConfig.sections.expand', { section: t('projectConfig.dictionary.title') })"
          :collapse-label="t('projectConfig.sections.collapse', { section: t('projectConfig.dictionary.title') })"
          :collapsed="isProjectSectionCollapsed('dictionary')" @toggle="toggleProjectSection('dictionary')">
          <div class="project-profile-editor__dictionary">
            <div>
              <OcText tone="muted" size="sm">{{ dictionaryExists
                ? t('projectConfig.dictionary.available')
                : t('projectConfig.dictionary.missing') }}</OcText>
            </div>
            <OcButton :icon="dictionaryExists ? 'nav.arrow-right' : 'action.add'" variant="soft"
              @click="openOrCreateDictionary">
              {{ dictionaryExists
                ? t('projectConfig.dictionary.open')
                : t('projectConfig.dictionary.create') }}
            </OcButton>
          </div>
        </ProjectConfigSection>
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
            :theme-overrides="themeOverrides"
            @update:model-value="updateRawSource"
            @save="save"
          />
        </div>
      </section>
      </main>

      <nav v-if="profile" class="project-profile-editor__outline" :aria-label="t('projectConfig.outline.title')">
        <button v-for="section in projectProfileSections" :key="section.key" type="button"
          class="project-profile-editor__outline-item"
          :class="{ 'is-active': activeSection === section.key }"
          :aria-label="t(section.labelKey)"
          :aria-current="activeSection === section.key ? 'location' : undefined"
          @click="navigateToProjectSection(section.key)">
          <span class="project-profile-editor__outline-label">{{ t(section.labelKey) }}</span>
          <span class="project-profile-editor__outline-node" aria-hidden="true" />
        </button>
      </nav>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { reportAppError } from '../../features/logging/appErrorCatalog'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import { useAppSettingsStore } from '../../features/settings/store/appSettingsStore'
import type { ProjectWorkspaceState } from '../../features/settings/model/appSettings'
import {
  normalizeProjectAllowedHost,
  parseProjectMetadataText,
  PROJECT_PROFILE_FILE_NAME,
  serializeProjectMetadata,
  type ProjectProfile,
} from '../../features/workspace/model/projectMetadata'
import { PROJECT_DICTIONARY_FILE_NAME } from '../../features/workspace/model/projectDictionary'
import { resolveFileType } from '../../features/workspace/model/fileTypes'
import OcOptionGroup, { type OcOption } from '../standard/OcOptionGroup.vue'
import MonacoEditor from './MonacoEditor.vue'
import ProjectConfigSection from './ProjectConfigSection.vue'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const projectStore = useProjectStore()
const settingsStore = useAppSettingsStore()
const profile = ref<ProjectProfile | null>(null)
const dictionaryExists = ref(false)
const remoteHostDrafts = ref<string[]>([])
const editorRoot = ref<HTMLElement | null>(null)
const activeSection = ref<ProjectProfileSectionKey>('information')

type ProjectProfileSectionKey = 'information' | 'remote-resources' | 'dictionary'

const projectProfileSections = [
  { key: 'information', labelKey: 'projectConfig.sections.information' },
  { key: 'remote-resources', labelKey: 'projectConfig.remoteResources.title' },
  { key: 'dictionary', labelKey: 'projectConfig.dictionary.title' },
] as const satisfies readonly { key: ProjectProfileSectionKey, labelKey: string }[]

const themeId = computed(() => props.themeId ?? 'dark')
const themeOverrides = computed(() => props.themeOverrides ?? {})
const projectDirectoryKey = computed(() => {
  const source = projectStore.projectPath.value || props.filePath || ''
  const normalized = source.replace(/\\/g, '/').replace(/\/+$/, '')
  return normalized.endsWith(`/${PROJECT_PROFILE_FILE_NAME}`)
    ? normalized.slice(0, -PROJECT_PROFILE_FILE_NAME.length - 1)
    : normalized
})
const projectWorkspaceState = computed(() => {
  const identity = projectDirectoryKey.value.toLocaleLowerCase()
  return Object.entries(settingsStore.settings.value.projectCreation.workspaceStates)
    .find(([path]) => path.toLocaleLowerCase() === identity)?.[1]
})
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
  void nextTick(updateActiveSection)
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
    reportAppError('OC-E3006', error)
  }
}

function isProjectSectionCollapsed(sectionKey: ProjectProfileSectionKey): boolean {
  return projectWorkspaceState.value?.projectProfile?.collapsedSections.includes(sectionKey) ?? false
}

function setProjectSectionCollapsed(sectionKey: ProjectProfileSectionKey, collapsed: boolean): void {
  const workspaceKey = projectDirectoryKey.value
  if (!workspaceKey) return
  const collapsedSections = new Set(projectWorkspaceState.value?.projectProfile?.collapsedSections
    .filter(key => projectProfileSections.some(section => section.key === key)) ?? [])
  if (collapsed) collapsedSections.add(sectionKey)
  else collapsedSections.delete(sectionKey)

  const workspaceStates: Record<string, ProjectWorkspaceState> = Object.fromEntries(
    Object.entries(settingsStore.settings.value.projectCreation.workspaceStates).map(([path, state]) => [path, {
      expandedDirectories: [...state.expandedDirectories],
      ...(state.projectProfile
        ? { projectProfile: { collapsedSections: [...state.projectProfile.collapsedSections] } }
        : {}),
    }]),
  )
  const existingKey = Object.keys(workspaceStates)
    .find(path => path.toLocaleLowerCase() === workspaceKey.toLocaleLowerCase())
  const currentState = existingKey ? workspaceStates[existingKey] : undefined
  if (existingKey && existingKey !== workspaceKey) delete workspaceStates[existingKey]
  if (collapsedSections.size > 0) {
    workspaceStates[workspaceKey] = {
      expandedDirectories: [...(currentState?.expandedDirectories ?? [])],
      projectProfile: { collapsedSections: [...collapsedSections] },
    }
  } else {
    workspaceStates[workspaceKey] = {
      expandedDirectories: [...(currentState?.expandedDirectories ?? [])],
    }
  }
  settingsStore.updateProjectCreation({ workspaceStates })
}

function toggleProjectSection(sectionKey: ProjectProfileSectionKey): void {
  setProjectSectionCollapsed(sectionKey, !isProjectSectionCollapsed(sectionKey))
}

function projectSectionElementId(sectionKey: ProjectProfileSectionKey): string {
  return `project-profile-section-${sectionKey}`
}

async function navigateToProjectSection(sectionKey: ProjectProfileSectionKey): Promise<void> {
  if (isProjectSectionCollapsed(sectionKey)) setProjectSectionCollapsed(sectionKey, false)
  await nextTick()
  const section = document.getElementById(projectSectionElementId(sectionKey))
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  section?.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  activeSection.value = sectionKey
}

function updateActiveSection(): void {
  const root = editorRoot.value
  if (!root || !profile.value) return
  const rootTop = root.getBoundingClientRect().top
  let nextActive: ProjectProfileSectionKey = projectProfileSections[0].key
  for (const section of projectProfileSections) {
    const element = document.getElementById(projectSectionElementId(section.key))
    if (element && element.getBoundingClientRect().top <= rootTop) nextActive = section.key
  }
  activeSection.value = nextActive
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
    reportAppError('OC-E3008', { path, error })
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
  scrollbar-gutter: stable;
  background: var(--oc-bg-base);
  color: var(--oc-fg-default);
}

.project-profile-editor__layout {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, var(--oc-content-width-md)) var(--oc-project-outline-width);
  width: 100%;
  max-width: calc(var(--oc-content-width-md) + var(--oc-project-outline-width) + var(--oc-space-6));
  min-height: 100%;
  margin-inline: auto;
  gap: var(--oc-space-6);
  padding: var(--oc-space-6) var(--oc-space-5);
}

.project-profile-editor__layout--single {
  grid-template-columns: minmax(0, var(--oc-content-width-md));
  max-width: var(--oc-content-width-md);
}

.project-profile-editor__content {
  min-width: 0;
  min-height: 100%;
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
}

.project-profile-editor__heading {
  min-width: 0;
}

.project-profile-editor h1 {
  margin: 0;
  font-weight: var(--font-weight-ui-title);
  letter-spacing: 0;
}

.project-profile-editor h1 {
  margin-bottom: var(--oc-space-1);
  font-size: var(--oc-text-lg);
}

.project-profile-editor__form {
  display: grid;
  gap: var(--oc-space-3);
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
}

.project-profile-editor__remote-resources {
  display: grid;
  gap: var(--oc-space-3);
}

.project-profile-editor__remote-mode {
  width: 100%;
  max-width: 240px;
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

.project-profile-editor__outline {
  position: sticky;
  top: var(--oc-space-6);
  display: grid;
  align-self: start;
  padding-block: var(--oc-space-2);
}

.project-profile-editor__outline::before {
  position: absolute;
  inset-block: calc(var(--oc-size-md) / 2);
  inset-inline-end: calc((var(--oc-icon-size-sm) - var(--oc-border-width)) / 2);
  width: var(--oc-border-width);
  background: var(--oc-border-muted);
  content: '';
}

.project-profile-editor__outline-item {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--oc-icon-size-sm);
  height: var(--oc-size-md);
  min-width: 0;
  align-items: center;
  gap: var(--oc-space-2);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--oc-fg-muted);
  font: inherit;
  text-align: end;
  cursor: pointer;
}

.project-profile-editor__outline-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--oc-duration-fast) var(--oc-ease);
}

.project-profile-editor__outline-node {
  box-sizing: border-box;
  width: var(--oc-icon-size-sm);
  height: var(--oc-icon-size-sm);
  border: var(--oc-border-width) solid var(--oc-border-strong);
  border-radius: var(--oc-radius-full);
  background: var(--oc-bg-base);
  transition:
    border-color var(--oc-duration-fast) var(--oc-ease),
    background-color var(--oc-duration-fast) var(--oc-ease),
    box-shadow var(--oc-duration-fast) var(--oc-ease);
}

.project-profile-editor__outline-item:hover,
.project-profile-editor__outline-item:focus-visible {
  color: var(--oc-fg-default);
}

.project-profile-editor__outline-item:hover .project-profile-editor__outline-node,
.project-profile-editor__outline-item:focus-visible .project-profile-editor__outline-node {
  border-color: var(--oc-fg-default);
}

.project-profile-editor__outline-item.is-active {
  color: var(--oc-fg-default);
}

.project-profile-editor__outline-item.is-active .project-profile-editor__outline-node {
  border-color: var(--oc-fg-default);
  background: var(--oc-fg-default);
  box-shadow: var(--oc-shadow-sm);
}

.project-profile-editor__outline-item:focus-visible {
  outline: none;
}

@media (prefers-reduced-motion: reduce) {
  .project-profile-editor__outline-label,
  .project-profile-editor__outline-node {
    transition: none;
  }
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
  .project-profile-editor__layout {
    padding-inline: var(--oc-space-3);
  }

  .project-profile-editor__dictionary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
