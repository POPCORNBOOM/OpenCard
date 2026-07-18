<template>
  <div class="reference-string-field">
    <OcFieldFrame v-if="definition.multiline" class="reference-string-field__multiline" full-width>
      <OcFieldInput
        as="textarea"
        variant="plain"
        full-width
        class="reference-string-field__input"
        :value="draftValue"
        :minlength="definition.minLength"
        :maxlength="definition.maxLength"
        resize="none"
        autocomplete="off"
        spellcheck="false"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="isMenuOpen"
        :aria-controls="autocompleteId"
        :aria-activedescendant="activeDescendantId"
        @focus="handleFocus"
        @blur="handleBlur"
        @click="handleCursorChange"
        @input="handleInput"
        @keydown="handleKeydown"
      />
    </OcFieldFrame>

    <OcFieldFrame v-else class="reference-string-field__singleline" full-width>
      <OcFieldInput
        as="input"
        variant="plain"
        full-width
        class="reference-string-field__input"
        type="text"
        :value="draftValue"
        :minlength="definition.minLength"
        :maxlength="definition.maxLength"
        autocomplete="off"
        spellcheck="false"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="isMenuOpen"
        :aria-controls="autocompleteId"
        :aria-activedescendant="activeDescendantId"
        @focus="handleFocus"
        @blur="handleBlur"
        @click="handleCursorChange"
        @input="handleInput"
        @keydown="handleKeydown"
      />
      <div v-if="ghostSuffix && !isMenuOpen" class="reference-string-field__ghost" aria-hidden="true">
        <span class="reference-string-field__ghost-current">{{ draftValue }}</span>
        <span>{{ ghostSuffix }}</span>
      </div>
    </OcFieldFrame>

    <OcAutocompletePopover
      :id="autocompleteId"
      :open="isMenuOpen"
      :anchor="activeInput"
      :items="suggestions"
      :active-key="activeKey"
      @select="acceptSuggestionByKey"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import type { EditorPropertyDefinition } from '../../../entities/card/schema'
import {
  applyReferenceCompletion,
  resolveReferenceCompletion,
  type ReferenceCompletionContext,
  type ReferenceCompletionState,
  type ReferenceCompletionSuggestion,
} from '../../../features/editor-runtime/services/referenceCompletion'
import OcAutocompletePopover from '../../standard/OcAutocompletePopover.vue'
import OcFieldFrame from '../../base/OcFieldFrame.vue'
import OcFieldInput from '../../base/OcFieldInput.vue'

type StringDefinition = Extract<EditorPropertyDefinition, { datatype: 'string' }>
type TextControl = HTMLInputElement | HTMLTextAreaElement

const props = defineProps<{
  definition: StringDefinition
  value: unknown
  referenceContext?: ReferenceCompletionContext
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const draftValue = ref(props.value == null ? '' : String(props.value))
const activeInput = ref<TextControl | null>(null)
const completionState = ref<ReferenceCompletionState | null>(null)
const isMenuOpen = ref(false)
const activeKey = ref<string | null>(null)
const autocompleteId = useId()

const suggestions = computed(() => completionState.value?.suggestions ?? [])
const activeDescendantId = computed(() => {
  if (!activeKey.value) return undefined
  return autocompleteId + '-option-' + activeKey.value.replace(/[^a-zA-Z0-9_-]/g, '-')
})

const autocompleteMatch = computed(() => {
  const current = draftValue.value
  const values = props.definition.autocomplete ?? []
  if (!current) return ''

  const trailingMatch = current.match(/([a-z%]+)$/i)
  const fragment = trailingMatch?.[1] ?? current
  const prefix = trailingMatch ? current.slice(0, -fragment.length) : ''

  return [...values]
    .filter((suggestion) => suggestion.length > fragment.length
      && suggestion.toLowerCase().startsWith(fragment.toLowerCase()))
    .sort((left, right) => left.length - right.length
      || left.localeCompare(right, undefined, { sensitivity: 'base' }))
    .map((suggestion) => `${prefix}${suggestion}`)[0] ?? ''
})

const ghostSuffix = computed(() => {
  const suggestion = autocompleteMatch.value
  if (!suggestion || !draftValue.value) return ''
  return suggestion.slice(draftValue.value.length)
})

watch(() => props.value, (value) => {
  const nextValue = value == null ? '' : String(value)
  if (nextValue !== draftValue.value) {
    draftValue.value = nextValue
  }
})

watch(suggestions, (items) => {
  if (items.some((item) => item.key === activeKey.value)) {
    return
  }
  activeKey.value = items[0]?.key ?? null
})

function refreshCompletion(control: TextControl): void {
  activeInput.value = control
  const cursor = control.selectionStart ?? draftValue.value.length
  completionState.value = resolveReferenceCompletion(
    draftValue.value,
    cursor,
    props.referenceContext,
  )
  isMenuOpen.value = Boolean(completionState.value?.suggestions.length)
  activeKey.value = suggestions.value[0]?.key ?? null
}

function emitValue(value: string): void {
  draftValue.value = value
  emit('update:value', value)
}

function setCursor(control: TextControl, cursor: number): void {
  nextTick(() => {
    control.focus()
    control.setSelectionRange(cursor, cursor)
  })
}

function handleInput(event: Event): void {
  const control = event.target as TextControl
  activeInput.value = control
  const inputEvent = event as InputEvent
  let nextValue = control.value
  let cursor = control.selectionStart ?? nextValue.length

  if (
    inputEvent.inputType === 'insertText'
    && inputEvent.data === '{'
    && nextValue.slice(Math.max(0, cursor - 2), cursor) === '{{'
    && nextValue.slice(cursor, cursor + 2) !== '}}'
  ) {
    nextValue = `${nextValue.slice(0, cursor)}}}${nextValue.slice(cursor)}`
    control.value = nextValue
    setCursor(control, cursor)
  }

  emitValue(nextValue)
  completionState.value = resolveReferenceCompletion(nextValue, cursor, props.referenceContext)
  isMenuOpen.value = Boolean(completionState.value?.suggestions.length)
  activeKey.value = suggestions.value[0]?.key ?? null
}

function handleFocus(event: FocusEvent): void {
  refreshCompletion(event.target as TextControl)
}

function handleCursorChange(event: MouseEvent): void {
  refreshCompletion(event.target as TextControl)
}

function handleBlur(): void {
  window.setTimeout(() => {
    if (document.activeElement !== activeInput.value) {
      isMenuOpen.value = false
    }
  }, 0)
}

function acceptSuggestionByKey(key: string): void {
  const suggestion = suggestions.value.find((item) => item.key === key)
  if (suggestion) {
    acceptSuggestion(suggestion)
  }
}

function acceptSuggestion(suggestion: ReferenceCompletionSuggestion): void {
  const state = completionState.value
  const control = activeInput.value
  if (!state || !control) return

  const edit = applyReferenceCompletion(draftValue.value, state, suggestion)
  emitValue(edit.value)
  control.value = edit.value
  setCursor(control, edit.cursor)

  if (suggestion.kind === 'scope') {
    completionState.value = resolveReferenceCompletion(edit.value, edit.cursor, props.referenceContext)
    isMenuOpen.value = Boolean(completionState.value?.suggestions.length)
    activeKey.value = suggestions.value[0]?.key ?? null
  } else {
    completionState.value = null
    isMenuOpen.value = false
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (isMenuOpen.value && suggestions.value.length > 0) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const currentIndex = Math.max(0, suggestions.value.findIndex((item) => item.key === activeKey.value))
      activeKey.value = suggestions.value[(currentIndex + 1) % suggestions.value.length]?.key ?? null
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      const currentIndex = Math.max(0, suggestions.value.findIndex((item) => item.key === activeKey.value))
      activeKey.value = suggestions.value[
        (currentIndex - 1 + suggestions.value.length) % suggestions.value.length
      ]?.key ?? null
      return
    }
    if (event.key === 'Tab' || event.key === 'Enter') {
      event.preventDefault()
      if (activeKey.value) acceptSuggestionByKey(activeKey.value)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      isMenuOpen.value = false
      return
    }
  }

  if (event.key === 'Tab' && autocompleteMatch.value) {
    event.preventDefault()
    emitValue(autocompleteMatch.value)
  }
}
</script>

<style scoped>
.reference-string-field {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}

.reference-string-field__multiline {
  height: var(--oc-property-row-height);
  transition: height var(--oc-duration-normal) var(--oc-ease);
}

.reference-string-field__multiline:focus-within {
  height: var(--oc-property-row-expanded-height);
}

.reference-string-field__input {
  width: 100%;
  height: 100%;
  border: 0;
  padding: var(--oc-space-1) var(--oc-space-2);
  background: transparent;
}

.reference-string-field__multiline :deep(.reference-string-field__input) {
  padding: var(--oc-space-2);
  overflow-y: auto;
}

.reference-string-field__ghost {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding: var(--oc-space-1) var(--oc-space-2);
  color: var(--oc-fg-disabled);
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
}

.reference-string-field__ghost-current {
  visibility: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .reference-string-field__multiline {
    transition: none;
  }
}
</style>
