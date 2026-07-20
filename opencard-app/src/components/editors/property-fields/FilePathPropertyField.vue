<!--
  使用说明：
  - 输入已解析的 filePath definition 与当前值。
  - 动态候选完全由 definition.completion.provider 提供。

  职责边界：
  - 负责路径文本、候选菜单、键盘选择和异步请求竞态处理。
  - 不读取 Project Store，不查询文件系统，不解释 extension 业务规则。
-->
<template>
  <div class="file-path-field">
    <OcFieldInput
      ref="inputElement"
      as="input"
      full-width
      :value="stringValue"
      :minlength="definition.minLength"
      :maxlength="definition.maxLength"
      :readonly="definition.isReadonly"
      autocomplete="off"
      spellcheck="false"
      role="combobox"
      aria-autocomplete="list"
      aria-haspopup="listbox"
      :aria-expanded="isMenuOpen && items.length > 0"
      :aria-controls="autocompleteId"
      :aria-activedescendant="activeDescendantId"
      @focus="handleFocus"
      @blur="handleBlur"
      @input="handleInput"
      @keydown="handleKeydown"
    />

    <OcAutocompletePopover
      :id="autocompleteId"
      :open="isMenuOpen"
      :anchor="activeInput"
      :items="items"
      :active-key="activeKey"
      @select="applySuggestionByKey"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import type {
  PropertyCompletionItem,
  PropertyCompletionResult,
  PropertyEditorFieldDefinition,
} from '../propertyEditor.types'
import OcAutocompletePopover from '../../standard/OcAutocompletePopover.vue'
import OcFieldInput from '../../base/OcFieldInput.vue'

type FilePathDefinition = Extract<PropertyEditorFieldDefinition, { fieldType: 'filePath' }>
type FocusableInput = { focus: () => void }

const props = defineProps<{
  definition: FilePathDefinition
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const inputElement = ref<FocusableInput | null>(null)
const activeInput = ref<HTMLInputElement | null>(null)
const completionResult = ref<PropertyCompletionResult | null>(null)
const items = ref<readonly PropertyCompletionItem[]>([])
const isFocused = ref(false)
const isMenuOpen = ref(false)
const activeKey = ref<string | null>(null)
const autocompleteId = useId()
let requestId = 0

const stringValue = computed(() => (props.value == null ? '' : String(props.value)).replace(/\\/g, '/'))
const activeDescendantId = computed(() => activeKey.value
  ? `${autocompleteId}-option-${activeKey.value.replace(/[^a-zA-Z0-9_-]/g, '-')}`
  : undefined)

watch(items, (nextItems) => {
  if (!nextItems.some((item) => item.key === activeKey.value)) {
    activeKey.value = nextItems[0]?.key ?? null
  }
})

async function refreshCompletion(value: string, cursor: number): Promise<void> {
  const provider = props.definition.completion?.provider
  if (!provider || props.definition.isReadonly) {
    completionResult.value = null
    items.value = []
    isMenuOpen.value = false
    return
  }

  const currentRequest = ++requestId
  const result = await provider({ value, cursor })
  if (currentRequest !== requestId) return
  completionResult.value = result
  items.value = result?.items ?? []
  isMenuOpen.value = isFocused.value && items.value.length > 0
}

function handleInput(event: Event): void {
  const control = event.target as HTMLInputElement
  activeInput.value = control
  const value = control.value.replace(/\\/g, '/')
  emit('update:value', value)
  void refreshCompletion(value, control.selectionStart ?? value.length)
}

function handleFocus(event: FocusEvent): void {
  const control = event.target as HTMLInputElement
  activeInput.value = control
  isFocused.value = true
  void refreshCompletion(stringValue.value, control.selectionStart ?? stringValue.value.length)
}

function handleBlur(): void {
  isFocused.value = false
  window.setTimeout(() => {
    if (!isFocused.value) isMenuOpen.value = false
  }, 0)
}

function applySuggestionByKey(key: string): void {
  const item = items.value.find((candidate) => candidate.key === key)
  const result = completionResult.value
  if (!item || !result) return

  const nextValue = typeof item.value === 'string'
    ? item.value
    : `${stringValue.value.slice(0, result.replaceStart)}${item.insertText}${stringValue.value.slice(result.replaceEnd)}`
  emit('update:value', nextValue)

  if (item.keepOpen) {
    isMenuOpen.value = true
    window.setTimeout(() => {
      inputElement.value?.focus()
      void refreshCompletion(nextValue, nextValue.length)
    }, 0)
  } else {
    isMenuOpen.value = false
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    isMenuOpen.value = false
    return
  }
  if (items.value.length === 0) return

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const currentIndex = Math.max(0, items.value.findIndex((item) => item.key === activeKey.value))
    const delta = event.key === 'ArrowDown' ? 1 : -1
    activeKey.value = items.value[(currentIndex + delta + items.value.length) % items.value.length]?.key ?? null
    isMenuOpen.value = true
    return
  }

  if (event.key === 'Tab' || event.key === 'Enter') {
    if (!activeKey.value) return
    event.preventDefault()
    applySuggestionByKey(activeKey.value)
  }
}
</script>

<style scoped>
.file-path-field {
  position: relative;
  flex: 1;
  min-width: 0;
}
</style>
