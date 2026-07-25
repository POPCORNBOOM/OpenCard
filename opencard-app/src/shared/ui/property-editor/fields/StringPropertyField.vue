<template>
  <div v-if="definition.isReadonly" class="readonly-value" :title="stringValue || '-'">
    {{ stringValue || '-' }}
  </div>
  <OcSelect v-else-if="definition.options?.length" :model-value="stringValue"
    :options="selectOptions" full-width @update:model-value="emit('update:value', $event)" />
  <OcFieldFrame v-else-if="definition.multiline" class="multiline-field" full-width>
    <OcFieldInput as="textarea" variant="plain" full-width class="multiline-field__input"
      :value="stringValue" :minlength="definition.minLength" :maxlength="definition.maxLength"
      resize="none" @input="emit('update:value', ($event.target as HTMLTextAreaElement).value)" />
  </OcFieldFrame>
  <OcFieldFrame v-else class="autocomplete-field" full-width>
    <OcFieldInput
      as="input"
      variant="plain"
      full-width
      class="autocomplete-input"
      input-class="autocomplete-input"
      type="text"
      :value="stringValue"
      :minlength="definition.minLength"
      :maxlength="definition.maxLength" :readonly="definition.isReadonly"
      @input="emit('update:value', ($event.target as HTMLInputElement).value)"
      @keydown="handleKeydown"
    />
    <div v-if="ghostSuffix" class="autocomplete-ghost" aria-hidden="true">
      <span class="autocomplete-current">{{ stringValue }}</span>
      <span>{{ ghostSuffix }}</span>
    </div>
  </OcFieldFrame>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcFieldFrame from '../../../../components/base/OcFieldFrame.vue'
import OcFieldInput from '../../../../components/base/OcFieldInput.vue'
import OcSelect from '../../../../components/standard/OcSelect.vue'
import type { PropertyEditorFieldDefinition } from '../propertyEditor.types'

const props = defineProps<{
  definition: Extract<PropertyEditorFieldDefinition, { fieldType: 'string' }>
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const stringValue = computed(() => (props.value == null ? '' : String(props.value)))
const selectOptions = computed(() => (
  props.definition.options?.map(option => ({ value: option, label: option })) ?? []
))

const autocompleteMatch = computed(() => {
  const current = stringValue.value
  const suggestions = props.definition.completion?.static?.values ?? []
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
  if (event.key !== 'Tab' || !autocompleteMatch.value || props.definition.isReadonly) {
    return
  }

  event.preventDefault()
  emit('update:value', autocompleteMatch.value)
}
</script>

<style scoped>
.multiline-field {
  flex: 1 1 auto;
  height: var(--oc-property-row-height);
  transition:
    height var(--oc-duration-normal) var(--oc-ease),
    border-color var(--oc-duration-fast) var(--oc-ease);
}

.multiline-field:focus-within {
  height: var(--oc-property-row-expanded-height);
}

.multiline-field :deep(.multiline-field__input) {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: var(--oc-space-2);
  overflow-y: auto;
  border: 0;
  line-height: 1.45;
}

.multiline-field :deep(.multiline-field__input:focus),
.multiline-field :deep(.multiline-field__input:focus-visible) {
  border-color: transparent;
}

.autocomplete-field {
  flex: 1 1 auto;
}

.autocomplete-field :deep(.autocomplete-input) {
  width: 100%;
  height: 100%;
  align-self: stretch;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  background: transparent;
  border: 0;
  padding: var(--oc-space-1) var(--oc-space-2);
  line-height: normal;
}

.autocomplete-ghost {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding: var(--oc-space-1) var(--oc-space-2);
  font-size: var(--oc-text-base);
  line-height: normal;
  color: var(--oc-fg-disabled);
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
}

.autocomplete-current {
  visibility: hidden;
}

.readonly-value {
  flex: 1;
  min-width: 0;
  padding: var(--oc-space-1) var(--oc-space-2);
  font-size: var(--oc-text-base);
  line-height: 1.4;
  color: var(--oc-fg-default);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .multiline-field {
    transition: none;
  }
}
</style>
