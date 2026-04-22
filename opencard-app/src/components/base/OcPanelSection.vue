<template>
  <OcSurface as="section" class="oc-panel-section" variant="panel">
    <header
      v-if="hasHeader"
      class="oc-panel-header oc-panel-section__header"
      :class="headerClass"
    >
      <div class="oc-panel-section__title">
        <slot name="title">{{ title }}</slot>
      </div>
      <div v-if="slots.actions" class="oc-panel-section__actions">
        <slot name="actions" />
      </div>
    </header>
    <OcScrollArea v-if="props.scrollBody" class="oc-panel-section__body oc-panel-scroll-body" :class="bodyClass" axis="y">
      <slot />
    </OcScrollArea>
    <div v-else class="oc-panel-section__body oc-panel-body" :class="bodyClass">
      <slot />
    </div>
  </OcSurface>
</template>

<script setup lang="ts">
import { computed, useSlots, type HTMLAttributes } from 'vue'
import { OcScrollArea, OcSurface } from '../../shared/ui/primitives'

defineOptions({ name: 'OcPanelSection' })

const props = withDefaults(defineProps<{
  title?: string
  header?: boolean
  scrollBody?: boolean
  headerClass?: HTMLAttributes['class']
  bodyClass?: HTMLAttributes['class']
}>(), {
  title: undefined,
  header: true,
  scrollBody: false,
  headerClass: undefined,
  bodyClass: undefined,
})

const slots = useSlots()

const hasHeader = computed(() => {
  if (!props.header) {
    return false
  }

  return Boolean(props.title) || Boolean(slots.title) || Boolean(slots.actions)
})

const bodyClass = computed(() => props.bodyClass)
</script>

<style scoped>
.oc-panel-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.oc-panel-header {
  height: 30px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: var(--oc-label-size);
  text-transform: uppercase;
  font-weight: bold;
  background: var(--oc-bg-panel);
  border-bottom: 1px solid var(--oc-border-strong);
}

.oc-panel-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.oc-panel-scroll-body {
  flex: 1;
  min-height: 0;
}

.oc-panel-section__title {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
}

.oc-panel-section__actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.oc-panel-section__body {
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
