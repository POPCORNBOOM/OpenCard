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
  <input
    v-else
    class="prop-input"
    type="text"
    :value="stringValue"
    :minlength="definition.minLength"
    :maxlength="definition.maxLength"
    :readonly="definition.isReadonlyForEditor"
    @input="emit('update:value', ($event.target as HTMLInputElement).value)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EditorPropertyDefinition } from '../../../core/Card'

const props = defineProps<{
  definition: Extract<EditorPropertyDefinition, { datatype: 'string' }>
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const stringValue = computed(() => (props.value == null ? '' : String(props.value)))
</script>

<style scoped>
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
</style>
