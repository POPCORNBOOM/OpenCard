<script setup lang="ts">
import { computed } from 'vue'
import OcActionRail from '../../../components/standard/OcActionRail.vue'
import type { OcActionButtonAction } from '../../../components/standard/OcActionButton.vue'
import type { ShellAction } from '../shell.types';

const props = defineProps<{
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

const actionDefinitions = computed<OcActionButtonAction[]>(() => props.actions.map(action => ({
  key: action.key ?? action.icon,
  title: action.hoverTip ?? action.value,
  icon: action.icon,
  disabled: action.disabled,
  badge: action.badge,
  badgeLabel: action.badgeLabel,
  children: action.options ?? action.children,
})))

</script>

<template>
  <section class="workspace-frame">
    <header class="workspace-header">
      <div>
        <h1 class="workspace-title">{{ title }}</h1>
      </div>
      <OcActionRail
        class="workspace-actions"
        :actions="actionDefinitions"
        @select="emit('action', $event.key)"
      />
    </header>

    <div class="workspace-body" :class="{ locked: lockBodyScroll, flush: flushBody }">
      <slot />
    </div>
  </section>
</template>
