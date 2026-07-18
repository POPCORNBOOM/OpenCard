<!-- Settings rows consume prepared UI data and return semantic user intent. -->
<template>
  <section class="settings-workspace" :aria-label="viewModel.title">
    <div v-if="viewModel.preview" class="settings-workspace__preview" aria-hidden="true">
      <div class="settings-workspace__preview-titlebar">
        <span class="settings-workspace__preview-brand">OPENCARD</span>
        <span class="settings-workspace__preview-menu" />
        <span class="settings-workspace__preview-window-actions">— □ ×</span>
      </div>
      <div class="settings-workspace__preview-body">
        <aside class="settings-workspace__preview-sidebar">
          <span class="is-active" />
          <span />
          <span />
        </aside>
        <div class="settings-workspace__preview-canvas">
          <AppearanceShaderPreview />
          <div class="settings-workspace__preview-document">
            <span />
            <span />
            <span />
          </div>
          <div class="settings-workspace__preview-glass">
            <strong>{{ viewModel.preview.glassIntensity }}%</strong>
            <span />
            <span />
          </div>
        </div>
      </div>
    </div>
    <div class="settings-workspace__fields">
      <div v-for="field in viewModel.fields" :key="field.key" class="settings-workspace__row">
        <OcText class="settings-workspace__label" as="span" size="sm">{{ field.label }}</OcText>

        <OcOptionGroup
          v-if="field.type === 'options'"
          class="settings-workspace__control"
          :model-value="field.value"
          :options="field.options"
          @update:model-value="emitSettingChange(field.key, $event)"
        />
        <OcCheckbox
          v-else-if="field.type === 'checkbox'"
          class="settings-workspace__control"
          :checked="field.checked"
          :aria-label="field.label"
          @update:checked="emitSettingChange(field.key, $event)"
        />
        <div v-else-if="field.type === 'range'" class="settings-workspace__range-control">
          <input
            class="settings-workspace__range"
            type="range"
            :value="field.value"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            :aria-label="field.label"
            @input="emitSettingChange(field.key, Number(($event.target as HTMLInputElement).value))"
          />
          <OcText class="settings-workspace__range-value" as="output" size="sm" mono>
            {{ field.value }}{{ field.suffix }}
          </OcText>
        </div>
        <OcText
          v-else-if="field.type === 'value'"
          class="settings-workspace__control"
          tone="muted"
          size="sm"
          mono
        >
          {{ field.value }}
        </OcText>
        <OcButton
          v-else
          class="settings-workspace__control"
          size="sm"
          variant="outline"
          :icon="field.icon"
          :disabled="field.disabled"
          :title="field.disabledReason"
          @click="emit('intent', { type: 'project-workspace.reset' })"
        >
          {{ field.actionLabel }}
        </OcButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { OcButton, OcCheckbox, OcText } from '../../../components/base'
import { OcOptionGroup } from '../../../components/standard'
import AppearanceShaderPreview from './AppearanceShaderPreview.vue'
import type { SettingsIntent } from '../model/appSettings'
import type { SettingsCategoryViewModel } from '../composables/useSettingsWorkspace'

defineProps<{
  viewModel: SettingsCategoryViewModel
}>()

const emit = defineEmits<{
  intent: [intent: SettingsIntent]
}>()

function emitSettingChange(key: Extract<SettingsIntent, { type: 'setting.change' }>['key'], value: unknown): void {
  emit('intent', { type: 'setting.change', key, value })
}
</script>

<style scoped>
.settings-workspace {
  width: min(100%, 720px);
  margin: 0 auto;
  padding: var(--oc-space-6) var(--oc-space-5);
}

.settings-workspace__fields {
  display: grid;
}

.settings-workspace__preview {
  overflow: hidden;
  margin-bottom: var(--oc-space-5);
  aspect-ratio: 16 / 7;
  min-height: 210px;
  border: 1px solid var(--oc-border-muted);
  border-radius: var(--oc-radius-lg);
  background: var(--oc-bg-base);
  box-shadow: var(--oc-shadow-md);
}

.settings-workspace__preview-titlebar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  height: 34px;
  padding: 0 var(--oc-space-3);
  border-bottom: 1px solid var(--oc-border-muted);
  background: var(--oc-bg-raised);
  color: var(--oc-fg-muted);
  font-size: 10px;
  letter-spacing: 0.08em;
}

.settings-workspace__preview-brand {
  color: var(--oc-fg-default);
  font-weight: 700;
}

.settings-workspace__preview-menu {
  width: 88px;
  height: 5px;
  margin-left: var(--oc-space-4);
  border-radius: 99px;
  background: var(--oc-border-muted);
}

.settings-workspace__preview-window-actions {
  letter-spacing: 0.5em;
}

.settings-workspace__preview-body {
  display: grid;
  grid-template-columns: 28% 1fr;
  height: calc(100% - 34px);
}

.settings-workspace__preview-sidebar {
  display: grid;
  align-content: start;
  gap: var(--oc-space-3);
  padding: var(--oc-space-4) var(--oc-space-3);
  border-right: 1px solid var(--oc-border-muted);
  background: var(--oc-bg-surface);
}

.settings-workspace__preview-sidebar span,
.settings-workspace__preview-document span,
.settings-workspace__preview-glass span {
  display: block;
  height: 6px;
  border-radius: 99px;
  background: var(--oc-border-muted);
}

.settings-workspace__preview-sidebar span:nth-child(2) { width: 72%; }
.settings-workspace__preview-sidebar span:nth-child(3) { width: 84%; }
.settings-workspace__preview-sidebar .is-active {
  background: var(--oc-accent);
  box-shadow: 0 0 12px var(--oc-accent-glow);
}

.settings-workspace__preview-canvas {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--oc-bg-base);
}

.settings-workspace__preview-document {
  position: relative;
  display: grid;
  align-content: start;
  gap: var(--oc-space-3);
  width: 62%;
  height: 68%;
  padding: var(--oc-space-4);
  border: 1px solid var(--oc-border-muted);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-surface);
}

.settings-workspace__preview-document span:first-child {
  width: 46%;
  height: 9px;
  background: var(--oc-fg-muted);
}

.settings-workspace__preview-document span:last-child { width: 78%; }

.settings-workspace__preview-glass {
  position: absolute;
  right: 7%;
  bottom: 10%;
  display: grid;
  gap: var(--oc-space-2);
  width: 38%;
  padding: var(--oc-space-3);
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-glass);
  backdrop-filter: blur(var(--oc-bg-glass-blur)) saturate(var(--oc-bg-glass-saturate));
  box-shadow: var(--oc-shadow-lg);
  color: var(--oc-fg-default);
}

.settings-workspace__preview-glass strong {
  font-size: 20px;
}

.settings-workspace__preview-glass span:last-child { width: 64%; }

.settings-workspace__row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(220px, auto);
  align-items: center;
  min-height: 54px;
  gap: var(--oc-space-5);
  border-bottom: 1px solid var(--oc-border-muted);
}

.settings-workspace__label {
  min-width: 0;
}

.settings-workspace__control {
  min-width: 0;
  justify-self: end;
}

.settings-workspace__range-control {
  display: grid;
  grid-template-columns: minmax(160px, 240px) 48px;
  align-items: center;
  gap: var(--oc-space-3);
  justify-self: end;
}

.settings-workspace__range {
  width: 100%;
  accent-color: var(--oc-accent);
  cursor: pointer;
}

.settings-workspace__range-value {
  text-align: right;
}

@media (max-width: 680px) {
  .settings-workspace {
    padding: var(--oc-space-4);
  }

  .settings-workspace__row {
    grid-template-columns: minmax(0, 1fr);
    justify-items: stretch;
    gap: var(--oc-space-2);
    padding: var(--oc-space-3) 0;
  }

  .settings-workspace__control {
    justify-self: start;
    max-width: 100%;
  }

  .settings-workspace__range-control {
    width: 100%;
    grid-template-columns: minmax(0, 1fr) 48px;
    justify-self: stretch;
  }
}
</style>
