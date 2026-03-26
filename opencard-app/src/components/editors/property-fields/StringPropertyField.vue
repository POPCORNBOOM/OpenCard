<template>
  <select
    v-if="definition.options?.length"
    class="prop-input"
    :value="stringValue"
    :disabled="definition.isReadonlyForEditor"
    @change="emit('update:value', ($event.target as HTMLSelectElement).value)"
  >
    <option v-for="option in definition.options" :key="option" :value="option">
      {{ option }}
    </option>
  </select>
  <div v-else class="autocomplete-field">
    <input
      class="prop-input autocomplete-input"
      type="text"
      :value="stringValue"
      :minlength="definition.minLength"
      :maxlength="definition.maxLength"
      :readonly="definition.isReadonlyForEditor"
      @input="emit('update:value', ($event.target as HTMLInputElement).value)"
      @keydown="handleKeydown"
    />
    <div v-if="ghostSuffix" class="autocomplete-ghost" aria-hidden="true">
      <span class="autocomplete-current">{{ stringValue }}</span>
      <span>{{ ghostSuffix }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EditorPropertyDefinition } from '../../../core/propertyEditorSchema'

const props = defineProps<{
  definition: Extract<EditorPropertyDefinition, { datatype: 'string' }>
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const stringValue = computed(() => (props.value == null ? '' : String(props.value)))

const autocompleteMatch = computed(() => {
  const current = stringValue.value
  const suggestions = props.definition.autocomplete ?? []
  if (!current) return ''

  const trailingMatch = current.match(/([a-z%]+)$/i)
  const fragment = trailingMatch?.[1] ?? current
  const prefix = trailingMatch ? current.slice(0, -fragment.length) : ''

  return [...suggestions]
    .filter((suggestion) =>
      suggestion.length > fragment.length &&
      suggestion.toLowerCase().startsWith(fragment.toLowerCase())
    )
    .sort((left, right) => {
      if (left.length !== right.length) {
        return left.length - right.length
      }
      return left.localeCompare(right, undefined, { sensitivity: 'base' })
    })
    .map((suggestion) => `${prefix}${suggestion}`)[0] ?? ''
})

const ghostSuffix = computed(() => {
  const suggestion = autocompleteMatch.value
  const current = stringValue.value
  if (!suggestion || !current) return ''
  return suggestion.slice(current.length)
})

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !autocompleteMatch.value || props.definition.isReadonlyForEditor) {
    return
  }

  event.preventDefault()
  emit('update:value', autocompleteMatch.value)
}
</script>

<style scoped>
.autocomplete-field {
  display: flex;
  align-items: center;
  position: relative;
  flex: 1;
  min-width: 0;
  background: #3c3c3c;
  border: 1px solid #555;
  box-sizing: border-box;
}

.prop-input {
  flex: 1;
  background: #3c3c3c;
  border: 1px solid #555;
  color: #ccc;
  padding: 2px 6px;
  font-size: 12px;
  min-width: 0;
}

.prop-input:focus {
  border-color: #007acc;
  outline: none;
}

.autocomplete-input {
  width: 100%;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  background: transparent;
  border: 0;
  padding: 2px 6px;
  line-height: normal;
}

.autocomplete-ghost {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding: 2px 6px;
  font-size: 12px;
  line-height: normal;
  color: #6f6f6f;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
}

.autocomplete-field:focus-within {
  border-color: #007acc;
}

.autocomplete-current {
  visibility: hidden;
}
</style>
