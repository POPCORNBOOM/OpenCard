<template>
  <span class="prop-unsupported">
    {{ summary }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EditorPropertyDefinition } from '../../../core/Card'

const props = defineProps<{
  definition: Extract<EditorPropertyDefinition, { datatype: 'object' }>
  value: unknown
}>()

const summary = computed(() => {
  if (props.definition.isArray && Array.isArray(props.value)) {
    return `${props.value.length} item(s)`
  }
  return '[object]'
})
</script>

<style scoped>
.prop-unsupported {
  color: #888;
  font-size: 12px;
}
</style>
