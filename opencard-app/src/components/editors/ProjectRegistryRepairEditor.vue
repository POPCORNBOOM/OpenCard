<template>
  <section class="project-registry-repair" role="alert">
    <div class="project-registry-repair__message">
      <OcIcon name="status.error" tone="danger" />
      <div>
        <strong>{{ title }}</strong>
        <OcText tone="muted" size="sm">{{ description }}</OcText>
      </div>
    </div>
    <MonacoEditor language="json" :model-value="modelValue" :theme-id="themeId"
      :theme-overrides="themeOverrides" @update:model-value="emit('update:modelValue', $event)"
      @save="emit('save')" />
  </section>
</template>

<script setup lang="ts">
import type { OcThemeColorOverrides, OcThemeId } from '../../shared/ui/foundation'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import MonacoEditor from './MonacoEditor.vue'

defineProps<{
  modelValue: string
  title: string
  description: string
  themeId: OcThemeId
  themeOverrides: OcThemeColorOverrides
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  save: []
}>()
</script>

<style scoped>
.project-registry-repair,
.project-registry-repair__message,
.project-registry-repair__message > div {
  display: grid;
}

.project-registry-repair {
  height: 100%;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--oc-space-4);
}

.project-registry-repair__message {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--oc-space-3);
}

.project-registry-repair__message > div {
  gap: var(--oc-space-1);
}
</style>
