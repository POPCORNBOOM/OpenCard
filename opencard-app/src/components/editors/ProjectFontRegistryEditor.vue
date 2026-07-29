<template>
  <section class="project-font-registry" :aria-label="t('projectConfig.fonts.title')">
    <header class="project-font-registry__header">
      <div>
        <h2>{{ t('projectConfig.fonts.title') }}</h2>
        <OcText tone="muted" size="sm">{{ t('projectConfig.fonts.description') }}</OcText>
      </div>
      <OcButton icon="action.import" variant="soft" :disabled="busy" @click="emit('import-font')">
        {{ t('projectConfig.fonts.import') }}
      </OcButton>
    </header>

    <OcText v-if="error" class="project-font-registry__error" tone="danger" size="sm" role="alert">
      {{ error }}
    </OcText>

    <div v-if="fontEntries.length" class="project-font-registry__list">
      <article v-for="[id, definition] in fontEntries" :key="id" class="project-font-registry__item">
        <header class="project-font-registry__item-header">
          <div class="project-font-registry__identity">
            <OcIcon name="file.font" size="lg" tone="active" />
            <div>
              <strong :style="{ fontFamily: toCssFontFamily(`project:${id}`) }">
                {{ definition.family }}
              </strong>
              <code>project:{{ id }}</code>
            </div>
          </div>
          <span class="project-font-registry__item-actions">
            <OcButton icon="action.import" icon-only size="sm"
              :disabled="busy" :data-tooltip="t('projectConfig.fonts.addFace')"
              :aria-label="t('projectConfig.fonts.addFace')" @click="emit('import-face', id)" />
            <OcButton icon="action.delete" icon-tone="danger" icon-only size="sm"
              :data-tooltip="t('projectConfig.fonts.remove')" :aria-label="t('projectConfig.fonts.remove')"
              @click="removeFont(id)" />
          </span>
        </header>

        <label class="project-font-registry__family">
          <span>{{ t('projectConfig.fonts.family') }}</span>
          <OcFieldInput full-width size="sm" :value="definition.family"
            @input="updateFamily(id, $event)" />
        </label>

        <div class="project-font-registry__faces">
          <div v-for="(face, faceIndex) in definition.faces" :key="`${face.source}:${faceIndex}`"
            class="project-font-registry__face">
            <label class="project-font-registry__face-field">
              <span>{{ t('projectConfig.fonts.source') }}</span>
              <OcFieldInput class="project-font-registry__source" full-width size="sm" mono readonly
                :value="face.source" />
            </label>
            <label class="project-font-registry__face-field">
              <span>{{ t('projectConfig.fonts.weight') }}</span>
              <OcSelect size="sm" :model-value="face.weight ?? 'normal'" :options="weightOptions"
                @update:model-value="updateFace(id, faceIndex, { weight: $event })" />
            </label>
            <label class="project-font-registry__face-field">
              <span>{{ t('projectConfig.fonts.style') }}</span>
              <OcSelect size="sm" :model-value="face.style ?? 'normal'" :options="styleOptions"
                @update:model-value="updateFace(id, faceIndex, { style: asFontStyle($event) })" />
            </label>
            <span class="project-font-registry__face-actions">
              <OcIcon v-if="resolveLoadError(id, face.source)" name="status.warning" size="sm" tone="warning"
                :data-tooltip="resolveLoadError(id, face.source)"
                :aria-label="resolveLoadError(id, face.source)" />
              <OcButton v-if="definition.faces.length > 1" icon="action.delete" icon-only size="sm"
                icon-tone="danger" :data-tooltip="t('projectConfig.fonts.removeFace')"
                :aria-label="t('projectConfig.fonts.removeFace')" @click="removeFace(id, faceIndex)" />
            </span>
          </div>
        </div>
      </article>
    </div>

    <div v-else class="project-font-registry__empty">
      <OcIcon name="file.font" size="lg" tone="muted" />
      <OcText tone="muted" size="sm">{{ t('projectConfig.fonts.empty') }}</OcText>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  ProjectFontDefinition,
  ProjectFontFace,
  ProjectFontRegistry,
} from '../../features/workspace/model/projectMetadata'
import type { ProjectFontLoadError } from '../../features/workspace/services/projectFontLoader'
import { toCssFontFamily } from '../../features/workspace/model/projectFonts'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcSelect from '../standard/OcSelect.vue'

const props = withDefaults(defineProps<{
  fonts?: ProjectFontRegistry
  busy?: boolean
  error?: string
  loadErrors?: readonly ProjectFontLoadError[]
}>(), {
  fonts: () => ({}),
  busy: false,
  error: '',
  loadErrors: () => [],
})

const emit = defineEmits<{
  'update:fonts': [fonts: ProjectFontRegistry]
  'import-font': []
  'import-face': [id: string]
}>()

const { t } = useI18n()
const fontEntries = computed(() => Object.entries(props.fonts))
const weightOptions = computed(() => [
  { label: t('projectConfig.fonts.weights.normal'), value: 'normal' },
  ...Array.from({ length: 9 }, (_, index) => {
    const value = String((index + 1) * 100)
    return { label: value, value }
  }),
  { label: t('projectConfig.fonts.weights.bold'), value: 'bold' },
])
const styleOptions = computed(() => [
  { label: t('projectConfig.fonts.styles.normal'), value: 'normal' },
  { label: t('projectConfig.fonts.styles.italic'), value: 'italic' },
  { label: t('projectConfig.fonts.styles.oblique'), value: 'oblique' },
])

function emitRegistry(nextEntries: readonly [string, ProjectFontDefinition][]): void {
  emit('update:fonts', Object.fromEntries(nextEntries))
}

function updateFamily(id: string, event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const family = target.value.trimStart()
  emitRegistry(fontEntries.value.map(([entryId, definition]) => [
    entryId,
    entryId === id ? { ...definition, family } : definition,
  ]))
}

function updateFace(id: string, faceIndex: number, patch: Partial<ProjectFontFace>): void {
  emitRegistry(fontEntries.value.map(([entryId, definition]) => [
    entryId,
    entryId === id
      ? {
          ...definition,
          faces: definition.faces.map((face, index) => index === faceIndex ? { ...face, ...patch } : face),
        }
      : definition,
  ]))
}

function removeFont(id: string): void {
  emitRegistry(fontEntries.value.filter(([entryId]) => entryId !== id))
}

function removeFace(id: string, faceIndex: number): void {
  emitRegistry(fontEntries.value.map(([entryId, definition]) => [
    entryId,
    entryId === id
      ? { ...definition, faces: definition.faces.filter((_, index) => index !== faceIndex) }
      : definition,
  ]))
}

function asFontStyle(value: string): ProjectFontFace['style'] {
  return value === 'italic' || value === 'oblique' ? value : 'normal'
}

function resolveLoadError(fontId: string, source: string): string | undefined {
  return props.loadErrors.find(error => error.fontId === fontId && error.source === source)?.message
}
</script>

<style scoped>
.project-font-registry {
  display: grid;
  gap: var(--oc-space-4);
  padding-block: var(--oc-space-5);
  border-top: 1px solid var(--oc-border-muted);
}

.project-font-registry__header,
.project-font-registry__item-header,
.project-font-registry__identity,
.project-font-registry__item-actions,
.project-font-registry__face {
  display: flex;
  align-items: center;
}

.project-font-registry__header,
.project-font-registry__item-header {
  justify-content: space-between;
  gap: var(--oc-space-3);
}

.project-font-registry h2 {
  margin: 0 0 var(--oc-space-1);
  font-size: var(--oc-text-base);
  font-weight: var(--font-weight-ui-title);
  letter-spacing: 0;
}

.project-font-registry__error {
  color: var(--oc-danger);
}

.project-font-registry__list {
  display: grid;
  gap: var(--oc-space-3);
}

.project-font-registry__item {
  display: grid;
  gap: var(--oc-space-3);
  padding: var(--oc-space-3);
  border: 1px solid var(--oc-border-muted);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-surface);
}

.project-font-registry__identity {
  min-width: 0;
  gap: var(--oc-space-2);
}

.project-font-registry__identity > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.project-font-registry__identity strong,
.project-font-registry__identity code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-font-registry__identity code {
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-xs);
}

.project-font-registry__item-actions {
  flex: 0 0 auto;
  gap: var(--oc-space-1);
}

.project-font-registry__face-actions {
  display: inline-flex;
  min-height: var(--oc-size-sm);
  align-items: center;
  gap: var(--oc-space-1);
}

.project-font-registry__family {
  display: grid;
  grid-template-columns: minmax(72px, 112px) minmax(0, 1fr);
  align-items: center;
  gap: var(--oc-space-2);
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
}

.project-font-registry__faces {
  display: grid;
  gap: var(--oc-space-2);
}

.project-font-registry__face {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px 104px auto;
  gap: var(--oc-space-2);
}

.project-font-registry__source {
  min-width: 0;
}

.project-font-registry__face-field {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.project-font-registry__face-field > span {
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-xs);
}

.project-font-registry__empty {
  display: flex;
  min-height: 96px;
  align-items: center;
  justify-content: center;
  gap: var(--oc-space-2);
  border: 1px dashed var(--oc-border-muted);
  border-radius: var(--oc-radius-md);
}

@media (max-width: 720px) {
  .project-font-registry__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .project-font-registry__face {
    grid-template-columns: minmax(0, 1fr) minmax(84px, 0.5fr);
  }

  .project-font-registry__source {
    grid-column: 1 / -1;
  }
}
</style>
