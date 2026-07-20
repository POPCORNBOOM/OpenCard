<template>
  <div class="boolean-field">
    <OcCheckbox
      :checked="value === 'true'"
      :disabled="definition.isReadonly"
      @update:checked="emit('update:value', String($event))"
    />
  </div>
</template>

<script setup lang="ts">
import OcCheckbox from '../../base/OcCheckbox.vue'
import type { EditorPropertyDefinition } from '../../../entities/card/schema'

defineProps<{
  definition: Extract<EditorPropertyDefinition, { fieldType: 'boolean' }>
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
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
