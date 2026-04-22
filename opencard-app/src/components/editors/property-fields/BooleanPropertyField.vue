<template>
  <input
    class="prop-checkbox"
    type="checkbox"
    :checked="Boolean(value)"
    @change="emit('update:value', ($event.target as HTMLInputElement).checked)"
  />
</template>

<script setup lang="ts">
import type { EditorPropertyDefinition } from '../../../entities/card/schema'

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
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--oc-accent);
}

.prop-checkbox:focus-visible {
  outline: var(--oc-focus-ring-width) solid var(--oc-accent-glow);
  outline-offset: 1px;
}
</style>
