<script setup lang="ts">
import OcActionButton from '../../../components/standard/OcActionButton.vue';
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
        <OcActionButton
          v-for="action in actions"
          :key="action.key ?? action.icon"
          class="workspace-action"
          :action="{
            key: action.key ?? action.icon,
            title: action.hoverTip,
            icon: action.icon,
            disabled: action.disabled,
            children: action.children,
          }"
          size="sm"
          variant="ghost"
          @select="action.key && emit('action', $event.key)"
        />
      </div>
    </header>

    <div class="workspace-body" :class="{ locked: lockBodyScroll, flush: flushBody }">
      <slot />
    </div>
  </section>
</template>
