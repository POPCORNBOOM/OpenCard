<template>
  <section class="project-registry-shell"
    :class="[`project-registry-shell--${contentMode}`, `project-registry-shell--header-${headerMode}`]">
    <header v-if="headerMode === 'default'" class="project-registry-shell__header">
      <div class="project-registry-shell__identity">
        <OcIcon :name="icon" size="lg" />
        <div>
          <h1>{{ heading }}</h1>
          <OcText tone="muted" size="sm">{{ description }}</OcText>
        </div>
      </div>
      <div v-if="$slots.actions" class="project-registry-shell__actions">
        <slot name="actions" />
      </div>
    </header>
    <main class="project-registry-shell__content">
      <slot />
    </main>
  </section>
</template>

<script setup lang="ts">
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'

withDefaults(defineProps<{
  icon: IconToken
  heading: string
  description: string
  contentMode?: 'padded' | 'workspace'
  headerMode?: 'default' | 'hidden'
}>(), {
  contentMode: 'padded',
  headerMode: 'default',
})
</script>

<style scoped>
.project-registry-shell {
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.project-registry-shell__header,
.project-registry-shell__identity,
.project-registry-shell__actions {
  display: flex;
  align-items: center;
}

.project-registry-shell__header {
  justify-content: space-between;
  gap: var(--oc-space-4);
  padding: var(--oc-space-5) var(--oc-space-6);
  border-bottom: var(--oc-border-width) solid var(--oc-border-muted);
}

.project-registry-shell__identity {
  min-width: 0;
  gap: var(--oc-space-3);
}

.project-registry-shell__identity > div {
  display: grid;
  min-width: 0;
  gap: var(--oc-space-1);
}

.project-registry-shell h1 {
  margin: 0;
  font-size: var(--oc-text-lg);
  font-weight: var(--font-weight-ui-title);
  letter-spacing: 0;
}

.project-registry-shell__actions {
  flex: 0 0 auto;
  gap: var(--oc-space-2);
}

.project-registry-shell__content {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: var(--oc-space-5) var(--oc-space-6);
  scrollbar-gutter: stable;
}

.project-registry-shell--workspace .project-registry-shell__content {
  overflow: hidden;
  padding: 0;
  scrollbar-gutter: auto;
}

.project-registry-shell--header-hidden {
  grid-template-rows: minmax(0, 1fr);
}
</style>
