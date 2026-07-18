<template>
  <section class="export-template" :aria-label="t('templateExport.title')">
    <div class="export-template__body">
      <section class="export-template__project">
        <div class="export-template__cover" aria-hidden="true">
          <img v-if="coverPreview" :src="coverPreview" alt="" />
          <div />
        </div>
        <div class="export-template__project-content">
          <header>
            <h2>{{ t('templateExport.projectTitle') }}</h2>
            <code>{{ projectPath }}</code>
          </header>

          <p v-if="isInspecting" class="export-template__status">{{ t('templateExport.status.inspecting') }}</p>
          <template v-else-if="inspection">
            <label>
              <span>{{ t('projectTemplates.fields.entry') }}</span>
              <OcFieldInput
                as="select"
                :value="entry"
                full-width
                :disabled="isBusy"
                @change="entry = ($event.target as HTMLSelectElement).value"
              >
                <option v-for="candidate in inspection.entries" :key="candidate" :value="candidate">
                  {{ candidate }}
                </option>
              </OcFieldInput>
            </label>

            <fieldset>
              <legend>{{ t('projectTemplates.fields.covers') }}</legend>
              <p v-if="inspection.coverCandidates.length === 0">
                {{ t('projectTemplates.status.noCoverCandidates') }}
              </p>
              <label v-for="cover in inspection.coverCandidates" :key="cover">
                <input
                  type="checkbox"
                  :checked="covers.includes(cover)"
                  :disabled="isBusy"
                  @change="toggleCover(cover)"
                />
                <span>{{ cover }}</span>
              </label>
            </fieldset>
          </template>
        </div>
      </section>

      <form class="export-template__form" @submit.prevent="exportTemplate">
        <header>
          <span>{{ t('templateExport.formTitle') }}</span>
          <strong>{{ name.trim() || t('templateExport.unnamed') }}</strong>
        </header>

        <label>
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

        <label>
          <span>{{ t('projectTemplates.fields.description') }}</span>
          <OcFieldInput
            as="textarea"
            :value="description"
            full-width
            resize="vertical"
            rows="4"
            :maxlength="200"
            :disabled="isBusy"
            @input="description = ($event.target as HTMLTextAreaElement).value"
          />
          <small>{{ description.length }} / 200</small>
        </label>

        <div class="export-template__format">
          <span>{{ t('templateExport.format') }}</span>
          <code>.octemplete</code>
          <p>{{ t('templateExport.formatHint') }}</p>
        </div>

        <div v-if="exportedPath" class="export-template__result" role="status">
          <span>{{ t('templateExport.status.exported') }}</span>
          <code>{{ exportedPath }}</code>
        </div>
        <p v-if="errorMessage" class="export-template__error" role="alert">{{ errorMessage }}</p>

        <div class="export-template__actions">
          <OcButton type="submit" size="lg" variant="solid" icon="action.export" :disabled="!canExport">
            {{ isExporting ? t('templateExport.status.exporting') : t('templateExport.actions.export') }}
          </OcButton>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { OcButton, OcFieldInput } from '../../../components/base'
import {
  TemplateServiceError,
  validateTemplateDescription,
  validateTemplateName,
  type TemplateProjectInspection,
} from '../model/projectTemplate'
import { useProjectTemplateStore } from '../store/projectTemplateStore'

const props = defineProps<{ projectPath: string }>()
const emit = defineEmits<{ 'update:busy': [busy: boolean] }>()
const { t } = useI18n()
const store = useProjectTemplateStore()
const inspection = ref<TemplateProjectInspection | null>(null)
const name = ref('')
const description = ref('')
const entry = ref('')
const covers = ref<string[]>([])
const isInspecting = ref(true)
const isExporting = ref(false)
const errorMessage = ref('')
const exportedPath = ref('')

const isBusy = computed(() => isInspecting.value || isExporting.value)
const nameError = computed(() => name.value.length > 0 && validateTemplateName(name.value) !== null)
const coverPreview = computed(() => {
  const cover = covers.value[0]
  if (!cover) return ''
  const separator = props.projectPath.includes('\\') ? '\\' : '/'
  return convertFileSrc(`${props.projectPath.replace(/[\\/]+$/, '')}${separator}${cover.replace(/\//g, separator)}`)
})
const canExport = computed(() => Boolean(
  inspection.value
  && entry.value
  && !validateTemplateName(name.value)
  && !validateTemplateDescription(description.value)
  && !isBusy.value,
))

onMounted(async () => {
  emit('update:busy', true)
  try {
    const result = await store.inspectProjectSource(props.projectPath)
    inspection.value = result
    name.value = result.suggestedName
    entry.value = result.entries[0] ?? ''
  } catch (cause) {
    errorMessage.value = resolveError(cause)
  } finally {
    isInspecting.value = false
    emit('update:busy', false)
  }
})

function toggleCover(cover: string): void {
  covers.value = covers.value.includes(cover)
    ? covers.value.filter((item) => item !== cover)
    : [...covers.value, cover]
}

function safeFileName(value: string): string {
  return value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '') || 'template'
}

async function exportTemplate(): Promise<void> {
  if (!canExport.value || !inspection.value) return
  errorMessage.value = ''
  exportedPath.value = ''
  try {
    const outputPath = await store.pickTemplateExportPath(
      `${safeFileName(name.value)}.octemplete`,
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
      entry: entry.value,
      covers: covers.value,
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
.export-template { width: 100%; height: 100%; min-width: 0; min-height: 0; container-type: inline-size; background: var(--oc-bg-base); color: var(--oc-fg-default); }
.export-template__body { height: 100%; display: grid; grid-template-columns: minmax(320px, 1fr) minmax(340px, 440px); overflow: hidden; }
.export-template__project { position: relative; isolation: isolate; min-width: 0; overflow: hidden; border-right: 1px solid var(--oc-border-muted); }
.export-template__cover { position: absolute; z-index: 0; inset: 0; pointer-events: none; }
.export-template__cover img { width: 100%; height: 100%; object-fit: cover; opacity: .36; }
.export-template__cover div { position: absolute; inset: 0; background: linear-gradient(180deg, var(--oc-bg-base), color-mix(in srgb, var(--oc-bg-base) 72%, transparent)); }
.export-template__project-content { position: relative; z-index: 1; height: 100%; padding: var(--oc-space-5); display: grid; align-content: start; gap: var(--oc-space-5); overflow-y: auto; }
.export-template header { display: grid; gap: var(--oc-space-1); padding-bottom: var(--oc-space-3); border-bottom: 1px solid var(--oc-border-muted); }
.export-template h2 { margin: 0; font-size: var(--oc-text-lg); }
.export-template code { overflow-wrap: anywhere; font-family: var(--oc-font-mono); font-size: var(--oc-text-sm); }
.export-template label { display: grid; gap: var(--oc-space-1); color: var(--oc-fg-muted); font-size: var(--oc-text-sm); }
.export-template fieldset { max-height: 260px; margin: 0; padding: var(--oc-space-3) 0; display: grid; gap: var(--oc-space-2); overflow-y: auto; border: 0; border-block: 1px solid var(--oc-border-muted); }
.export-template fieldset label { grid-template-columns: auto minmax(0, 1fr); }
.export-template fieldset p { margin: 0; color: var(--oc-fg-subtle); }
.export-template__form { min-width: 0; padding: var(--oc-space-5); display: flex; flex-direction: column; gap: var(--oc-space-4); overflow-y: auto; background: var(--oc-bg-surface); }
.export-template__form header span, .export-template__format > span, .export-template__result > span { color: var(--oc-fg-subtle); font-size: var(--oc-text-sm); }
.export-template__form label small { justify-self: end; color: var(--oc-fg-subtle); }
.export-template__format, .export-template__result { display: grid; gap: var(--oc-space-1); }
.export-template__format code { width: fit-content; padding: var(--oc-space-2); border-radius: var(--oc-radius-sm); background: var(--oc-bg-input); color: var(--oc-fg-accent); }
.export-template__format p { margin: 0; color: var(--oc-fg-subtle); font-size: var(--oc-text-sm); line-height: 1.5; }
.export-template__result { padding: var(--oc-space-3); border-left: 2px solid var(--oc-accent); background: var(--oc-bg-accent-subtle); }
.export-template__actions { margin-top: auto; display: flex; justify-content: flex-end; }
.export-template__error, .is-error { margin: 0; color: var(--oc-fg-danger); font-size: var(--oc-text-sm); }
.export-template__status { color: var(--oc-fg-muted); }
@container (max-width: 860px) { .export-template__body { grid-template-columns: 1fr; overflow-y: auto; } .export-template__project-content, .export-template__form { height: auto; overflow: visible; } .export-template__project { border-right: 0; border-bottom: 1px solid var(--oc-border-muted); } }
@container (max-width: 520px) { .export-template__project-content, .export-template__form { padding: var(--oc-space-4); } }
</style>
