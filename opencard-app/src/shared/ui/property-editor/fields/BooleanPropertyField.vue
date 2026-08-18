<template>
  <div class="boolean-field">
    <OcSwitch
      :checked="value === 'true'"
      :disabled="definition.isReadonly"
      @update:checked="emit('update:value', String($event))"
    />
  </div>
</template>

<script setup lang="ts">
import OcSwitch from '../../../../components/base/OcSwitch.vue'
import type { PropertyEditorFieldDefinition } from '../propertyEditor.types'

defineProps<{
  definition: Extract<PropertyEditorFieldDefinition, { fieldType: 'boolean' }>
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
  min-height: var(--oc-field-control-height, var(--oc-size-md));
}
</style>
