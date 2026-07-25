<template>
  <div :ref="setAnchor" class="rich-text-string-field">
    <button v-if="!definition.isReadonly" type="button" class="rich-text-string-field__preview"
      :aria-expanded="open" @click="openEditor">
      <span v-if="stringValue" class="rich-text-string-field__content" v-html="safeStringValue" />
      <span v-else class="rich-text-string-field__empty">-</span>
    </button>
    <div v-else class="rich-text-string-field__preview rich-text-string-field__preview--readonly">
      <span v-if="stringValue" class="rich-text-string-field__content" v-html="safeStringValue" />
      <span v-else class="rich-text-string-field__empty">-</span>
    </div>

    <Teleport to="body">
      <div v-if="open" class="rich-text-string-dialog-backdrop" @pointerdown.self="cancelEditor">
        <div class="rich-text-string-popover" role="dialog" aria-modal="true" aria-label="富文本编辑器"
          @keydown.esc.stop="cancelEditor">
          <header class="rich-text-string-popover__header">
            <span>富文本</span>
          </header>
          <div class="rich-text-string-popover__editor">
            <OcRichTextEditor ref="richTextEditor" :model-value="draftValue"
              :binding-completion="definition.binding?.provider"
              @update:model-value="draftValue = $event" />
          </div>
          <footer class="rich-text-string-popover__footer">
            <OcButton size="sm" icon-only icon="action.close" icon-tone="danger"
              title="取消" aria-label="取消富文本编辑" @click="cancelEditor" />
            <OcButton size="sm" icon-only icon="action.check" icon-tone="success"
              title="保存" aria-label="保存富文本编辑" @click="saveEditor" />
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, type ComponentPublicInstance } from 'vue'
import OcButton from '../../../../components/base/OcButton.vue'
import OcRichTextEditor from '../../rich-text/OcRichTextEditor.vue'
import { normalizeRichTextHtml } from '../../rich-text/sanitizeRichTextHtml'
import type { PropertyEditorFieldDefinition } from '../propertyEditor.types'

const props = defineProps<{
  definition: Extract<PropertyEditorFieldDefinition, { fieldType: 'string' }>
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const anchor = ref<HTMLElement | null>(null)
const richTextEditor = ref<{ focus: () => void } | null>(null)
const open = ref(false)
const stringValue = computed(() => (props.value == null ? '' : String(props.value)))
const draftValue = ref('')
const safeStringValue = computed(() => normalizeRichTextHtml(stringValue.value))

async function openEditor(): Promise<void> {
  draftValue.value = stringValue.value
  open.value = true
  await nextTick()
  richTextEditor.value?.focus()
}

function finishEditing(): void {
  open.value = false
  anchor.value?.querySelector<HTMLButtonElement>('.rich-text-string-field__preview')?.focus()
}

function cancelEditor(): void {
  finishEditing()
}

function saveEditor(): void {
  if (draftValue.value !== stringValue.value) {
    emit('update:value', draftValue.value)
  }
  finishEditing()
}

function setAnchor(element: Element | ComponentPublicInstance | null): void {
  anchor.value = element instanceof HTMLElement ? element : null
}

</script>

<style scoped>
.rich-text-string-field {
  width: 100%;
  min-width: 0;
}

.rich-text-string-field__preview {
  display: block;
  width: 100%;
  height: var(--oc-property-row-height);
  min-width: 0;
  padding: var(--oc-space-1) var(--oc-space-2);
  overflow: hidden;
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-sm);
  background: var(--oc-bg-input);
  color: var(--oc-fg-default);
  text-align: start;
  white-space: nowrap;
  cursor: text;
}

.rich-text-string-field__preview:not(.rich-text-string-field__preview--readonly):hover {
  border-color: var(--oc-border-strong);
}

.rich-text-string-field__preview:focus-visible {
  border-color: var(--oc-border-strong);
  outline: none;
  box-shadow: var(--oc-focus-ring);
}

.rich-text-string-field__content {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rich-text-string-field__content :deep(p),
.rich-text-string-field__content :deep(br) {
  display: inline;
  margin: 0;
}

.rich-text-string-field__content :deep(p + p)::before {
  content: ' ';
}

.rich-text-string-field__empty {
  color: var(--oc-fg-muted);
}
</style>

<style>
.rich-text-string-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2400;
  display: grid;
  place-items: center;
  padding: 8px;
  background: rgb(0 0 0 / 16%);
}

.rich-text-string-popover {
  width: min(520px, calc(100vw - 16px));
  height: min(320px, calc(100vh - 16px));
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--oc-border-strong);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-surface);
  color: var(--oc-fg-default);
  box-shadow: var(--oc-shadow-lg);
}

.rich-text-string-popover__header {
  display: flex;
  min-height: var(--oc-size-md);
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding-inline-start: var(--oc-space-2);
  border-bottom: 1px solid var(--oc-border-default);
  font-size: var(--oc-text-sm);
  font-weight: 600;
}

.rich-text-string-popover__editor {
  min-height: 0;
  flex: 1 1 auto;
}

.rich-text-string-popover__footer {
  display: flex;
  min-height: var(--oc-size-md);
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: var(--oc-space-1);
  padding: var(--oc-space-1) var(--oc-space-2);
  border-top: 1px solid var(--oc-border-default);
}
</style>
