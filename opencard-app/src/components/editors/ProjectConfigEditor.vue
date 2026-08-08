<template>
  <section ref="editorRoot" class="project-profile-editor" :aria-label="t('projectConfig.title')"
    @keydown.ctrl.s.prevent="save">
    <div class="project-profile-editor__layout" :class="{
      'project-profile-editor__layout--single': !profile,
      'is-comparison': isObserveOnly,
    }">
      <main class="project-profile-editor__content">
        <header class="project-profile-editor__header">
          <OcIcon name="file.opencard-project" size="lg" />
          <div class="project-profile-editor__heading">
            <h1>{{ t('projectConfig.title') }}</h1>
            <OcText tone="muted" size="sm">{{ t('projectConfig.description') }}</OcText>
          </div>
        </header>

      <template v-if="profile">
        <ProjectConfigSection section-id="project-profile-section-information"
          content-indent="single"
          :heading="t('projectConfig.sections.information')"
          :expand-label="t('projectConfig.sections.expand', { section: t('projectConfig.sections.information') })"
          :collapse-label="t('projectConfig.sections.collapse', { section: t('projectConfig.sections.information') })"
          :collapsed="isProjectSectionCollapsed('information')"
          @toggle="toggleProjectSection('information')">
          <div v-if="isObserveOnly && comparisonProfile" class="project-profile-editor__form">
            <ProjectConfigComparisonField :label="t('projectConfig.fields.name')"
              :historical-value="comparisonProfile.name ?? ''" :current-value="profile.name ?? ''"
              :paired="true" :changed="comparisonProfile.name !== profile.name" />
            <ProjectConfigComparisonField :label="t('projectConfig.fields.description')" multiline
              :historical-value="comparisonProfile.description ?? ''" :current-value="profile.description ?? ''"
              :paired="true" :changed="comparisonProfile.description !== profile.description" />
            <ProjectConfigComparisonField :label="t('projectConfig.fields.version')" mono
              :historical-value="comparisonProfile.version ?? ''" :current-value="profile.version ?? ''"
              :paired="true" :changed="false" />
          </div>
          <div v-else class="project-profile-editor__form">
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
              <OcFieldInput full-width :value="props.projectVersion ?? profile.version ?? ''"
                :disabled="props.projectVersionManaged" @input="updateProfileField('version', $event)" />
            </label>
          </div>
        </ProjectConfigSection>

        <ProjectConfigSection section-id="project-profile-section-remote-resources"
          content-indent="single"
          :heading="t('projectConfig.remoteResources.title')"
          :description="t('projectConfig.remoteResources.description')"
          :expand-label="t('projectConfig.sections.expand', { section: t('projectConfig.remoteResources.title') })"
          :collapse-label="t('projectConfig.sections.collapse', { section: t('projectConfig.remoteResources.title') })"
          :collapsed="isProjectSectionCollapsed('remote-resources')"
          @toggle="toggleProjectSection('remote-resources')">
          <div v-if="isObserveOnly && comparisonProfile" class="project-profile-editor__remote-resources">
            <ProjectConfigComparisonField :label="t('projectConfig.remoteResources.title')"
              :historical-value="remoteResourceModeLabel(comparisonProfile)"
              :current-value="remoteResourceModeLabel(profile)" :paired="true"
              :changed="remoteResourceModeLabel(comparisonProfile) !== remoteResourceModeLabel(profile)" />
            <ProjectConfigComparisonField :label="t('projectConfig.remoteResources.allowedHosts')" multiline mono
              :historical-value="remoteResourceHosts(comparisonProfile)"
              :current-value="remoteResourceHosts(profile)" :paired="true"
              :changed="remoteResourceHosts(comparisonProfile) !== remoteResourceHosts(profile)" />
          </div>
          <div v-else class="project-profile-editor__remote-resources">
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

        <ProjectConfigSection section-id="project-profile-section-export"
          content-indent="single"
          :heading="t('projectConfig.export.title')" :description="t('projectConfig.export.description')"
          :expand-label="t('projectConfig.sections.expand', { section: t('projectConfig.export.title') })"
          :collapse-label="t('projectConfig.sections.collapse', { section: t('projectConfig.export.title') })"
          :collapsed="isProjectSectionCollapsed('export')" @toggle="toggleProjectSection('export')">
          <div v-if="isObserveOnly && comparisonProfile" class="project-profile-editor__comparison-pair">
            <section class="project-profile-editor__comparison-side is-historical">
              <strong>A · {{ t('versioning.diff.historical') }}</strong>
              <ProjectExportTaskEditor :model-value="comparisonProfile.exportTask ?? createDefaultProjectExportTask()"
                :documents="[]" busy />
            </section>
            <section class="project-profile-editor__comparison-side is-current">
              <strong>B · {{ t('versioning.diff.current') }}</strong>
              <ProjectExportTaskEditor :model-value="defaultExportTask" :documents="[]" busy />
            </section>
          </div>
          <ProjectExportTaskEditor v-else :model-value="defaultExportTask" :documents="exportDocumentCandidates"
            @update:model-value="updateDefaultExportTask" />
        </ProjectConfigSection>

        <ProjectConfigSection section-id="project-profile-section-dictionary"
          content-indent="single"
          :heading="t('projectConfig.dictionary.title')" :description="t('projectConfig.dictionary.description')"
          :expand-label="t('projectConfig.sections.expand', { section: t('projectConfig.dictionary.title') })"
          :collapse-label="t('projectConfig.sections.collapse', { section: t('projectConfig.dictionary.title') })"
          :collapsed="isProjectSectionCollapsed('dictionary')" @toggle="toggleProjectSection('dictionary')">
          <div v-if="isObserveOnly" class="project-profile-editor__linked-file-comparison">
            <ProjectConfigComparisonField :label="t('projectConfig.dictionary.title')"
              :historical-value="linkedFileState(comparisonLinkedFiles.dictionary)"
              :current-value="linkedFileState(currentLinkedFiles.dictionary)" :paired="true"
              :changed="comparisonLinkedFiles.dictionary !== currentLinkedFiles.dictionary" />
          </div>
          <div v-else class="project-profile-editor__linked-file">
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

        <ProjectConfigSection section-id="project-profile-section-fonts" content-indent="single"
          :heading="t('projectConfig.fonts.title')" :description="t('projectConfig.fonts.description')"
          :expand-label="t('projectConfig.sections.expand', { section: t('projectConfig.fonts.title') })"
          :collapse-label="t('projectConfig.sections.collapse', { section: t('projectConfig.fonts.title') })"
          :collapsed="isProjectSectionCollapsed('fonts')" @toggle="toggleProjectSection('fonts')">
          <div v-if="isObserveOnly" class="project-profile-editor__linked-file-comparison">
            <ProjectConfigComparisonField :label="t('projectConfig.fonts.title')"
              :historical-value="linkedFileState(comparisonLinkedFiles.fonts)"
              :current-value="linkedFileState(currentLinkedFiles.fonts)" :paired="true"
              :changed="comparisonLinkedFiles.fonts !== currentLinkedFiles.fonts" />
          </div>
          <div v-else class="project-profile-editor__linked-file">
            <OcText tone="muted" size="sm">{{ fontRegistryExists
              ? t('projectConfig.fonts.registryAvailable')
              : t('projectConfig.fonts.registryMissing') }}</OcText>
            <OcButton data-linked-file="fonts" :icon="fontRegistryExists ? 'nav.arrow-right' : 'action.add'"
              variant="soft" @click="openOrCreateFontRegistry">
              {{ fontRegistryExists ? t('projectConfig.fonts.openRegistry') : t('projectConfig.fonts.createRegistry') }}
            </OcButton>
          </div>
        </ProjectConfigSection>

        <ProjectConfigSection section-id="project-profile-section-icons" content-indent="single"
          :heading="t('projectConfig.icons.title')" :description="t('projectConfig.icons.description')"
          :expand-label="t('projectConfig.sections.expand', { section: t('projectConfig.icons.title') })"
          :collapse-label="t('projectConfig.sections.collapse', { section: t('projectConfig.icons.title') })"
          :collapsed="isProjectSectionCollapsed('icons')" @toggle="toggleProjectSection('icons')">
          <div v-if="isObserveOnly" class="project-profile-editor__linked-file-comparison">
            <ProjectConfigComparisonField :label="t('projectConfig.icons.title')"
              :historical-value="linkedFileState(comparisonLinkedFiles.icons)"
              :current-value="linkedFileState(currentLinkedFiles.icons)" :paired="true"
              :changed="comparisonLinkedFiles.icons !== currentLinkedFiles.icons" />
          </div>
          <div v-else class="project-profile-editor__linked-file">
            <OcText tone="muted" size="sm">{{ iconRegistryExists
              ? t('projectConfig.icons.registryAvailable')
              : t('projectConfig.icons.registryMissing') }}</OcText>
            <OcButton data-linked-file="icons" :icon="iconRegistryExists ? 'nav.arrow-right' : 'action.add'"
              variant="soft" @click="openOrCreateIconRegistry">
              {{ iconRegistryExists ? t('projectConfig.icons.openRegistry') : t('projectConfig.icons.createRegistry') }}
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
            :read-only="isObserveOnly"
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { reportAppError } from '../../features/logging/appErrorCatalog'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import type { EditorNavigationResult, SessionNavigationToken } from '../../features/editor-runtime/model/editorIssue'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import { useAppSettingsStore } from '../../features/settings/store/appSettingsStore'
import type { ProjectWorkspaceState } from '../../features/settings/model/appSettings'
import {
  normalizeProjectAllowedHost,
  parseProjectMetadataText,
  PROJECT_PROFILE_FILE_NAME,
  serializeProjectMetadata,
  type ProjectProfile,
  type ProjectExportTask,
} from '../../features/workspace/model/projectMetadata'
import { createDefaultProjectExportTask } from '../../features/exporting/exportTask'
import { parseCardDocument } from '../../entities/card/storage'
import { PROJECT_DICTIONARY_FILE_NAME } from '../../features/workspace/model/projectDictionary'
import {
  PROJECT_FONT_REGISTRY_FILE_NAME,
  serializeProjectFontRegistry,
} from '../../features/workspace/model/projectFontRegistry'
import { PROJECT_ICON_REGISTRY_FILE_NAME } from '../../features/workspace/model/projectIconRegistry'
import { resolveFileType } from '../../features/workspace/model/fileTypes'
import OcOptionGroup, { type OcOption } from '../standard/OcOptionGroup.vue'
import MonacoEditor from './MonacoEditor.vue'
import ProjectConfigSection from './ProjectConfigSection.vue'
import ProjectExportTaskEditor, { type ExportDocumentCandidate } from './ProjectExportTaskEditor.vue'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import ProjectConfigComparisonField from './ProjectConfigComparisonField.vue'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const projectStore = useProjectStore()
const settingsStore = useAppSettingsStore()
const profile = ref<ProjectProfile | null>(null)
const comparisonProfile = ref<ProjectProfile | null>(null)
const dictionaryExists = ref(false)
const fontRegistryExists = ref(false)
const iconRegistryExists = ref(false)
const remoteHostDrafts = ref<string[]>([])
const exportDocumentCandidates = ref<ExportDocumentCandidate[]>([])
const editorRoot = ref<HTMLElement | null>(null)
const activeSection = ref<ProjectProfileSectionKey>('information')
const comparisonCollapsedSections = ref(new Set<ProjectProfileSectionKey>())
const currentLinkedFiles = ref({ dictionary: false, fonts: false, icons: false })
const comparisonLinkedFiles = ref({ dictionary: false, fonts: false, icons: false })
let sectionObserver: IntersectionObserver | null = null

type ProjectProfileSectionKey = 'information' | 'remote-resources' | 'export' | 'dictionary' | 'fonts' | 'icons'

const projectProfileSections = [
  { key: 'information', labelKey: 'projectConfig.sections.information' },
  { key: 'remote-resources', labelKey: 'projectConfig.remoteResources.title' },
  { key: 'export', labelKey: 'projectConfig.export.title' },
  { key: 'dictionary', labelKey: 'projectConfig.dictionary.title' },
  { key: 'fonts', labelKey: 'projectConfig.fonts.title' },
  { key: 'icons', labelKey: 'projectConfig.icons.title' },
] as const satisfies readonly { key: ProjectProfileSectionKey, labelKey: string }[]

const themeId = computed(() => props.themeId ?? 'dark')
const themeOverrides = computed(() => props.themeOverrides ?? {})
const isObserveOnly = computed(() => props.access === 'observe-only')
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
const defaultExportTask = computed(() => profile.value?.exportTask ?? createDefaultProjectExportTask())
watch(() => props.modelValue, content => {
  const nextProfile = parseProjectMetadataText(content ?? '')
  profile.value = nextProfile
  remoteHostDrafts.value = nextProfile?.remoteResources?.mode === 'allowlist'
    ? [...nextProfile.remoteResources.allowedHosts]
    : []
  void nextTick(connectSectionObserver)
}, { immediate: true })
watch(() => props.comparisonContent, content => {
  comparisonProfile.value = content === undefined ? null : parseProjectMetadataText(content)
}, { immediate: true })
watch(
  () => [props.resourceRootPath, props.comparisonResourceRootPath, isObserveOnly.value] as const,
  () => void refreshComparisonLinkedFiles(),
  { immediate: true },
)

watch(() => projectStore.indexedEntries.value, () => {
  const fileTypeIds = new Set(projectStore.indexedEntries.value.flatMap(entry => {
    if (entry.isDirectory) return []
    return [resolveFileType(
      projectStore.resolveProjectPath(entry.name),
      projectStore.projectPath.value,
    ).id]
  }))
  dictionaryExists.value = fileTypeIds.has('opencard-dictionary')
  fontRegistryExists.value = fileTypeIds.has('opencard-font-registry')
  iconRegistryExists.value = fileTypeIds.has('opencard-icon-registry')
}, { immediate: true })

watch(() => projectStore.indexedEntries.value, async entries => {
  const paths = entries
    .filter(entry => !entry.isDirectory && entry.name.toLocaleLowerCase().endsWith('.ocdocument'))
    .map(entry => entry.name.replace(/\\/g, '/'))
  exportDocumentCandidates.value = await Promise.all(paths.map(async path => {
    try {
      const document = parseCardDocument(JSON.parse(await projectStore.readFile(path)) as unknown)
      const width = Number(document.width)
      const height = Number(document.height)
      return {
        path,
        ...(Number.isFinite(width) && Number.isFinite(height) ? { width, height } : {}),
      }
    } catch {
      return { path }
    }
  }))
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
  if (isObserveOnly.value) return
  try {
    const serialized = serializeProjectMetadata(next)
    profile.value = next
    emit('update:modelValue', serialized)
  } catch (error) {
    reportAppError('OC-E3006', error)
  }
}

function updateDefaultExportTask(task: ProjectExportTask): void {
  if (!profile.value) return
  updateProfile({ ...profile.value, exportTask: task })
}

function isProjectSectionCollapsed(sectionKey: ProjectProfileSectionKey): boolean {
  if (isObserveOnly.value) return comparisonCollapsedSections.value.has(sectionKey)
  return projectWorkspaceState.value?.projectProfile?.collapsedSections.includes(sectionKey) ?? false
}

function setProjectSectionCollapsed(sectionKey: ProjectProfileSectionKey, collapsed: boolean): void {
  if (isObserveOnly.value) {
    const next = new Set(comparisonCollapsedSections.value)
    if (collapsed) next.add(sectionKey)
    else next.delete(sectionKey)
    comparisonCollapsedSections.value = next
    return
  }
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
  const section = editorRoot.value?.querySelector<HTMLElement>(`#${projectSectionElementId(sectionKey)}`)
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  section?.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  activeSection.value = sectionKey
}

async function navigate(token: SessionNavigationToken): Promise<EditorNavigationResult> {
  if (!token || typeof token !== 'object' || Array.isArray(token)) return 'invalid-token'
  const candidate = token as Record<string, unknown>
  if (candidate.kind !== 'project-section' || typeof candidate.section !== 'string') return 'invalid-token'
  if (!projectProfileSections.some(section => section.key === candidate.section)) return 'not-found'
  await navigateToProjectSection(candidate.section as ProjectProfileSectionKey)
  return 'success'
}

function connectSectionObserver(): void {
  sectionObserver?.disconnect()
  sectionObserver = null
  const root = editorRoot.value
  if (!root || !profile.value || typeof IntersectionObserver === 'undefined') return
  sectionObserver = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0]
    const sectionKey = visible?.target.id.replace('project-profile-section-', '') as ProjectProfileSectionKey | undefined
    if (sectionKey && activeSection.value !== sectionKey) activeSection.value = sectionKey
  }, {
    root,
    rootMargin: '0px 0px -70% 0px',
    threshold: 0,
  })
  for (const section of projectProfileSections) {
    const element = root.querySelector<HTMLElement>(`#${projectSectionElementId(section.key)}`)
    if (element) sectionObserver.observe(element)
  }
}

onMounted(connectSectionObserver)
onBeforeUnmount(() => {
  sectionObserver?.disconnect()
})

function updateRawSource(content: string) {
  if (isObserveOnly.value) return
  emit('update:modelValue', content)
}

async function openOrCreateDictionary() {
  if (isObserveOnly.value) return
  await openOrCreateLinkedFile(
    PROJECT_DICTIONARY_FILE_NAME,
    dictionaryExists.value,
    () => { dictionaryExists.value = true },
    'OC-E3008',
  )
}

async function openOrCreateFontRegistry() {
  if (isObserveOnly.value) return
  const path = projectStore.resolveProjectPath(PROJECT_FONT_REGISTRY_FILE_NAME)
  if (fontRegistryExists.value) emit('open-file', path)
  else {
    await projectStore.createFile(PROJECT_FONT_REGISTRY_FILE_NAME, serializeProjectFontRegistry({}))
    fontRegistryExists.value = true
    emit('open-file', path)
  }
}

async function openOrCreateIconRegistry() {
  if (isObserveOnly.value) return
  await openOrCreateLinkedFile(
    PROJECT_ICON_REGISTRY_FILE_NAME,
    iconRegistryExists.value,
    () => { iconRegistryExists.value = true },
    'OC-E3010',
  )
}

async function openOrCreateLinkedFile(
  fileName: string,
  exists: boolean,
  markExists: () => void,
  errorCode: 'OC-E3008' | 'OC-E3009' | 'OC-E3010',
): Promise<void> {
  const path = projectStore.resolveProjectPath(fileName)
  try {
    if (!exists) {
      await projectStore.createFile(fileName, '{}')
      markExists()
    }
    emit('open-file', path)
  } catch (error) {
    reportAppError(errorCode, { path, error })
  }
}

function save() {
  if (profile.value && !isObserveOnly.value && !hasInvalidRemoteHostDraft.value) emit('save')
}

function remoteResourceModeLabel(value: ProjectProfile): string {
  const mode = value.remoteResources?.mode ?? 'deny'
  if (mode === 'allowlist') return t('projectConfig.remoteResources.allowlist')
  if (mode === 'allow-all') return t('projectConfig.remoteResources.allowAll')
  return t('projectConfig.remoteResources.deny')
}

function remoteResourceHosts(value: ProjectProfile): string {
  return value.remoteResources?.mode === 'allowlist'
    ? value.remoteResources.allowedHosts.join('\n')
    : ''
}

function linkedFileState(exists: boolean): string {
  return exists ? t('versioning.diff.available') : t('versioning.diff.missing')
}

function rootFilePath(root: string, fileName: string): string {
  const separator = root.includes('\\') ? '\\' : '/'
  return `${root.replace(/[\\/]+$/, '')}${separator}${fileName}`
}

async function linkedFilesAt(root: string | null | undefined): Promise<typeof currentLinkedFiles.value> {
  if (!root) return { dictionary: false, fonts: false, icons: false }
  const [dictionary, fonts, icons] = await Promise.all([
    fileSystemService.fileExists(rootFilePath(root, PROJECT_DICTIONARY_FILE_NAME)),
    fileSystemService.fileExists(rootFilePath(root, PROJECT_FONT_REGISTRY_FILE_NAME)),
    fileSystemService.fileExists(rootFilePath(root, PROJECT_ICON_REGISTRY_FILE_NAME)),
  ])
  return { dictionary, fonts, icons }
}

async function refreshComparisonLinkedFiles(): Promise<void> {
  if (!isObserveOnly.value) return
  const [historical, current] = await Promise.all([
    linkedFilesAt(props.comparisonResourceRootPath),
    linkedFilesAt(props.resourceRootPath),
  ])
  comparisonLinkedFiles.value = historical
  currentLinkedFiles.value = current
}

defineExpose({ save, navigate })
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
  padding: var(--oc-space-5);
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
.project-profile-editor__linked-file,
.project-profile-editor__diagnostic {
  display: flex;
  align-items: center;
  gap: var(--oc-space-3);
}

.project-profile-editor__header {
  padding-bottom: var(--oc-space-5);
  border-bottom: var(--oc-border-width) solid var(--oc-border-muted);
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

.project-profile-editor__linked-file {
  justify-content: space-between;
}

.project-profile-editor__linked-file-comparison {
  min-width: 0;
}

.project-profile-editor__comparison-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--oc-space-3);
}

.project-profile-editor__comparison-side {
  display: grid;
  gap: var(--oc-space-3);
  min-width: 0;
  padding: var(--oc-space-2);
}

.project-profile-editor__comparison-side > strong {
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
}

.project-profile-editor__comparison-side.is-historical {
  border-left: var(--oc-border-width) solid var(--oc-fg-danger);
}

.project-profile-editor__comparison-side.is-current {
  border-left: var(--oc-border-width) solid var(--oc-icon-success);
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

.project-profile-editor__linked-file > div {
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

  .project-profile-editor__linked-file {
    align-items: flex-start;
    flex-direction: column;
  }

  .project-profile-editor__comparison-pair {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
