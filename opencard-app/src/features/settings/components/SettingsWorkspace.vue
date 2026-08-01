<!-- Settings rows consume prepared UI data and return semantic user intent. -->
<template>
  <section class="settings-workspace" :aria-label="viewModel.title">
    <div class="settings-workspace__content">
      <div
        v-if="viewModel.preview"
        class="settings-workspace__preview"
        aria-hidden="true"
      >
        <div class="settings-workspace__preview-titlebar">
          <AppearanceShaderPreview :progress="0.64" />
          <span class="settings-workspace__preview-brand" />
          <div class="settings-workspace__preview-window-dots">
            <i /><i /><i />
          </div>
        </div>
        <div class="settings-workspace__preview-body">
          <aside class="settings-workspace__preview-sidebar">
            <span class="settings-workspace__preview-section-line" />
            <span v-for="index in 5" :key="index" class="settings-workspace__preview-row"
              :class="{ 'is-selected': index === 2, 'is-short': index === 4 }">
              <i /><b />
            </span>
          </aside>
          <main class="settings-workspace__preview-workspace">
            <header class="settings-workspace__preview-workspace-header">
              <span />
              <i /><i />
            </header>
            <div class="settings-workspace__preview-editor">
              <AppearanceShaderPreview variant="dot-noise" />
              <section class="settings-workspace__preview-panel">
                <span class="settings-workspace__preview-section-line" />
                <span class="settings-workspace__preview-row is-selected"><i /><b /></span>
                <span class="settings-workspace__preview-row is-indented"><i /><b /></span>
              </section>
              <div class="settings-workspace__preview-canvas">
                <div class="settings-workspace__preview-document">
                  <div class="settings-workspace__preview-card-corner">
                    <b>7</b><span>♣</span>
                  </div>
                  <div class="settings-workspace__preview-card-pips">
                    <i v-for="index in 7" :key="index">♣</i>
                  </div>
                  <div class="settings-workspace__preview-card-corner is-bottom">
                    <b>7</b><span>♣</span>
                  </div>
                </div>
              </div>
              <section class="settings-workspace__preview-panel settings-workspace__preview-properties">
                <span class="settings-workspace__preview-section-line" />
                <span v-for="index in 3" :key="index" class="settings-workspace__preview-property"
                  :class="{ 'is-accented': index === 2 }">
                  <i /><b />
                </span>
              </section>
            </div>
          </main>
        </div>
      </div>

      <div class="settings-workspace__fields">
        <div
          v-for="field in viewModel.fields"
          :key="field.key"
          class="settings-workspace__row"
          :class="{ 'is-theme-color-panel': field.type === 'theme-color-panel' }"
        >
          <section v-if="field.type === 'theme-color-panel'" class="settings-workspace__color-panel">
            <header class="settings-workspace__color-panel-header">
              <OcText as="span" size="sm" bold>{{ field.label }}</OcText>
            </header>
            <div class="settings-workspace__color-row">
              <OcText as="span" size="sm">{{ field.preset.label }}</OcText>
              <div class="settings-workspace__theme-preset-actions">
                <OcSelect
                  class="settings-workspace__theme-preset"
                  size="sm"
                  :model-value="field.preset.value"
                  :placeholder="field.preset.placeholder"
                  :options="field.preset.options"
                  @update:model-value="applyThemePreset(field.themeId, $event)"
                />
                <OcButton
                  icon="action.import"
                  icon-only
                  size="sm"
                  variant="outline"
                  :aria-label="field.preset.importLabel"
                  :data-tooltip="field.preset.importLabel"
                  @click="emitThemeFileAction('theme.import', field.themeId)"
                />
                <OcButton
                  icon="action.export"
                  icon-only
                  size="sm"
                  variant="outline"
                  :aria-label="field.preset.exportLabel"
                  :data-tooltip="field.preset.exportLabel"
                  @click="emitThemeFileAction('theme.export', field.themeId)"
                />
                <OcButton
                  icon="action.delete"
                  icon-only
                  size="sm"
                  variant="outline"
                  :disabled="!field.preset.canDelete"
                  :aria-label="field.preset.deleteLabel"
                  :data-tooltip="field.preset.deleteLabel"
                  @click="deleteThemePreset(field.themeId, field.preset.value)"
                />
              </div>
            </div>
            <div
              v-for="color in field.colors"
              :key="color.key"
              class="settings-workspace__color-row"
            >
              <OcText as="span" size="sm">{{ color.label }}</OcText>
              <div class="settings-workspace__color-value">
                <OcColorPicker
                  class="settings-workspace__color-picker"
                  :model-value="color.value"
                  :label="`${field.label} · ${color.label}`"
                  variant="field"
                  :allow-alpha="false"
                  @preview="emitThemeColor('theme-color.preview', field.themeId, color, $event)"
                  @commit="commitThemeColor(field.themeId, color, $event)"
                  @cancel="cancelThemeColor(field.themeId, color)"
                  @open-change="captureThemeColorSnapshot($event, field.themeId, color)"
                />
              </div>
            </div>
            <div class="settings-workspace__color-row">
              <OcText as="span" size="sm">{{ field.fontFamily.label }}</OcText>
              <FontFamilyAutocomplete
                class="settings-workspace__theme-font"
                :model-value="field.fontFamily.value"
                :font-families="field.fontFamily.fontFamilies"
                :label="`${field.label} · ${field.fontFamily.label}`"
                :placeholder="field.fontFamily.placeholder"
                @commit="emitThemeFont(field.themeId, $event)"
              />
            </div>
            <div class="settings-workspace__color-row">
              <OcText as="span" size="sm">{{ field.accentNeighborAngle.label }}</OcText>
              <div class="settings-workspace__range-control settings-workspace__theme-angle">
                <OcSlider
                  class="settings-workspace__range"
                  :model-value="field.accentNeighborAngle.value"
                  :min="field.accentNeighborAngle.min"
                  :max="field.accentNeighborAngle.max"
                  :step="field.accentNeighborAngle.step"
                  :value-text="`${field.accentNeighborAngle.value}${field.accentNeighborAngle.suffix}`"
                  :aria-label="`${field.label} · ${field.accentNeighborAngle.label}`"
                  @preview="emitThemeAngle('theme-angle.preview', field.themeId, $event)"
                  @commit="emitThemeAngle('theme-angle.change', field.themeId, $event)"
                />
                <OcText class="settings-workspace__range-value" as="output" size="sm" mono>
                  {{ field.accentNeighborAngle.value }}{{ field.accentNeighborAngle.suffix }}
                </OcText>
              </div>
            </div>
          </section>

          <template v-else>
            <OcText class="settings-workspace__label" as="span" size="sm">{{ field.label }}</OcText>

            <OcOptionGroup
            v-if="field.type === 'options'"
            class="settings-workspace__control"
            :model-value="field.value"
            :options="field.options"
            @update:model-value="emitSettingChange(field.key, $event)"
          />
          <OcSwitch
            v-else-if="field.type === 'switch'"
            class="settings-workspace__control"
            :checked="field.checked"
            :aria-label="field.label"
            @update:checked="emitSettingChange(field.key, $event)"
          />
          <div v-else-if="field.type === 'range'" class="settings-workspace__range-control">
            <OcSlider
              class="settings-workspace__range"
              :model-value="field.value"
              :min="field.min"
              :max="field.max"
              :step="field.step"
              :value-text="`${field.value}${field.suffix}`"
              :aria-label="field.label"
              @preview="emitSettingPreview(field.key, $event)"
              @commit="emitSettingChange(field.key, $event)"
            />
            <OcText class="settings-workspace__range-value" as="output" size="sm" mono>
              {{ field.value }}{{ field.suffix }}
            </OcText>
          </div>
          <OcButton
            v-else
            class="settings-workspace__control"
            size="sm"
            variant="outline"
            :icon="field.icon"
            :disabled="field.disabled"
            :data-tooltip="field.disabledReason"
            @click="emitAction(field.key)"
          >
            {{ field.actionLabel }}
          </OcButton>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import OcButton from '../../../components/base/OcButton.vue'
import OcSwitch from '../../../components/base/OcSwitch.vue'
import OcText from '../../../components/base/OcText.vue'
import OcOptionGroup from '../../../components/standard/OcOptionGroup.vue'
import OcColorPicker from '../../../components/standard/OcColorPicker.vue'
import OcSelect from '../../../components/standard/OcSelect.vue'
import OcSlider from '../../../components/standard/OcSlider.vue'
import AppearanceShaderPreview from './AppearanceShaderPreview.vue'
import FontFamilyAutocomplete from './FontFamilyAutocomplete.vue'
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

function emitSettingPreview(key: Extract<SettingsIntent, { type: 'setting.preview' }>['key'], value: unknown): void {
  emit('intent', { type: 'setting.preview', key, value })
}

type ThemeColorPanel = Extract<SettingsCategoryViewModel['fields'][number], { type: 'theme-color-panel' }>
type ThemeColor = ThemeColorPanel['colors'][number]
const themeColorSnapshots = new Map<string, string | null>()

function themeColorKey(themeId: ThemeColorPanel['themeId'], color: ThemeColor): string {
  return `${themeId}:${color.token}`
}

function emitThemeColor(
  type: 'theme-color.preview' | 'theme-color.change' | 'theme-color.cancel',
  themeId: ThemeColorPanel['themeId'],
  color: ThemeColor,
  value: string | null,
): void {
  emit('intent', { type, themeId, token: color.token, value })
}

function captureThemeColorSnapshot(
  open: boolean,
  themeId: ThemeColorPanel['themeId'],
  color: ThemeColor,
): void {
  const key = themeColorKey(themeId, color)
  if (open) themeColorSnapshots.set(key, color.overrideValue)
  else themeColorSnapshots.delete(key)
}

function commitThemeColor(themeId: ThemeColorPanel['themeId'], color: ThemeColor, value: string): void {
  themeColorSnapshots.set(themeColorKey(themeId, color), value)
  emitThemeColor('theme-color.change', themeId, color, value)
}

function cancelThemeColor(themeId: ThemeColorPanel['themeId'], color: ThemeColor): void {
  const key = themeColorKey(themeId, color)
  emitThemeColor('theme-color.cancel', themeId, color, themeColorSnapshots.get(key) ?? null)
}

function emitThemeAngle(
  type: 'theme-angle.preview' | 'theme-angle.change',
  themeId: ThemeColorPanel['themeId'],
  value: number,
): void {
  emit('intent', { type, themeId, value })
}

function emitThemeFont(themeId: ThemeColorPanel['themeId'], value: string): void {
  if (value) emit('intent', { type: 'theme-font.change', themeId, value })
}

function applyThemePreset(themeId: ThemeColorPanel['themeId'], presetId: string): void {
  if (presetId) emit('intent', { type: 'theme-preset.change', themeId, presetId })
}

function deleteThemePreset(themeId: ThemeColorPanel['themeId'], presetId: string): void {
  if (presetId.startsWith('user:')) emit('intent', { type: 'theme-preset.delete', themeId, presetId })
}

function emitThemeFileAction(type: 'theme.import' | 'theme.export', themeId: ThemeColorPanel['themeId']): void {
  emit('intent', { type, themeId })
}

function emitAction(key: 'project-workspace.reset' | 'themes.reset'): void {
  emit('intent', { type: key })
}
</script>

<style scoped>
.settings-workspace {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.settings-workspace__content {
  box-sizing: border-box;
  width: 100%;
  max-width: var(--oc-content-width-md);
  margin-inline: auto;
  padding: var(--oc-space-6) var(--oc-space-5);
}

.settings-workspace__fields {
  display: grid;
}

.settings-workspace__preview {
  overflow: hidden;
  margin-bottom: var(--oc-space-5);
  aspect-ratio: 16 / 9;
  min-height: 210px;
  border: 1px solid var(--oc-border-muted);
  border-radius: var(--oc-radius-lg);
  background: var(--oc-bg-base);
  box-shadow: var(--oc-shadow-md);
}

.settings-workspace__preview-titlebar {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 34px;
  padding: 0 var(--oc-space-3);
  background: var(--oc-bg-base);
}

.settings-workspace__preview-brand {
  position: relative;
  z-index: 1;
  width: 54px;
  height: 5px;
  border-radius: var(--oc-radius-full);
  background: var(--oc-fg-subtle);
  opacity: 0.7;
}

.settings-workspace__preview-window-dots {
  display: flex;
  gap: 6px;
}

.settings-workspace__preview-window-dots {
  position: relative;
  z-index: 1;
}

.settings-workspace__preview-window-dots i {
  width: 7px;
  height: 7px;
  border-radius: var(--oc-radius-full);
  background: var(--oc-fg-default);
  opacity: 0.82;
}

.settings-workspace__preview-body {
  display: grid;
  grid-template-columns: 24% 1fr;
  height: calc(100% - 34px);
}

.settings-workspace__preview-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--oc-space-2);
  padding: var(--oc-space-4) var(--oc-space-3);
  border-right: 1px solid var(--oc-border-muted);
  background: var(--oc-bg-base);
}

.settings-workspace__preview-section-line {
  display: block;
  width: 42%;
  height: 4px;
  margin: var(--oc-space-1) var(--oc-space-2) var(--oc-space-2);
  border-radius: var(--oc-radius-full);
  background: var(--oc-fg-subtle);
  opacity: 0.65;
}

.settings-workspace__preview-row {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  height: var(--oc-size-sm);
  padding: 0 var(--oc-space-2);
  border-radius: var(--oc-radius-sm);
}

.settings-workspace__preview-row i,
.settings-workspace__preview-workspace-header i {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: var(--oc-radius-full);
  background: var(--oc-fg-muted);
}

.settings-workspace__preview-row b {
  width: 62%;
  height: 4px;
  border-radius: var(--oc-radius-full);
  background: var(--oc-fg-muted);
  opacity: 0.72;
}

.settings-workspace__preview-row.is-short b { width: 38%; }
.settings-workspace__preview-row.is-indented { margin-left: var(--oc-space-3); }

.settings-workspace__preview-row.is-selected {
  background: var(--oc-bg-selected);
}

.settings-workspace__preview-workspace {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: 28px minmax(0, 1fr);
  background: var(--oc-bg-surface);
}

.settings-workspace__preview-workspace-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--oc-space-2);
  padding: 0 var(--oc-space-3);
  border-bottom: 1px solid var(--oc-border-muted);
  background: color-mix(in srgb, var(--oc-bg-surface) 94%, var(--oc-bg-raised));
}

.settings-workspace__preview-workspace-header > span {
  width: 48px;
  height: 4px;
  margin-right: auto;
  border-radius: var(--oc-radius-full);
  background: var(--oc-fg-muted);
}

.settings-workspace__preview-editor {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-height: 0;
  display: grid;
  grid-template-columns: 22% minmax(0, 1fr) 28%;
  gap: 1px;
  background: var(--oc-bg-base);
}

.settings-workspace__preview-panel {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--oc-space-2);
  padding: var(--oc-space-3) var(--oc-space-2);
  background: var(--oc-bg-glass);
  backdrop-filter: blur(var(--oc-bg-glass-blur)) saturate(var(--oc-bg-glass-saturate));
}

.settings-workspace__preview-canvas {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: transparent;
}

.settings-workspace__preview-document {
  position: relative;
  z-index: 1;
  width: 44%;
  aspect-ratio: 5 / 7;
  overflow: hidden;
  border: 1px solid var(--oc-border-strong);
  border-radius: var(--oc-radius-sm);
  background: var(--oc-bg-raised);
  box-shadow: var(--oc-shadow-md);
}

.settings-workspace__preview-card-corner {
  position: absolute;
  top: 7%;
  left: 9%;
  display: grid;
  justify-items: center;
  color: var(--oc-accent);
  font-family: Georgia, 'Times New Roman', serif;
  line-height: 0.8;
}

.settings-workspace__preview-card-corner b {
  font-size: var(--oc-text-base);
  font-weight: 600;
}

.settings-workspace__preview-card-corner span {
  font-size: var(--oc-text-base);
}

.settings-workspace__preview-card-corner.is-bottom {
  inset: auto 9% 7% auto;
  transform: rotate(180deg);
}

.settings-workspace__preview-card-pips {
  position: absolute;
  display: grid;
  grid-template: repeat(5, 1fr) / repeat(3, 1fr);
  inset: 16% 22%;
  color: var(--oc-accent);
}

.settings-workspace__preview-card-pips i {
  align-self: center;
  justify-self: center;
  font: 19px/1 Georgia, 'Times New Roman', serif;
  font-style: normal;
}

.settings-workspace__preview-card-pips i:nth-child(1) { grid-area: 1 / 1; }
.settings-workspace__preview-card-pips i:nth-child(2) { grid-area: 1 / 3; }
.settings-workspace__preview-card-pips i:nth-child(3) { grid-area: 3 / 1; }
.settings-workspace__preview-card-pips i:nth-child(4) { grid-area: 3 / 3; }
.settings-workspace__preview-card-pips i:nth-child(5) { grid-area: 2 / 2; }
.settings-workspace__preview-card-pips i:nth-child(6) { grid-area: 5 / 1; transform: rotate(180deg); }
.settings-workspace__preview-card-pips i:nth-child(7) { grid-area: 5 / 3; transform: rotate(180deg); }

.settings-workspace__preview-property {
  display: grid;
  gap: var(--oc-space-1);
}

.settings-workspace__preview-property i,
.settings-workspace__preview-property b {
  display: block;
  border-radius: var(--oc-radius-sm);
  background: var(--oc-fg-muted);
  opacity: 0.55;
}

.settings-workspace__preview-property i { width: 38%; height: 4px; }
.settings-workspace__preview-property b {
  width: 100%;
  height: var(--oc-size-sm);
  border: 1px solid var(--oc-border-default);
  background: var(--oc-bg-input);
}
.settings-workspace__preview-property.is-accented b { border-color: var(--oc-border-accent); }

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
}

.settings-workspace__range-value {
  text-align: right;
}

.settings-workspace__row.is-theme-color-panel {
  display: block;
  padding: var(--oc-space-3) 0;
}

.settings-workspace__color-panel {
  width: 100%;
}

.settings-workspace__color-panel-header,
.settings-workspace__color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 42px;
  padding: 0 var(--oc-space-4);
  border-bottom: 1px solid var(--oc-border-muted);
}

.settings-workspace__color-panel-header {
  min-height: 46px;
}

.settings-workspace__color-value {
  width: 128px;
}

.settings-workspace__color-picker {
  width: 100%;
}

.settings-workspace__theme-preset {
  width: 128px;
}

.settings-workspace__theme-font {
  width: min(320px, 48vw);
}

.settings-workspace__theme-preset-actions {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
}

.settings-workspace__theme-angle {
  grid-template-columns: minmax(120px, 180px) 48px;
}

@media (max-width: 680px) {
  .settings-workspace__content {
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
