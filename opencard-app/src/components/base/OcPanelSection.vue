<template>
  <OcSurface
    as="section"
    class="oc-panel-section"
    :class="[
      `oc-panel-section--tone-${props.tone}`,
      {
        'is-collapsed': props.collapsed,
        'is-fill': props.fill,
      },
    ]"
    :style="panelStyle"
    :variant="surfaceVariant"
  >
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
import { computed, useSlots, type CSSProperties, type HTMLAttributes } from 'vue'
import { OcScrollArea, OcSurface } from '../../shared/ui/primitives'

defineOptions({ name: 'OcPanelSection' })

const props = withDefaults(defineProps<{
  title?: string
  header?: boolean
  scrollBody?: boolean
  tone?: 'default' | 'overlay'
  collapsed?: boolean
  headerPadding?: string
  headerMinHeight?: string
  bodyPadding?: string
  fill?: boolean
  headerClass?: HTMLAttributes['class']
  bodyClass?: HTMLAttributes['class']
}>(), {
  title: undefined,
  header: true,
  scrollBody: false,
  tone: 'default',
  collapsed: false,
  headerPadding: undefined,
  headerMinHeight: undefined,
  bodyPadding: undefined,
  fill: false,
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
const surfaceVariant = computed(() => (props.tone === 'overlay' ? 'transparent' : 'panel'))
const panelStyle = computed<CSSProperties>(() => ({
  ...(props.headerPadding ? { '--oc-panel-header-padding': props.headerPadding } : {}),
  ...(props.headerMinHeight ? { '--oc-panel-header-min-height': props.headerMinHeight } : {}),
  ...(props.bodyPadding ? { '--oc-panel-body-padding': props.bodyPadding } : {}),
}))
</script>

<style scoped>
.oc-panel-section {
  --oc-panel-header-padding: 0 14px;
  --oc-panel-header-min-height: 38px;
  --oc-panel-body-padding: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.oc-panel-section.is-fill {
  width: 100%;
  height: 100%;
}

.oc-panel-header {
  min-height: var(--oc-panel-header-min-height);
  padding: var(--oc-panel-header-padding);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oc-space-2);
  font-size: var(--oc-title-size);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--oc-text-primary);
  background: linear-gradient(180deg, var(--oc-bg-panel) 0%, var(--oc-bg-subtle) 100%);
  border-bottom: 1px solid var(--oc-border-strong);
}

.oc-panel-section--tone-overlay .oc-panel-header {
  background: transparent;
  border-bottom-color: var(--oc-border-overlay-soft);
}

.oc-panel-section--tone-overlay .oc-panel-body,
.oc-panel-section--tone-overlay .oc-panel-scroll-body,
.oc-panel-section--tone-overlay .oc-panel-section__body {
  background: transparent;
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
  gap: var(--oc-space-2);
}

.oc-panel-section__actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-1);
  flex-shrink: 0;
}

.oc-panel-section__body {
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: var(--oc-panel-body-padding);
}

.oc-panel-section.is-collapsed .oc-panel-header {
  padding: 0;
  justify-content: center;
}

.oc-panel-section.is-collapsed .oc-panel-section__title {
  display: none;
}

.oc-panel-section.is-collapsed .oc-panel-section__actions {
  width: 100%;
  margin-left: 0;
  justify-content: center;
}

.oc-panel-section.is-collapsed .oc-panel-section__body {
  display: none;
}
</style>
