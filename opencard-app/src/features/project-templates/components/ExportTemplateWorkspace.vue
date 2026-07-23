<template>
  <section class="export-template" :aria-label="t('templateExport.title')">
    <section class="export-template__preview" :aria-label="t('templateExport.previewTitle')">
      <div class="export-template__media" aria-hidden="true">
        <Transition name="export-template-cover">
          <img v-if="activeCoverSrc" :key="activeCoverSrc" :src="activeCoverSrc" alt="" />
        </Transition>
        <div class="export-template__scrim" />
      </div>

      <div class="export-template__preview-content">
        <article class="export-template__details">
          <div class="export-template__details-heading">
            <OcIcon name="file.opencard" size="lg" />
            <div>
              <strong>{{ name.trim() || t('templateExport.unnamed') }}</strong>
              <p>{{ description.trim() || t('templateExport.previewDescription') }}</p>
            </div>
          </div>
          <dl>
            <div>
              <dt>{{ t('projectTemplates.fields.entry') }}</dt>
              <dd>
                <code v-for="entry in entries" :key="entry">{{ entry }}</code>
                <span v-if="entries.length === 0">{{ t('templateExport.selectEntry') }}</span>
              </dd>
            </div>
            <div>
              <dt>{{ t('projectTemplates.fields.covers') }}</dt>
              <dd><code>{{ covers.length }}</code></dd>
            </div>
            <div>
              <dt>{{ t('templateExport.excluded') }}</dt>
              <dd><code>{{ excludedPaths.length }}</code></dd>
            </div>
          </dl>
        </article>
      </div>

      <p v-if="isInspecting" class="export-template__overlay-status">
        {{ t('templateExport.status.inspecting') }}
      </p>
    </section>

    <form class="export-template__form" @submit.prevent="exportTemplate">
      <label class="export-template__field">
        <span>{{ t('projectTemplates.fields.templateName') }}</span>
        <OcFieldInput
          :value="name"
          full-width
          :maxlength="80"
          :aria-invalid="nameError || undefined"
          :disabled="isBusy"
          @input="name = ($event.target as HTMLInputElement).value"
        />
        <small v-if="nameError" class="is-error">{{ t('projectTemplates.errors.invalidTemplateName') }}</small>
      </label>

      <label class="export-template__field">
        <span>{{ t('projectTemplates.fields.description') }}</span>
        <OcFieldInput
          as="textarea"
          :value="description"
          full-width
          resize="vertical"
          rows="5"
          :maxlength="200"
          :disabled="isBusy"
          @input="description = ($event.target as HTMLTextAreaElement).value"
        />
        <small>{{ description.length }} / 200</small>
      </label>

      <div class="export-template__selection-summary">
        <p v-if="entries.length === 0" class="is-error">{{ t('templateExport.selectEntry') }}</p>
        <p v-else>{{ t('templateExport.selectionHint') }}</p>
      </div>

      <footer class="export-template__footer">
        <div class="export-template__feedback">
          <div v-if="exportedPath" class="export-template__result" role="status">
            <span>{{ t('templateExport.status.exported') }}</span>
            <code>{{ exportedPath }}</code>
          </div>
          <p v-if="errorMessage" class="export-template__error" role="alert">{{ errorMessage }}</p>
        </div>
        <OcButton type="submit" size="lg" variant="solid" icon="action.export" :disabled="!canExport">
          {{ isExporting ? t('templateExport.status.exporting') : t('templateExport.actions.export') }}
        </OcButton>
      </footer>
    </form>
  </section>
</template>

<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../../../components/base/OcButton.vue'
import OcFieldInput from '../../../components/base/OcFieldInput.vue'
import OcIcon from '../../../components/base/OcIcon.vue'
import {
  TemplateServiceError,
  validateTemplateDescription,
  validateTemplateName,
  type TemplateExportSelection,
  type TemplateProjectInspection,
} from '../model/projectTemplate'
import { useProjectTemplateStore } from '../store/projectTemplateStore'

const props = defineProps<{ projectPath: string }>()
const emit = defineEmits<{
  'update:busy': [busy: boolean]
  'selection-change': [selection: TemplateExportSelection]
}>()
const { t } = useI18n()
const store = useProjectTemplateStore()
const inspection = ref<TemplateProjectInspection | null>(null)
const name = ref('')
const description = ref('')
const entries = ref<string[]>([])
const covers = ref<string[]>([])
const excludedPaths = ref<string[]>([])
const activeCoverIndex = ref(0)
const isInspecting = ref(true)
const isExporting = ref(false)
const errorMessage = ref('')
const exportedPath = ref('')
let coverTimer: ReturnType<typeof setInterval> | null = null

const isBusy = computed(() => isInspecting.value || isExporting.value)
const nameError = computed(() => name.value.length > 0 && validateTemplateName(name.value) !== null)
const activeCoverSrc = computed(() => {
  const cover = covers.value[activeCoverIndex.value]
  return cover ? coverSource(cover) : ''
})
const canExport = computed(() => Boolean(
  inspection.value
  && entries.value.length > 0
  && !validateTemplateName(name.value)
  && !validateTemplateDescription(description.value)
  && !isBusy.value,
))

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function pathContains(parent: string, child: string): boolean {
  return child === parent || child.startsWith(`${parent}/`)
}

function coverSource(cover: string): string {
  const separator = props.projectPath.includes('\\') ? '\\' : '/'
  return convertFileSrc(`${props.projectPath.replace(/[\\/]+$/, '')}${separator}${cover.replace(/\//g, separator)}`)
}

function emitSelection(): void {
  emit('selection-change', {
    excludedPaths: [...excludedPaths.value],
    entries: [...entries.value],
    entryNames: { ...(inspection.value?.entryNames ?? {}) },
    covers: [...covers.value],
  })
}

function restartCoverTimer(): void {
  if (coverTimer) clearInterval(coverTimer)
  coverTimer = null
  activeCoverIndex.value = 0
  if (covers.value.length < 2) return
  coverTimer = setInterval(() => {
    activeCoverIndex.value = (activeCoverIndex.value + 1) % covers.value.length
  }, 4500)
}

onMounted(async () => {
  emit('update:busy', true)
  try {
    const result = await store.inspectProjectSource(props.projectPath)
    inspection.value = result
    name.value = result.suggestedName
    entries.value = result.entries.slice(0, 1)
    emitSelection()
  } catch (cause) {
    errorMessage.value = resolveError(cause)
  } finally {
    isInspecting.value = false
    emit('update:busy', false)
  }
})

onUnmounted(() => {
  if (coverTimer) clearInterval(coverTimer)
})

watch(covers, restartCoverTimer, { deep: true })

function togglePathIncluded(path: string): void {
  const normalized = normalizeRelativePath(path)
  if (!normalized || normalized === '.opencardproject') return
  const coveringExclusion = excludedPaths.value.find((excluded) => pathContains(excluded, normalized))
  if (coveringExclusion) {
    excludedPaths.value = excludedPaths.value.filter((excluded) => excluded !== coveringExclusion)
  } else {
    excludedPaths.value = excludedPaths.value
      .filter((excluded) => !pathContains(normalized, excluded))
      .concat(normalized)
    entries.value = entries.value.filter((entry) => !pathContains(normalized, entry))
    covers.value = covers.value.filter((cover) => !pathContains(normalized, cover))
  }
  emitSelection()
}

function toggleEntry(path: string): void {
  const normalized = normalizeRelativePath(path)
  if (!inspection.value?.entries.includes(normalized) || isPathExcluded(normalized)) return
  entries.value = entries.value.includes(normalized)
    ? entries.value.filter((entry) => entry !== normalized)
    : [...entries.value, normalized]
  emitSelection()
}

function toggleCover(path: string): void {
  const normalized = normalizeRelativePath(path)
  if (!inspection.value?.coverCandidates.includes(normalized) || isPathExcluded(normalized)) return
  covers.value = covers.value.includes(normalized)
    ? covers.value.filter((cover) => cover !== normalized)
    : [...covers.value, normalized]
  emitSelection()
}

function isPathExcluded(path: string): boolean {
  const normalized = normalizeRelativePath(path)
  return normalized === '.opencard-cache'
    || normalized.startsWith('.opencard-cache/')
    || excludedPaths.value.some((excluded) => pathContains(excluded, normalized))
}

defineExpose({ togglePathIncluded, toggleEntry, toggleCover })

function safeFileName(value: string): string {
  return value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '') || 'template'
}

async function exportTemplate(): Promise<void> {
  if (!canExport.value || !inspection.value) return
  errorMessage.value = ''
  exportedPath.value = ''
  try {
    const outputPath = await store.pickTemplateExportPath(
      `${safeFileName(name.value)}.opencardtemplate`,
      t('templateExport.dialogs.chooseOutput'),
    )
    if (!outputPath) return
    isExporting.value = true
    emit('update:busy', true)
    exportedPath.value = await store.exportProjectTemplate({
      sourcePath: props.projectPath,
      outputPath,
      name: name.value,
      description: description.value,
      entry: entries.value[0],
      entries: entries.value,
      covers: covers.value,
      excludedPaths: excludedPaths.value,
    })
  } catch (cause) {
    errorMessage.value = resolveError(cause)
  } finally {
    isExporting.value = false
    emit('update:busy', false)
  }
}

function resolveError(cause: unknown): string {
  if (!(cause instanceof TemplateServiceError)) return t('projectTemplates.errors.unknown')
  const keys: Partial<Record<TemplateServiceError['code'], string>> = {
    'invalid-template-name': 'invalidTemplateName',
    'description-too-long': 'descriptionTooLong',
    'source-not-project': 'sourceNotProject',
    'source-has-symlink': 'sourceHasSymlink',
    'entry-not-found': 'entryNotFound',
    'cover-not-found': 'coverNotFound',
    'archive-failed': 'archiveFailed',
  }
  return t(`projectTemplates.errors.${keys[cause.code] ?? 'unknown'}`)
}
</script>

<style scoped>
.export-template {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 420px);
  container-type: inline-size;
  overflow: hidden;
  background: var(--oc-bg-base);
  color: var(--oc-fg-default);
}

.export-template__preview {
  position: relative;
  isolation: isolate;
  min-width: 0;
  min-height: 0;
  padding: var(--oc-space-5);
  overflow: hidden;
  border-right: 1px solid var(--oc-border-muted);
  background: var(--oc-bg-base);
}

.export-template__media,
.export-template__media > img,
.export-template__scrim {
  position: absolute;
  inset: 0;
}

.export-template__media {
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.export-template__media > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: .38;
}

.export-template__scrim {
  background: linear-gradient(
    180deg,
    var(--oc-bg-base),
    color-mix(in srgb, var(--oc-bg-base) 88%, transparent) 42%,
    color-mix(in srgb, var(--oc-bg-base) 46%, transparent)
  );
}

.export-template__preview-content {
  position: relative;
  z-index: 1;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
}

.export-template__details {
  margin-top: var(--oc-space-4);
  padding: var(--oc-space-4) 0;
  display: grid;
  gap: var(--oc-space-4);
  border-bottom: 1px solid var(--oc-border-muted);
}

.export-template__details-heading {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: var(--oc-space-3);
}

.export-template__details-heading > div {
  min-width: 0;
  display: grid;
  gap: var(--oc-space-1);
}

.export-template__details-heading strong {
  overflow-wrap: anywhere;
  font-size: var(--oc-text-lg);
}

.export-template__details-heading p {
  margin: 0;
  color: var(--oc-fg-subtle);
  font-size: var(--oc-text-sm);
  line-height: 1.5;
}

.export-template__details dl,
.export-template__details dd {
  margin: 0;
}

.export-template__details dl {
  display: grid;
  gap: var(--oc-space-3);
}

.export-template__details dl > div,
.export-template__details dd {
  display: grid;
  gap: var(--oc-space-1);
}

.export-template__details dt {
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
}

.export-template__details code,
.export-template__details dd > span {
  overflow-wrap: anywhere;
  color: var(--oc-fg-default);
  font-family: var(--oc-font-mono);
  font-size: var(--oc-text-sm);
}

.export-template__overlay-status {
  position: absolute;
  right: var(--oc-space-4);
  bottom: var(--oc-space-4);
  z-index: 2;
  margin: 0;
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
}

.export-template__form {
  min-width: 0;
  min-height: 0;
  padding: var(--oc-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--oc-space-4);
  overflow-y: auto;
  background: var(--oc-bg-surface);
}

.export-template__result span {
  color: var(--oc-fg-subtle);
  font-size: var(--oc-text-sm);
}

.export-template__field {
  display: grid;
  gap: var(--oc-space-2);
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
}

.export-template__field > span {
  color: var(--oc-fg-default);
  font-weight: 600;
}

.export-template__field small {
  justify-self: end;
  color: var(--oc-fg-subtle);
}

.export-template__selection-summary p {
  margin: 0;
  color: var(--oc-fg-subtle);
  font-size: var(--oc-text-sm);
  line-height: 1.5;
}

.export-template__footer {
  margin-top: auto;
  padding-top: var(--oc-space-4);
  display: grid;
  gap: var(--oc-space-4);
  border-top: 1px solid var(--oc-border-muted);
}

.export-template__feedback {
  min-width: 0;
}

.export-template__result {
  display: grid;
  gap: var(--oc-space-1);
}

.export-template__result code {
  overflow-wrap: anywhere;
  color: var(--oc-fg-accent);
  font-family: var(--oc-font-mono);
  font-size: var(--oc-text-sm);
}

.export-template__error,
.is-error {
  margin: 0;
  color: var(--oc-fg-danger) !important;
  font-size: var(--oc-text-sm);
}

.export-template__media > img.export-template-cover-enter-active,
.export-template__media > img.export-template-cover-leave-active {
  transition: opacity 360ms ease;
}

.export-template__media > img.export-template-cover-enter-from,
.export-template__media > img.export-template-cover-leave-to {
  opacity: 0;
}

@container (max-width: 800px) {
  .export-template {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .export-template__preview {
    min-height: 420px;
    border-right: 0;
    border-bottom: 1px solid var(--oc-border-muted);
  }

  .export-template__form {
    overflow: visible;
  }
}

@container (max-width: 480px) {
  .export-template__preview {
    min-height: 360px;
  }

  .export-template__preview,
  .export-template__form {
    padding: var(--oc-space-4);
  }
}
</style>
