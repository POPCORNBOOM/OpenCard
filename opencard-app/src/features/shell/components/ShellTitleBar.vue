<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type ComponentPublicInstance } from 'vue';
import OcIcon from '../../../components/base/OcIcon.vue';
import OcActionMenu from '../../../components/standard/OcActionMenu.vue';
import OcFloatingLayer from '../../../components/standard/OcFloatingLayer.vue';
import AppearanceShaderPreview from '../../settings/components/AppearanceShaderPreview.vue';
import type {
  ShellProgressTask,
  ShellTitleBarAppAction,
  ShellTitleBarMenuGroup,
  ShellTitleBarWindowControl,
} from '../shell.types';

const props = defineProps<{
  collapsed: boolean;
  brandLabel: string;
  brandLogoSrc?: string;
  menuGroups: ShellTitleBarMenuGroup[];
  primaryPageAction?: ShellTitleBarAppAction;
  appActions?: ShellTitleBarAppAction[];
  tasks?: readonly ShellProgressTask[];
  windowControls?: ShellTitleBarWindowControl[];
  collapseTooltip?: string;
  expandTooltip?: string;
  dragRegion?: boolean;
  nativeMacosControls?: boolean;
}>();

const emit = defineEmits<{
  'toggle-sidebar': [];
  'menu-action': [menuKey: string, actionKey: string];
  'app-action': [actionKey: string];
  'window-control': [actionKey: string];
}>();

const openMenu = ref<string | null>(null);
const titlebarRef = ref<HTMLElement | null>(null);
const taskPanelAnchor = ref<HTMLElement | null>(null);
const taskPanelOpen = ref(false);
const menuAnchors = new Map<string, HTMLElement>();
let taskPanelCloseTimer: number | null = null;
const titlebarProgress = computed(() => {
  if (!props.tasks?.length) return null;
  const totals = props.tasks.reduce((result, task) => {
    const weight = Number.isFinite(task.weight) && (task.weight ?? 0) > 0 ? task.weight! : 1;
    result.progress += Math.min(1, Math.max(0, task.progress)) * weight;
    result.weight += weight;
    return result;
  }, { progress: 0, weight: 0 });
  return totals.progress / totals.weight;
});

function taskProgressPercent(task: ShellProgressTask): number {
  return Math.round(Math.min(1, Math.max(0, task.progress)) * 100);
}

function cancelTaskPanelClose(): void {
  if (taskPanelCloseTimer == null) return;
  window.clearTimeout(taskPanelCloseTimer);
  taskPanelCloseTimer = null;
}

function openTaskPanel(): void {
  cancelTaskPanelClose();
  if (props.tasks?.length) taskPanelOpen.value = true;
}

function scheduleTaskPanelClose(): void {
  cancelTaskPanelClose();
  taskPanelCloseTimer = window.setTimeout(() => {
    taskPanelCloseTimer = null;
    taskPanelOpen.value = false;
  }, 120);
}

function closeTaskPanel(): void {
  cancelTaskPanelClose();
  taskPanelOpen.value = false;
}

function setMenuAnchor(menuKey: string, element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLElement) menuAnchors.set(menuKey, element);
  else menuAnchors.delete(menuKey);
}

function toggleMenu(menuKey: string): void {
  openMenu.value = openMenu.value === menuKey ? null : menuKey;
}

function switchOpenMenu(menuKey: string): void {
  if (openMenu.value) openMenu.value = menuKey;
}

function runMenuCommand(menuKey: string, actionKey: string): void {
  openMenu.value = null;
  emit('menu-action', menuKey, actionKey);
}

function closeMenu(): void {
  openMenu.value = null;
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!openMenu.value) {
    return;
  }

  const target = event.target;
  const isInsideTitlebar = target instanceof Node && titlebarRef.value?.contains(target);
  const isInsideActionMenu = target instanceof Element && target.closest('.oc-action-menu');
  if (!isInsideTitlebar && !isInsideActionMenu) {
    closeMenu();
  }
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && openMenu.value) {
    event.preventDefault();
    closeMenu();
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onDocumentKeydown);
});

onBeforeUnmount(() => {
  cancelTaskPanelClose();
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onDocumentKeydown);
});
</script>

<template>
  <header
    ref="titlebarRef"
    class="titlebar"
    :class="{ 'titlebar-native-macos': props.nativeMacosControls }"
  >
    <Transition name="titlebar-progress-fade">
      <div v-if="titlebarProgress != null" class="titlebar-shader">
        <AppearanceShaderPreview :progress="titlebarProgress" />
      </div>
    </Transition>
    <div class="titlebar-left">
      <button
        class="titlebar-icon"
        type="button"
        :data-tooltip="props.collapsed ? props.expandTooltip || null : props.collapseTooltip || null"
        @click="emit('toggle-sidebar')"
      >
        <OcIcon :name="props.collapsed ? 'nav.sidebar-expand' : 'nav.sidebar-collapse'" size="sm" />
      </button>

      <button
        v-if="props.primaryPageAction"
        class="titlebar-icon titlebar-primary-page-action"
        type="button"
        :disabled="props.primaryPageAction.disabled"
        :data-tooltip="props.primaryPageAction.hoverTip || null"
        @click="emit('app-action', props.primaryPageAction.key)"
      >
        <OcIcon :name="props.primaryPageAction.icon" size="sm" />
      </button>

      <div
        v-for="menu in props.menuGroups"
        :key="menu.key"
        class="titlebar-menu"
        @pointerenter="switchOpenMenu(menu.key)"
      >
        <button
          :ref="(element) => setMenuAnchor(menu.key, element)"
          class="titlebar-menu-button"
          type="button"
          :aria-haspopup="'menu'"
          :aria-expanded="openMenu === menu.key"
          @click="toggleMenu(menu.key)"
        >
          {{ menu.label }}
        </button>
        <OcFloatingLayer
          :open="openMenu === menu.key"
          :anchor="menuAnchors.get(menu.key) ?? null"
          placement="bottom-start"
          :gap="8"
          :max-height="480"
          class="titlebar-menu-floating"
        >
          <OcActionMenu
            :actions="menu.actions"
            @select="runMenuCommand(menu.key, $event.key)"
          />
        </OcFloatingLayer>
      </div>

      <button
        v-for="action in props.appActions ?? []"
        :key="action.key"
        class="titlebar-icon titlebar-app-action"
        type="button"
        :disabled="action.disabled"
        :data-tooltip="action.hoverTip || null"
        @click="emit('app-action', action.key)"
      >
        <OcIcon :name="action.icon" size="sm" />
      </button>
    </div>

    <div class="titlebar-drag" :data-tauri-drag-region="props.dragRegion ? '' : null">
      <div
        ref="taskPanelAnchor"
        class="titlebar-brand-lockup"
        :data-tauri-drag-region="props.dragRegion ? '' : null"
        :tabindex="props.tasks?.length ? 0 : undefined"
        :aria-expanded="props.tasks?.length ? taskPanelOpen : undefined"
        @pointerenter="openTaskPanel"
        @pointerleave="scheduleTaskPanelClose"
        @focusin="openTaskPanel"
        @focusout="scheduleTaskPanelClose"
        @keydown.esc="closeTaskPanel"
      >
        <img v-if="props.brandLogoSrc" class="titlebar-logo" :src="props.brandLogoSrc" alt="" draggable="false" />
        <span class="titlebar-brand">{{ props.brandLabel }}</span>
      </div>
    </div>

    <OcFloatingLayer
      :open="taskPanelOpen && Boolean(props.tasks?.length)"
      :anchor="taskPanelAnchor"
      placement="bottom"
      :gap="6"
      :max-height="360"
      class="titlebar-task-floating"
    >
      <section
        class="titlebar-task-panel"
        aria-live="polite"
        @pointerenter="cancelTaskPanelClose"
        @pointerleave="scheduleTaskPanelClose"
      >
        <div v-for="task in props.tasks ?? []" :key="task.key" class="titlebar-task-row">
          <div class="titlebar-task-row__header">
            <span class="titlebar-task-row__title">{{ task.title }}</span>
            <span class="titlebar-task-row__value">{{ taskProgressPercent(task) }}%</span>
          </div>
          <div
            class="titlebar-task-row__track"
            role="progressbar"
            :aria-label="task.title"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="taskProgressPercent(task)"
          >
            <span
              class="titlebar-task-row__fill"
              :style="{ width: `${taskProgressPercent(task)}%` }"
            />
          </div>
        </div>
      </section>
    </OcFloatingLayer>

    <div class="titlebar-right">
      <button
        v-for="(control, controlIndex) in props.windowControls ?? []"
        :key="control.key"
        class="titlebar-icon"
        :class="{
          'titlebar-icon-danger': control.danger,
          'titlebar-icon-window': control.group === 'window',
          'titlebar-icon-window-start': control.group === 'window'
            && props.windowControls?.[controlIndex - 1]?.group !== 'window',
        }"
        type="button"
        :data-tooltip="control.hoverTip || null"
        @click="emit('window-control', control.key)"
      >
        <OcIcon :name="control.icon" size="sm" />
      </button>
    </div>
  </header>
</template>
