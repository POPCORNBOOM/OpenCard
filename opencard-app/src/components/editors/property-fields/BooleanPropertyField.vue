<template>
  <input
    class="prop-checkbox"
    type="checkbox"
    :checked="Boolean(value)"
    @change="emit('update:value', ($event.target as HTMLInputElement).checked)"
  />
</template>

<script setup lang="ts">
import type { EditorPropertyDefinition } from '../../../core/propertyEditorSchema'

defineProps<{
  definition: Extract<EditorPropertyDefinition, { datatype: 'boolean' }>
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: boolean): void
}>()
</script>

<style scoped>
.prop-checkbox {
  justify-self: flex-start;
}
</style>
