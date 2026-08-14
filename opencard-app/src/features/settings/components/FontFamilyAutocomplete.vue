<template>
  <div ref="rootRef" class="font-family-autocomplete">
    <OcFieldInput
      class="font-family-autocomplete__input"
      size="sm"
      full-width
      type="text"
      :value="draftValue"
      :placeholder="placeholder"
      autocomplete="off"
      spellcheck="false"
      role="combobox"
      aria-autocomplete="list"
      :aria-label="label"
      :aria-expanded="menuOpen"
      :aria-controls="autocompleteId"
      @focus="handleFocus"
      @input="handleInput"
      @blur="handleBlur"
      @keydown="handleKeydown"
    />
    <OcAutocompletePopover
      :id="autocompleteId"
      :open="menuOpen"
      :anchor="rootRef"
      :items="suggestions"
      :active-key="activeKey"
      @select="acceptSuggestion"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import OcFieldInput from '../../../components/base/OcFieldInput.vue'
import OcAutocompletePopover from '../../../components/standard/OcAutocompletePopover.vue'

const props = defineProps<{
  modelValue: string
  fontFamilies: readonly string[]
  label: string
  placeholder: string
}>()

const emit = defineEmits<{
  commit: [value: string]
}>()

const rootRef = ref<HTMLElement | null>(null)
const activeInput = ref<HTMLInputElement | null>(null)
const draftValue = ref(props.modelValue === 'system' ? '' : props.modelValue)
const cursor = ref(draftValue.value.length)
const menuOpen = ref(false)
const activeKey = ref<string | null>(null)
const autocompleteId = useId()

const segment = computed(() => {
  const value = draftValue.value
  const position = Math.min(cursor.value, value.length)
  const start = value.lastIndexOf(';', Math.max(0, position - 1)) + 1
  const nextSeparator = value.indexOf(';', position)
  const end = nextSeparator < 0 ? value.length : nextSeparator
  return { start, end, fragment: value.slice(start, position).trim().toLocaleLowerCase() }
})

const suggestions = computed(() => props.fontFamilies
  .filter(fontFamily => !segment.value.fragment
    || fontFamily.toLocaleLowerCase().includes(segment.value.fragment))
  .map(fontFamily => ({
    key: fontFamily,
    label: fontFamily,
    labelStyle: { fontFamily },
  })))

watch(() => props.modelValue, (value) => {
  const nextValue = value === 'system' ? '' : value
  if (nextValue !== draftValue.value) draftValue.value = nextValue
})

watch(suggestions, (items) => {
  activeKey.value = items.some(item => item.key === activeKey.value)
    ? activeKey.value
    : (items[0]?.key ?? null)
})

function refresh(control: HTMLInputElement): void {
  activeInput.value = control
  cursor.value = control.selectionStart ?? control.value.length
  menuOpen.value = suggestions.value.length > 0
  activeKey.value = suggestions.value[0]?.key ?? null
}

function handleFocus(event: FocusEvent): void {
  refresh(event.target as HTMLInputElement)
}

function handleInput(event: Event): void {
  const control = event.target as HTMLInputElement
  draftValue.value = control.value
  refresh(control)
}

function commit(): void {
  emit('commit', draftValue.value.trim() || 'system')
}

function handleBlur(): void {
  window.setTimeout(() => {
    menuOpen.value = false
    commit()
  }, 0)
}

function acceptSuggestion(fontFamily: string): void {
  const { start, end } = segment.value
  const prefix = draftValue.value.slice(0, start)
  const insertion = start > 0 ? ` ${fontFamily}` : fontFamily
  draftValue.value = `${prefix}${insertion}${draftValue.value.slice(end)}`
  menuOpen.value = false
  const nextCursor = prefix.length + insertion.length
  void nextTick(() => {
    activeInput.value?.focus()
    activeInput.value?.setSelectionRange(nextCursor, nextCursor)
    cursor.value = nextCursor
  })
}

function moveActive(offset: 1 | -1): void {
  if (!suggestions.value.length) return
  const current = Math.max(0, suggestions.value.findIndex(item => item.key === activeKey.value))
  activeKey.value = suggestions.value[
    (current + offset + suggestions.value.length) % suggestions.value.length
  ]?.key ?? null
}

function handleKeydown(event: KeyboardEvent): void {
  if (menuOpen.value && event.key === 'ArrowDown') {
    event.preventDefault()
    moveActive(1)
  } else if (menuOpen.value && event.key === 'ArrowUp') {
    event.preventDefault()
    moveActive(-1)
  } else if (menuOpen.value && (event.key === 'Enter' || event.key === 'Tab') && activeKey.value) {
    event.preventDefault()
    acceptSuggestion(activeKey.value)
  } else if (event.key === 'Escape') {
    menuOpen.value = false
  } else if (event.key === 'Enter') {
    event.preventDefault()
    activeInput.value?.blur()
  }
}
</script>

<style scoped>
.font-family-autocomplete {
  width: min(320px, 48vw);
  min-width: 0;
}

.font-family-autocomplete__input {
  width: 100%;
}
</style>
