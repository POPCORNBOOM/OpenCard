<script setup lang="ts">
import OcIcon from '../../../components/base/OcIcon.vue';
import type { ShellAction } from '../shell.types';

defineProps<{
  title: string;
  actions: ShellAction[];
  lockBodyScroll?: boolean;
  flushBody?: boolean;
}>();

defineSlots<{
  default: () => unknown;
}>();

const emit = defineEmits<{
  action: [actionKey: string];
}>();

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
          :disabled="action.disabled"
          :data-tooltip="action.hoverTip || null"
          @click="action.key && emit('action', action.key)"
        >
          <OcIcon :name="action.icon" size="sm" />
        </button>
      </div>
    </header>

    <div class="workspace-body" :class="{ locked: lockBodyScroll, flush: flushBody }">
      <slot />
    </div>
  </section>
</template>
