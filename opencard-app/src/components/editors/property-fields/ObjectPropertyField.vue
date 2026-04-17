<template>
  <span class="prop-unsupported">
    {{ summary }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EditorPropertyDefinition } from '../../../entities/card/schema'

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
  color: var(--oc-text-muted);
  font-size: var(--oc-body-size);
}
</style>
