<template>
  <div class="example-grid">
    <div class="example-grid__column">
      <header class="example-grid__header">
        <h4>Default</h4>
      </header>
      <div class="example-grid__body">
        <slot name="default" />
      </div>
    </div>

    <div class="example-grid__column">
      <header class="example-grid__header">
        <h4>Variants</h4>
      </header>
      <div class="example-grid__body">
        <slot name="variants" />
      </div>
    </div>

    <div class="example-grid__column">
      <header class="example-grid__header">
        <h4>States</h4>
      </header>
      <div class="example-grid__body">
        <slot name="states" />
      </div>
    </div>

    <div class="example-grid__column">
      <header class="example-grid__header">
        <h4>Layout</h4>
      </header>
      <div class="example-grid__body">
        <slot name="layout" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'ExampleGrid' })
</script>

<style scoped>
.example-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.example-grid__column {
  border: 1px solid var(--oc-border-subtle);
  border-radius: 8px;
  background: var(--oc-bg-elevated);
  min-height: 120px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.example-grid__header {
  border-bottom: 1px solid var(--oc-border-subtle);
  padding: 8px 10px;
  background: var(--oc-bg-panel);
}

.example-grid__header h4 {
  margin: 0;
  font-size: var(--oc-label-size);
  color: var(--oc-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.example-grid__body {
  flex: 1;
  min-height: 0;
  padding: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-start;
}

@media (max-width: 1300px) {
  .example-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 800px) {
  .example-grid {
    grid-template-columns: 1fr;
  }
}
</style>

