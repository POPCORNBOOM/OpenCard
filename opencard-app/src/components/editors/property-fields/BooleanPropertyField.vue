<template>
  <div class="boolean-field">
    <OcCheckbox
      :checked="Boolean(value)"
      :disabled="definition.isReadonly"
      @update:checked="emit('update:value', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import OcCheckbox from '../../base/OcCheckbox.vue'
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
.boolean-field {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: var(--oc-size-md);
}
</style>
