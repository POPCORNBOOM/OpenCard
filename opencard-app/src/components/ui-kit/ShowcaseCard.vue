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

    <details class="showcase-card__code">
      <summary>示例代码</summary>
      <div class="showcase-card__code-grid">
        <section
          v-for="column in showcaseColumns"
          :key="column"
          class="showcase-card__code-column"
        >
          <h4>{{ columnLabels[column] }}</h4>
          <pre><code>{{ codeByColumn[column] }}</code></pre>
        </section>
      </div>
    </details>
  </article>
</template>

<script setup lang="ts">
import ExampleGrid from './ExampleGrid.vue'
import type { ShowcaseMatrixColumn } from '../../views/ui-kit/catalog'

defineOptions({ name: 'ShowcaseCard' })

const showcaseColumns: readonly ShowcaseMatrixColumn[] = ['default', 'variants', 'states', 'layout']

const columnLabels: Record<ShowcaseMatrixColumn, string> = {
  default: 'Default',
  variants: 'Variants',
  states: 'States',
  layout: 'Layout',
}

defineProps<{
  title: string
  description: string
  codeByColumn: Record<ShowcaseMatrixColumn, string>
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

.showcase-card__code {
  border: 1px solid var(--oc-border-subtle);
  border-radius: 8px;
  background: var(--oc-bg-elevated);
}

.showcase-card__code summary {
  cursor: pointer;
  font-size: var(--oc-label-size);
  color: var(--oc-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 8px 10px;
  user-select: none;
}

.showcase-card__code[open] summary {
  border-bottom: 1px solid var(--oc-border-subtle);
}

.showcase-card__code-grid {
  padding: 10px;
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.showcase-card__code-column {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.showcase-card__code-column h4 {
  margin: 0;
  font-size: var(--oc-label-size);
  color: var(--oc-text-muted);
  text-transform: uppercase;
}

.showcase-card__code-column pre {
  margin: 0;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--oc-border-subtle);
  background: var(--oc-bg-panel);
  color: var(--oc-text-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 11px;
  line-height: 1.5;
  overflow-x: auto;
}

.showcase-card__code-column code {
  white-space: pre;
}

@media (max-width: 960px) {
  .showcase-card__code-grid {
    grid-template-columns: 1fr;
  }
}
</style>
