<template>
  <OcCheckbox
    class="prop-checkbox"
    :checked="Boolean(value)"
    @update:checked="emit('update:value', $event)"
  />
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
.prop-checkbox {
  justify-self: flex-start;
}
</style>
