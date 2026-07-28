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
            <span>{{ definition.title }}</span>
          </header>
          <div class="rich-text-string-popover__editor">
            <OcRichTextEditor v-if="editorMode === 'rich'" ref="richTextEditor" :model-value="draftValue"
              :binding-completion="definition.binding?.provider"
              :font-options="definition.fontOptions"
              @update:model-value="draftValue = $event" />
            <OcFieldInput v-else ref="sourceEditor" as="textarea" variant="plain" full-width mono
              class="rich-text-string-popover__source" :value="sourceValue"
              resize="none" autocomplete="off" spellcheck="false"
              aria-label="HTML 源码"
              @input="handleSourceInput" />
          </div>
          <footer class="rich-text-string-popover__footer">
            <OcOptionGroup :model-value="editorMode" :options="editorModeOptions"
              size="md" icon-only appearance="sliding-outline" aria-label="编辑视图"
              @update:model-value="setEditorMode" />
            <span class="rich-text-string-popover__actions">
              <OcButton size="md" icon-only icon="action.close" icon-tone="danger"
                data-tooltip="取消" aria-label="取消富文本编辑" @click="cancelEditor" />
              <OcButton size="md" icon-only icon="action.check" icon-tone="success" variant="soft"
                data-tooltip="保存" aria-label="保存富文本编辑" @click="saveEditor" />
            </span>
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, type ComponentPublicInstance } from 'vue'
import OcButton from '../../../../components/base/OcButton.vue'
import OcFieldInput from '../../../../components/base/OcFieldInput.vue'
import OcOptionGroup, { type OcOption } from '../../../../components/standard/OcOptionGroup.vue'
import { formatRichTextHtmlSource, normalizeRichTextHtml } from '../../../rich-text/richTextHtml'
import OcRichTextEditor from '../../rich-text/OcRichTextEditor.vue'
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
const sourceEditor = ref<{ focus: () => void } | null>(null)
const open = ref(false)
const editorMode = ref<'rich' | 'source'>('rich')
const stringValue = computed(() => (props.value == null ? '' : String(props.value)))
const draftValue = ref('')
const sourceValue = ref('')
const safeStringValue = computed(() => normalizeRichTextHtml(stringValue.value))
const editorModeOptions: readonly OcOption[] = [
  { value: 'rich', label: '富文本', icon: 'format.text-variant-outline' },
  { value: 'source', label: 'HTML 源码', icon: 'format.xml' },
]

async function openEditor(): Promise<void> {
  draftValue.value = stringValue.value
  sourceValue.value = ''
  editorMode.value = 'rich'
  open.value = true
  await nextTick()
  richTextEditor.value?.focus()
}

async function setEditorMode(mode: string): Promise<void> {
  if (mode !== 'rich' && mode !== 'source') return
  if (mode === editorMode.value) return
  if (mode === 'rich') draftValue.value = normalizeRichTextHtml(sourceValue.value)
  else sourceValue.value = formatRichTextHtmlSource(draftValue.value)
  editorMode.value = mode
  await nextTick()
  if (mode === 'rich') richTextEditor.value?.focus()
  else sourceEditor.value?.focus()
}

function handleSourceInput(event: Event): void {
  const target = event.target
  if (target instanceof HTMLTextAreaElement) sourceValue.value = target.value
}

function finishEditing(): void {
  open.value = false
  anchor.value?.querySelector<HTMLButtonElement>('.rich-text-string-field__preview')?.focus()
}

function cancelEditor(): void {
  finishEditing()
}

function saveEditor(): void {
  const normalizedValue = normalizeRichTextHtml(
    editorMode.value === 'source' ? sourceValue.value : draftValue.value,
  )
  if (normalizedValue !== stringValue.value) {
    emit('update:value', normalizedValue)
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
  white-space: pre;
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
  width: min(720px, calc(100vw - 16px));
  height: min(400px, calc(100vh - 16px));
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-surface);
  color: var(--oc-fg-default);
  box-shadow: var(--oc-shadow-lg);
}

.rich-text-string-popover__header {
  display: flex;
  min-height: var(--oc-size-lg);
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding-inline: var(--oc-space-4);
  border-bottom: 1px solid var(--oc-border-default);
  font-size: var(--oc-text-sm);
  font-weight: 600;
}

.rich-text-string-popover__editor {
  min-height: 0;
  flex: 1 1 auto;
}

.rich-text-string-popover__source {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: var(--oc-space-4);
  overflow: auto;
  background: var(--oc-bg-input);
  color: var(--oc-fg-default);
  line-height: 1.55;
}

.rich-text-string-popover__footer {
  display: flex;
  min-height: var(--oc-size-md);
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: var(--oc-space-1);
  padding: var(--oc-space-1) var(--oc-space-2);
  border-top: 1px solid var(--oc-border-default);
  background: var(--oc-bg-raised);
}

.rich-text-string-popover__actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--oc-space-1);
}
</style>
