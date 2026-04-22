<template>
  <article class="showcase-card">
    <header class="showcase-card__header">
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </header>
    <ExampleGrid>
      <template #default>
        <slot name="default" />
      </template>
      <template #variants>
        <slot name="variants" />
      </template>
      <template #states>
        <slot name="states" />
      </template>
      <template #layout>
        <slot name="layout" />
      </template>
    </ExampleGrid>
  </article>
</template>

<script setup lang="ts">
import ExampleGrid from './ExampleGrid.vue'

defineOptions({ name: 'ShowcaseCard' })

defineProps<{
  title: string
  description: string
}>()
</script>

<style scoped>
.showcase-card {
  border: 1px solid var(--oc-border-subtle);
  border-radius: 12px;
  background: var(--oc-bg-panel);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.showcase-card__header h3 {
  margin: 0;
  font-size: 16px;
}

.showcase-card__header p {
  margin: 4px 0 0;
  font-size: var(--oc-body-size);
  color: var(--oc-text-secondary);
}
</style>

