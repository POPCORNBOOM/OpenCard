<template>
  <OcJsonEditor
    class="object-property-field"
    :model-value="normalizedValue"
    :readonly="definition.isReadonly"
    :min-height="definition.isArray ? 220 : 180"
    @update:model-value="emit('update:value', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EditorPropertyDefinition } from '../../../entities/card/schema'
import { OcJsonEditor } from '../../standard'

const props = defineProps<{
  definition: Extract<EditorPropertyDefinition, { datatype: 'object' }>
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: unknown): void
}>()

const normalizedValue = computed(() => {
  if (props.value !== undefined) {
    return props.value
  }
  return props.definition.isArray ? [] : {}
})
</script>

<style scoped>
.object-property-field {
  width: 100%;
}
</style>
