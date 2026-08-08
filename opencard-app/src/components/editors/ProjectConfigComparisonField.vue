<template>
  <div class="project-config-comparison-field">
    <OcText as="span" size="sm">{{ label }}</OcText>
    <div v-if="paired" class="project-config-comparison-field__pair" :class="{ 'is-changed': changed }">
      <label class="project-config-comparison-field__side is-historical">
        <span>A</span>
        <OcFieldInput :as="multiline ? 'textarea' : 'input'" full-width readonly
          :mono="mono" :value="historicalValue" />
      </label>
      <label class="project-config-comparison-field__side is-current">
        <span>B</span>
        <OcFieldInput :as="multiline ? 'textarea' : 'input'" full-width readonly
          :mono="mono" :value="currentValue" />
      </label>
    </div>
    <OcFieldInput v-else :as="multiline ? 'textarea' : 'input'" full-width readonly
      :mono="mono" :value="currentValue" />
  </div>
</template>

<script setup lang="ts">
import OcFieldInput from '../base/OcFieldInput.vue'
import OcText from '../base/OcText.vue'

withDefaults(defineProps<{
  label: string
  historicalValue: string
  currentValue: string
  paired: boolean
  changed: boolean
  multiline?: boolean
  mono?: boolean
}>(), { multiline: false, mono: false })
</script>

<style scoped>
.project-config-comparison-field {
  display: grid;
  gap: var(--oc-space-1);
}

.project-config-comparison-field__pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--oc-space-2);
}

.project-config-comparison-field__side {
  display: grid;
  grid-template-columns: var(--oc-size-sm) minmax(0, 1fr);
  align-items: start;
  gap: var(--oc-space-1);
  min-width: 0;
  padding: var(--oc-space-1);
}

.project-config-comparison-field__side > span {
  display: grid;
  place-items: center;
  height: var(--oc-size-md);
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
  font-weight: var(--font-weight-ui-title);
}

.project-config-comparison-field__pair.is-changed .is-historical {
  background: var(--oc-bg-danger-subtle);
}

.project-config-comparison-field__pair.is-changed .is-current {
  background: color-mix(in srgb, var(--oc-icon-success) 10%, transparent);
}

@media (max-width: 760px) {
  .project-config-comparison-field__pair {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
