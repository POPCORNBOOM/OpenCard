<script setup lang="ts">
import { ref, watch } from 'vue';
import OcIcon from '../../../components/base/OcIcon.vue';
import OcActionRail from '../../../components/standard/OcActionRail.vue';
import type { OcActionButtonAction } from '../../../components/standard/OcActionButton.vue';
import type {
  ShellButton,
  ShellList,
} from '../shell.types';

const props = defineProps<{
  collapsed: boolean;
  width: number;
  headButtons: ShellButton[];
  bodyLists: ShellList[];
  tailButtons: ShellButton[];
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
  'list-content': (props: { list: ShellList }) => unknown;
}>();

const sidebarElement = ref<HTMLElement | null>(null);
const resizing = ref(false);
const collapsedLists = ref<Record<string, boolean>>({});

function ensureListState(lists: ShellList[]): void {
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

function toggleListCollapsed(listKey: string): void {
  collapsedLists.value[listKey] = !collapsedLists.value[listKey];
}

function isListCollapsed(listKey: string): boolean {
  return collapsedLists.value[listKey] === true;
}

function toActionDefinitions(actions: ShellList['actions']): OcActionButtonAction[] {
  return actions.map(action => ({
    key: action.key ?? action.icon,
    title: action.hoverTip,
    icon: action.icon,
    disabled: action.disabled,
    children: action.children,
  }))
}

function listContentStyle(list: ShellList): { maxHeight: string; overflowY: 'auto' } | undefined {
  if (list.maxHeight === undefined) return undefined;
  return {
    maxHeight: list.maxHeight,
    overflowY: 'auto',
  };
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
        <OcIcon v-if="button.icon" :name="button.icon" size="sm" />
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
            <OcIcon class="shell-sidebar-list-chevron" name="nav.chevron-down" size="sm"
              :class="{ collapsed: isListCollapsed(list.key) }" />
          </button>

          <OcActionRail
            :actions="toActionDefinitions(list.actions)"
            @select="emit('list-button-clicked', list.key, $event.key)"
          />
        </div>

        <div class="shell-sidebar-list-content-wrap" :class="{ collapsed: isListCollapsed(list.key) }">
          <div class="shell-sidebar-list-content" :style="listContentStyle(list)">
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
        <OcIcon v-if="button.icon" :name="button.icon" size="sm" />
        <span v-if="!collapsed">{{ button.title }}</span>
      </button>
    </div>

    <div v-if="!collapsed" class="shell-sidebar-resizer" @pointerdown.prevent="onResizePointerDown" />
  </aside>
</template>
