<script setup lang="ts">
import { ref, watch } from 'vue';
import type {
  EzShellButton,
  EzShellList,
} from './types';

const props = defineProps<{
  collapsed: boolean;
  width: number;
  headButtons: EzShellButton[];
  bodyLists: EzShellList[];
  tailButtons: EzShellButton[];
  collapseListTooltip?: string;
  expandListTooltip?: string;
  minResizeWidth?: number;
}>();

const emit = defineEmits<{
  'head-button-clicked': [buttonKey: string];
  'list-button-clicked': [listKey: string, actionKey: string];
  'tail-button-clicked': [buttonKey: string];
  resize: [width: number];
}>();

defineSlots<{
  'list-content': (props: { list: EzShellList }) => unknown;
}>();

const sidebarElement = ref<HTMLElement | null>(null);
const resizing = ref(false);
const collapsedLists = ref<Record<string, boolean>>({});

function ensureListState(lists: EzShellList[]): void {
  const next: Record<string, boolean> = {};
  for (const list of lists) {
    next[list.key] = collapsedLists.value[list.key] ?? false;
  }
  collapsedLists.value = next;
}

watch(
  () => props.bodyLists,
  (lists) => {
    ensureListState(lists);
  },
  { immediate: true }
);

function onResizePointerDown(event: PointerEvent): void {
  if (props.collapsed) {
    return;
  }

  resizing.value = true;
  const pointerId = event.pointerId;
  const startLeft = sidebarElement.value?.getBoundingClientRect().left ?? 0;
  const minResizeWidth = props.minResizeWidth ?? 78;

  const onPointerMove = (moveEvent: PointerEvent): void => {
    if (!resizing.value) {
      return;
    }

    emit('resize', Math.max(minResizeWidth, Math.round(moveEvent.clientX - startLeft)));
  };

  const onPointerUp = (): void => {
    resizing.value = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    if (sidebarElement.value?.hasPointerCapture(pointerId)) {
      sidebarElement.value.releasePointerCapture(pointerId);
    }
  };

  sidebarElement.value?.setPointerCapture(pointerId);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

function iconClasses(icon: string): string[] {
  const tokens = icon.split(/\s+/).filter(Boolean);
  return tokens.includes('mdi') ? tokens : ['mdi', ...tokens];
}

function iconStyle(color?: string): { color?: string } | undefined {
  return color ? { color } : undefined;
}

function toggleListCollapsed(listKey: string): void {
  collapsedLists.value[listKey] = !collapsedLists.value[listKey];
}

function isListCollapsed(listKey: string): boolean {
  return collapsedLists.value[listKey] === true;
}

</script>

<template>
  <aside ref="sidebarElement" class="shell-sidebar" :class="{ collapsed }" :style="{ width: `${width}px` }">
    <div class="shell-sidebar-group shell-sidebar-group-top">
      <button
        v-for="button in headButtons"
        :key="button.key"
        class="shell-sidebar-button"
        type="button"
        :disabled="button.disabled"
        :data-tooltip="button.hoverTip || null"
        @click="emit('head-button-clicked', button.key)"
      >
        <i v-if="button.icon" :class="iconClasses(button.icon)" />
        <span v-if="!collapsed">{{ button.title }}</span>
      </button>
    </div>

    <div class="shell-sidebar-body">
      <section v-for="list in bodyLists" :key="list.key" class="shell-sidebar-list">
        <div class="shell-sidebar-list-head">
          <button
            v-if="!collapsed"
            class="shell-sidebar-list-toggle"
            type="button"
            :data-tooltip="isListCollapsed(list.key) ? props.expandListTooltip || null : props.collapseListTooltip || null"
            @click.stop="toggleListCollapsed(list.key)"
          >
            <span class="shell-sidebar-list-title">{{ list.title }}</span>
            <i class="mdi mdi-chevron-down" :class="{ collapsed: isListCollapsed(list.key) }" />
          </button>

          <div class="shell-sidebar-actions">
            <button
              v-for="action in list.actions"
              :key="`${list.key}-${action.key ?? action.icon}`"
              class="shell-sidebar-action"
              type="button"
              :disabled="action.disabled"
              :data-tooltip="action.hoverTip || null"
              @click="action.key && emit('list-button-clicked', list.key, action.key)"
            >
              <i :class="iconClasses(action.icon)" :style="iconStyle(action.color)" />
            </button>
          </div>
        </div>

        <div class="shell-sidebar-list-content-wrap" :class="{ collapsed: isListCollapsed(list.key) }">
          <div class="shell-sidebar-list-content">
            <slot name="list-content" :list="list">
              <div class="shell-sidebar-empty">
                <span v-if="!collapsed">{{ list.placeholder }}</span>
              </div>
            </slot>
          </div>
        </div>
      </section>
    </div>

    <div class="shell-sidebar-group shell-sidebar-group-bottom">
      <button
        v-for="button in tailButtons"
        :key="button.key"
        class="shell-sidebar-button"
        type="button"
        :disabled="button.disabled"
        :data-tooltip="button.hoverTip || null"
        @click="emit('tail-button-clicked', button.key)"
      >
        <i v-if="button.icon" :class="iconClasses(button.icon)" />
        <span v-if="!collapsed">{{ button.title }}</span>
      </button>
    </div>

    <div v-if="!collapsed" class="shell-sidebar-resizer" @pointerdown.prevent="onResizePointerDown" />
  </aside>
</template>
