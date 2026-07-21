<script setup lang="ts">
import type { EzShellAction } from './types';

defineProps<{
  title: string;
  actions: EzShellAction[];
  lockBodyScroll?: boolean;
  flushBody?: boolean;
}>();

defineSlots<{
  default: () => unknown;
}>();

const emit = defineEmits<{
  action: [actionKey: string];
}>();

function iconClasses(icon: string): string[] {
  const tokens = icon.split(/\s+/).filter(Boolean);
  return tokens.includes('mdi') ? tokens : ['mdi', ...tokens];
}

function iconStyle(color?: string): { color?: string } | undefined {
  return color ? { color } : undefined;
}
</script>

<template>
  <section class="workspace-frame">
    <header class="workspace-header">
      <div>
        <h1 class="workspace-title">{{ title }}</h1>
      </div>
      <div class="workspace-actions" :class="{ empty: actions.length === 0 }">
        <button
          v-for="action in actions"
          :key="action.key ?? action.icon"
          class="workspace-action"
          type="button"
          :data-tooltip="action.hoverTip || null"
          @click="action.key && emit('action', action.key)"
        >
          <i :class="iconClasses(action.icon)" :style="iconStyle(action.color)" />
        </button>
      </div>
    </header>

    <div class="workspace-body" :class="{ locked: lockBodyScroll, flush: flushBody }">
      <slot />
    </div>
  </section>
</template>
