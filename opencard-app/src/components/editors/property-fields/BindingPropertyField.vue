<template>
  <div ref="rootRef" class="binding-property-field" :class="{ 'is-bound': isBound }"
    @focusout="handleFocusOut" @keydown.esc="closePicker">
    <template v-if="isBound">
      <button class="binding-property-field__value" type="button" :title="bindingToken" @click="togglePicker">
        <OcIcon name="data.variable" tone="primary" size="sm" />
        <span>{{ bindingLabel }}</span>
        <code>{{ bindingToken }}</code>
      </button>
      <OcButton icon-only size="sm" variant="ghost" icon="action.discard"
        :title="clearTitle" :aria-label="clearTitle" @click="emit('clear')" />
    </template>
    <OcButton v-else icon-only size="sm" variant="ghost" icon="data.variable"
      :title="bindTitle" :aria-label="bindTitle" :disabled="!provider"
      @click="togglePicker" />

    <OcFloatingLayer :open="pickerOpen" :anchor="rootRef" placement="bottom-end" :max-height="320"
      class="binding-property-field__floating">
      <div class="binding-property-field__menu" role="menu">
        <button v-for="item in items" :key="item.key" type="button" role="menuitem"
          @click="selectItem(item)">
          <OcIcon :name="item.icon ?? 'data.variable'" size="sm" />
          <span>{{ item.label }}</span>
          <code>{{ item.detail ?? item.insertText }}</code>
        </button>
      </div>
    </OcFloatingLayer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { isBindingExpression } from '../../../features/editor-runtime/model/binding'
import type {
  PropertyCompletionItem,
  PropertyCompletionProvider,
  PropertyCompletionResult,
} from '../propertyEditor.types'
import { OcButton } from '../../base'
import OcIcon from '../../base/OcIcon.vue'
import OcFloatingLayer from '../../standard/OcFloatingLayer.vue'

const props = defineProps<{
  value: unknown
  provider?: PropertyCompletionProvider
  bindTitle: string
  clearTitle: string
}>()

const emit = defineEmits<{
  'update:value': [value: unknown]
  clear: []
}>()

const rootRef = ref<HTMLElement | null>(null)
const pickerOpen = ref(false)
const query = ref('{{}}')
const queryCursor = ref(2)
const items = ref<readonly PropertyCompletionItem[]>([])
const completionResult = ref<PropertyCompletionResult | null>(null)
const isBound = computed(() => isBindingExpression(props.value))
const bindingToken = computed(() => typeof props.value === 'string' ? props.value : '')

const bindingLabel = computed(() => {
  if (!isBound.value || typeof props.value !== 'string') return ''
  const token = props.value.replace(/^\s*\{\{\s*|\s*\}\}\s*$/g, '')
  const separator = token.indexOf(':')
  return separator < 1 ? token : token.slice(separator + 1).trim()
})

let requestId = 0

async function refreshItems(): Promise<void> {
  if (!props.provider) {
    items.value = []
    completionResult.value = null
    return
  }
  const currentRequest = ++requestId
  const result = await props.provider({ value: query.value, cursor: queryCursor.value })
  if (currentRequest !== requestId) return
  completionResult.value = result
  items.value = result?.items ?? []
}

function togglePicker(): void {
  if (!props.provider) return
  pickerOpen.value = !pickerOpen.value
  if (pickerOpen.value) {
    query.value = '{{}}'
    queryCursor.value = 2
    void refreshItems()
  }
}

function closePicker(): void {
  pickerOpen.value = false
  items.value = []
  completionResult.value = null
}

function handleFocusOut(): void {
  window.setTimeout(() => {
    if (!rootRef.value?.contains(document.activeElement)) closePicker()
  }, 0)
}

function selectItem(item: PropertyCompletionItem): void {
  if (item.value !== undefined) {
    emit('update:value', item.value)
    closePicker()
    return
  }

  const result = completionResult.value
  if (!result) return
  query.value = `${query.value.slice(0, result.replaceStart)}${item.insertText}${query.value.slice(result.replaceEnd)}`
  queryCursor.value = result.replaceStart + item.insertText.length
  void refreshItems()
}
</script>

<style scoped>
.binding-property-field {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 0 auto;
  min-width: var(--oc-size-sm);
}

.binding-property-field.is-bound {
  flex: 1 1 auto;
  gap: var(--oc-space-1);
  min-width: 0;
}

.binding-property-field__value {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--oc-space-2);
  width: 100%;
  min-width: 0;
  height: var(--oc-size-md);
  padding: 0 var(--oc-space-2);
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-sm);
  background: var(--oc-bg-input);
  color: var(--oc-fg-default);
  cursor: pointer;
}

.binding-property-field__value span,
.binding-property-field__value code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.binding-property-field__value code {
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-xs);
}

.binding-property-field__menu {
  min-width: 220px;
  max-height: inherit;
  overflow: auto;
  padding: var(--oc-space-1);
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-sm);
  background: var(--oc-bg-overlay);
  box-shadow: var(--oc-shadow-lg);
}

.binding-property-field__menu button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--oc-space-2);
  width: 100%;
  min-height: var(--oc-size-md);
  padding: 0 var(--oc-space-2);
  border: 0;
  border-radius: var(--oc-radius-sm);
  background: transparent;
  color: var(--oc-fg-default);
  text-align: left;
  cursor: pointer;
}

.binding-property-field__menu button:hover,
.binding-property-field__menu button:focus-visible {
  background: var(--oc-bg-hover);
  outline: 0;
}

.binding-property-field__menu button span,
.binding-property-field__menu button code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.binding-property-field__menu button code {
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-xs);
}
</style>
