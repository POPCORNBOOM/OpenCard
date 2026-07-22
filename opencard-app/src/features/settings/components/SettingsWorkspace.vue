<!-- Settings rows consume prepared UI data and return semantic user intent. -->
<template>
  <section class="settings-workspace" :aria-label="viewModel.title">
    <div class="settings-workspace__content">
      <div
        v-if="viewModel.preview"
        class="settings-workspace__preview"
        :class="{ 'settings-workspace__preview--macos': nativeMacosControls }"
        aria-hidden="true"
      >
        <div class="settings-workspace__preview-titlebar">
          <div class="settings-workspace__preview-titlebar-left">
            <OcIcon name="nav.sidebar-collapse" size="sm" />
            <span>文件</span>
            <span>编辑</span>
            <span>视图</span>
          </div>
          <strong>OpenCard</strong>
          <span v-if="!nativeMacosControls" class="settings-workspace__preview-window-actions">- □ ×</span>
        </div>
        <div class="settings-workspace__preview-body">
          <aside class="settings-workspace__preview-sidebar">
            <div class="settings-workspace__preview-section-title">
              <span>工作区</span>
              <OcIcon name="action.add" size="sm" />
            </div>
            <div class="settings-workspace__preview-tree-row">
              <OcIcon name="tree.chevron-down" size="sm" />
              <OcIcon class="is-folder" name="status.folder-open" size="sm" />
              <span>cards</span>
            </div>
            <div class="settings-workspace__preview-tree-row is-selected">
              <OcIcon class="is-card-file" name="file.opencard" size="sm" />
              <span>sample.opencard</span>
            </div>
            <div class="settings-workspace__preview-tree-row is-hovered">
              <OcIcon class="is-image-file" name="file.image" size="sm" />
              <span>cover.png</span>
            </div>
            <span class="settings-workspace__preview-scrollbar" />
          </aside>
          <main class="settings-workspace__preview-workspace">
            <header class="settings-workspace__preview-workspace-header">
              <span>sample.opencard</span>
              <div>
                <OcIcon name="action.undo" size="sm" />
                <OcIcon name="action.save" size="sm" />
              </div>
            </header>
            <div class="settings-workspace__preview-editor">
              <section class="settings-workspace__preview-panel">
                <strong>结构</strong>
                <div class="settings-workspace__preview-block-row is-selected">
                  <OcIcon name="entity.block-simple-container" size="sm" />
                  <span>Card</span>
                </div>
                <div class="settings-workspace__preview-block-row">
                  <OcIcon name="entity.block-text" size="sm" />
                  <span>Title</span>
                </div>
              </section>
              <div class="settings-workspace__preview-canvas">
                <AppearanceShaderPreview />
                <div class="settings-workspace__preview-document">
                  <span class="settings-workspace__preview-card-title">OPEN CARD</span>
                  <span class="settings-workspace__preview-card-shape" />
                  <span class="settings-workspace__preview-card-copy" />
                </div>
                <div class="settings-workspace__preview-glass">
                  <OcIcon name="tool.zoom-out" size="sm" />
                  <strong>{{ viewModel.preview.glassIntensity }}%</strong>
                  <OcIcon name="tool.zoom-in" size="sm" />
                </div>
              </div>
              <section class="settings-workspace__preview-panel settings-workspace__preview-properties">
                <strong>属性</strong>
                <label><span>名称</span><i>Title</i></label>
                <label><span>字号</span><i class="is-focused">24</i></label>
                <label class="is-disabled"><span>绑定</span><i>未设置</i></label>
                <div class="settings-workspace__preview-status">
                  <OcIcon name="status.warning" size="sm" />
                  <span>1</span>
                  <OcIcon name="status.error" size="sm" />
                </div>
              </section>
            </div>
          </main>
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
    </div>
  </section>
</template>

<script setup lang="ts">
import OcButton from '../../../components/base/OcButton.vue'
import OcCheckbox from '../../../components/base/OcCheckbox.vue'
import OcIcon from '../../../components/base/OcIcon.vue'
import OcText from '../../../components/base/OcText.vue'
import OcOptionGroup from '../../../components/standard/OcOptionGroup.vue'
import AppearanceShaderPreview from './AppearanceShaderPreview.vue'
import type { SettingsIntent } from '../model/appSettings'
import type { SettingsCategoryViewModel } from '../composables/useSettingsWorkspace'

defineProps<{
  viewModel: SettingsCategoryViewModel
  nativeMacosControls?: boolean
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
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 34px;
  padding: 0 var(--oc-space-3);
  border-bottom: 1px solid var(--oc-border-muted);
  background: var(--oc-bg-raised);
  color: var(--oc-fg-muted);
  font-size: 10px;
}

.settings-workspace__preview-titlebar-left,
.settings-workspace__preview-window-actions {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--oc-space-3);
}

.settings-workspace__preview--macos .settings-workspace__preview-titlebar-left {
  padding-left: 46px;
}

.settings-workspace__preview--macos .settings-workspace__preview-titlebar-left::before {
  content: '';
  position: absolute;
  left: var(--oc-space-3);
  width: 8px;
  height: 8px;
  border-radius: var(--oc-radius-full);
  background: var(--oc-danger);
  box-shadow: 13px 0 var(--oc-icon-warning), 26px 0 var(--oc-icon-success);
}

.settings-workspace__preview-titlebar-left span:first-of-type {
  padding: var(--oc-space-1) var(--oc-space-2);
  border-radius: var(--oc-radius-full);
  background: var(--oc-bg-hover);
  color: var(--oc-fg-default);
}

.settings-workspace__preview-titlebar strong {
  color: var(--oc-fg-subtle);
  font-size: var(--oc-text-xs);
  font-weight: 500;
}

.settings-workspace__preview-window-actions {
  justify-content: flex-end;
  letter-spacing: 0.5em;
}

.settings-workspace__preview-body {
  display: grid;
  grid-template-columns: 28% 1fr;
  height: calc(100% - 34px);
}

.settings-workspace__preview-sidebar {
  position: relative;
  display: grid;
  align-content: start;
  gap: var(--oc-space-1);
  padding: var(--oc-space-3) var(--oc-space-2);
  border-right: 1px solid var(--oc-border-muted);
  background: var(--oc-bg-base);
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-xs);
}

.settings-workspace__preview-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--oc-size-sm);
  padding: 0 var(--oc-space-2);
  color: var(--oc-fg-subtle);
}

.settings-workspace__preview-tree-row,
.settings-workspace__preview-block-row {
  display: flex;
  align-items: center;
  gap: var(--oc-space-1);
  height: var(--oc-size-sm);
  min-width: 0;
  padding: 0 var(--oc-space-2);
  border-radius: var(--oc-radius-sm);
}

.settings-workspace__preview-tree-row:nth-of-type(n + 3) {
  padding-left: var(--oc-space-6);
}

.settings-workspace__preview-tree-row.is-selected,
.settings-workspace__preview-block-row.is-selected {
  background: var(--oc-bg-selected);
  color: var(--oc-fg-accent);
}

.settings-workspace__preview-tree-row.is-hovered {
  background: var(--oc-bg-hover);
  color: var(--oc-fg-default);
}

.settings-workspace__preview-tree-row .is-folder { color: var(--oc-icon-folder-open); }
.settings-workspace__preview-tree-row .is-card-file { color: var(--oc-icon-file-opencard); }
.settings-workspace__preview-tree-row .is-image-file { color: var(--oc-icon-file-image); }

.settings-workspace__preview-scrollbar {
  position: absolute;
  top: 42%;
  right: 2px;
  width: calc(var(--oc-scrollbar-size) / 2);
  height: 28%;
  border-radius: var(--oc-radius-full);
  background: var(--oc-scrollbar-thumb);
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
  justify-content: space-between;
  padding: 0 var(--oc-space-3);
  border-bottom: 1px solid var(--oc-border-muted);
  color: var(--oc-fg-default);
  font-size: var(--oc-text-xs);
}

.settings-workspace__preview-workspace-header > span {
  padding-left: var(--oc-space-2);
  border-left: 2px solid var(--oc-border-accent);
}

.settings-workspace__preview-workspace-header div {
  display: flex;
  gap: var(--oc-space-3);
  color: var(--oc-icon-muted);
}

.settings-workspace__preview-editor {
  min-height: 0;
  display: grid;
  grid-template-columns: 22% minmax(0, 1fr) 28%;
  gap: 1px;
  background: var(--oc-border-muted);
}

.settings-workspace__preview-panel {
  min-width: 0;
  padding: var(--oc-space-3) var(--oc-space-2);
  background: var(--oc-bg-surface);
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-xs);
}

.settings-workspace__preview-panel > strong {
  display: block;
  margin: 0 var(--oc-space-2) var(--oc-space-2);
  color: var(--oc-fg-default);
  font-size: var(--oc-text-xs);
  font-weight: 500;
}

.settings-workspace__preview-canvas {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--oc-bg-base);
}

.settings-workspace__preview-canvas::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, var(--oc-border-default) 0 1px, transparent 1px);
  background-size: 12px 12px;
  opacity: 0.55;
  pointer-events: none;
}

.settings-workspace__preview-document {
  position: relative;
  z-index: 1;
  width: 44%;
  aspect-ratio: 5 / 7;
  overflow: hidden;
  border: 1px solid var(--oc-border-strong);
  border-radius: var(--oc-radius-lg);
  background: var(--oc-bg-accent);
  box-shadow: var(--oc-shadow-md);
  color: var(--oc-accent-fg);
}

.settings-workspace__preview-card-title {
  position: absolute;
  top: 12%;
  left: 12%;
  font-size: var(--oc-text-sm);
  font-weight: 700;
}

.settings-workspace__preview-card-shape {
  position: absolute;
  top: 32%;
  left: 16%;
  width: 68%;
  aspect-ratio: 1;
  border: 2px solid var(--oc-accent-fg);
  border-radius: var(--oc-radius-full);
  transform: rotate(-18deg);
}

.settings-workspace__preview-card-copy {
  position: absolute;
  right: 12%;
  bottom: 12%;
  width: 46%;
  height: 4px;
  border-radius: var(--oc-radius-full);
  background: var(--oc-accent-fg);
}

.settings-workspace__preview-glass {
  position: absolute;
  z-index: 2;
  bottom: var(--oc-space-3);
  left: 50%;
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  min-height: var(--oc-size-sm);
  padding: 0 var(--oc-space-3);
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-full);
  background: var(--oc-bg-glass);
  backdrop-filter: blur(var(--oc-bg-glass-blur)) saturate(var(--oc-bg-glass-saturate));
  box-shadow: var(--oc-shadow-lg);
  color: var(--oc-fg-default);
  transform: translateX(-50%);
}

.settings-workspace__preview-glass strong {
  min-width: 28px;
  font-size: var(--oc-text-xs);
  font-weight: 500;
  text-align: center;
}

.settings-workspace__preview-properties label {
  display: grid;
  gap: var(--oc-space-1);
  margin-bottom: var(--oc-space-2);
}

.settings-workspace__preview-properties label > span {
  color: var(--oc-fg-subtle);
}

.settings-workspace__preview-properties i {
  min-height: var(--oc-size-sm);
  padding: var(--oc-space-1) var(--oc-space-2);
  overflow: hidden;
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-sm);
  background: var(--oc-bg-input);
  color: var(--oc-fg-default);
  font-style: normal;
  text-overflow: ellipsis;
}

.settings-workspace__preview-properties i.is-focused {
  border-color: var(--oc-border-accent);
  box-shadow: var(--oc-focus-ring);
}

.settings-workspace__preview-properties label.is-disabled {
  color: var(--oc-fg-disabled);
  opacity: 0.7;
}

.settings-workspace__preview-status {
  display: flex;
  align-items: center;
  gap: var(--oc-space-1);
  margin-top: var(--oc-space-3);
}

.settings-workspace__preview-status .oc-icon:first-child { color: var(--oc-icon-warning); }
.settings-workspace__preview-status .oc-icon:last-child { color: var(--oc-icon-danger); }

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
