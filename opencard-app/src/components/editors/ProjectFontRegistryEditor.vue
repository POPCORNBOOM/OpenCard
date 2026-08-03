<template>
  <section class="project-font-registry" :class="{ 'project-font-registry--embedded': !showHeader }"
    :aria-label="t('projectConfig.fonts.title')">
    <header v-if="showHeader" class="project-font-registry__header">
      <div>
        <h2>{{ t('projectConfig.fonts.title') }}</h2>
        <OcText tone="muted" size="sm">{{ t('projectConfig.fonts.description') }}</OcText>
      </div>
      <OcButton icon="action.add" variant="soft" :disabled="busy" @click="emit('register-font')">
        {{ t('projectConfig.fonts.register') }}
      </OcButton>
    </header>

    <OcText v-if="error" class="project-font-registry__error" tone="danger" size="sm" role="alert">
      {{ error }}
    </OcText>

    <div v-if="fontEntries.length" class="project-font-registry__list">
      <article v-for="[id, definition] in fontEntries" :key="id" class="project-font-registry__item">
        <div class="project-font-registry__identity">
          <OcIcon name="file.font" size="lg" tone="active" />
          <div>
            <strong :style="{ fontFamily: toCssFontFamily(`font:${id}`) }">
              {{ definition.name }}
            </strong>
            <code>font:{{ id }}</code>
          </div>
        </div>

        <OcFieldInput class="project-font-registry__source" full-width size="sm" mono readonly
          :aria-label="t('projectConfig.fonts.source')" :value="definition.source" />

        <span class="project-font-registry__actions">
          <OcIcon v-if="resolveLoadError(id, definition.source)" name="status.warning" size="sm" tone="warning"
            :data-tooltip="resolveLoadError(id, definition.source)"
            :aria-label="resolveLoadError(id, definition.source)" />
          <OcButton icon="tool.settings" icon-only size="sm" :disabled="busy"
            :data-tooltip="t('projectConfig.fonts.configure')" :aria-label="t('projectConfig.fonts.configure')"
            @click="emit('configure-font', id)" />
          <OcButton icon="action.delete" icon-tone="danger" icon-only size="sm"
            :data-tooltip="t('projectConfig.fonts.remove')" :aria-label="t('projectConfig.fonts.remove')"
            @click="removeFont(id)" />
        </span>
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
import type { ProjectFontRegistry } from '../../features/workspace/model/projectFontRegistry'
import type { ProjectFontLoadError } from '../../features/workspace/services/projectFontLoader'
import { toCssFontFamily } from '../../features/workspace/model/projectFonts'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'

const props = withDefaults(defineProps<{
  fonts?: ProjectFontRegistry
  busy?: boolean
  error?: string
  loadErrors?: readonly ProjectFontLoadError[]
  showHeader?: boolean
}>(), {
  fonts: () => ({}),
  busy: false,
  error: '',
  loadErrors: () => [],
  showHeader: true,
})

const emit = defineEmits<{
  'update:fonts': [fonts: ProjectFontRegistry]
  'register-font': []
  'configure-font': [key: string]
}>()

const { t } = useI18n()
const fontEntries = computed(() => Object.entries(props.fonts))

function removeFont(id: string): void {
  emit('update:fonts', Object.fromEntries(fontEntries.value.filter(([entryId]) => entryId !== id)))
}

function resolveLoadError(fontId: string, source: string): string | undefined {
  const error = props.loadErrors.find(candidate => candidate.fontId === fontId && candidate.source === source)
  return error ? t('projectConfig.fonts.loadFailed', { message: error.message }) : undefined
}
</script>

<style scoped>
.project-font-registry {
  display: grid;
  gap: var(--oc-space-4);
  padding-block: var(--oc-space-5);
  border-top: var(--oc-border-width) solid var(--oc-border-muted);
}

.project-font-registry--embedded {
  padding-block: 0;
  border-top: 0;
}

.project-font-registry__header,
.project-font-registry__item,
.project-font-registry__identity,
.project-font-registry__actions {
  display: flex;
  align-items: center;
}

.project-font-registry__header,
.project-font-registry__item {
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
  gap: var(--oc-space-2);
}

.project-font-registry__item {
  min-width: 0;
  padding: var(--oc-space-3);
  border: var(--oc-border-width) solid var(--oc-border-muted);
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
  gap: var(--oc-space-1);
}

.project-font-registry__identity strong,
.project-font-registry__identity code,
.project-font-registry__source {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-font-registry__identity code {
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-xs);
}

.project-font-registry__source {
  min-width: 0;
  flex: 1;
}

.project-font-registry__actions {
  flex: 0 0 auto;
  gap: var(--oc-space-1);
}

.project-font-registry__empty {
  display: grid;
  justify-items: center;
  gap: var(--oc-space-2);
  padding-block: var(--oc-space-6);
}

</style>
