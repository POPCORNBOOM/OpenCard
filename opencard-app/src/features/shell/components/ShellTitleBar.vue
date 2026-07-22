<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, type ComponentPublicInstance } from 'vue';
import OcIcon from '../../../components/base/OcIcon.vue';
import OcActionMenu from '../../../components/standard/OcActionMenu.vue';
import OcFloatingLayer from '../../../components/standard/OcFloatingLayer.vue';
import type { ShellTitleBarMenuGroup, ShellTitleBarWindowControl } from '../shell.types';

const props = defineProps<{
  collapsed: boolean;
  brandLabel: string;
  brandLogoSrc?: string;
  menuGroups: ShellTitleBarMenuGroup[];
  windowControls?: ShellTitleBarWindowControl[];
  collapseTooltip?: string;
  expandTooltip?: string;
  dragRegion?: boolean;
}>();

const emit = defineEmits<{
  'toggle-sidebar': [];
  'menu-action': [menuKey: string, actionKey: string];
  'window-control': [actionKey: string];
}>();

const openMenu = ref<string | null>(null);
const titlebarRef = ref<HTMLElement | null>(null);
const menuAnchors = new Map<string, HTMLElement>();

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
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onDocumentKeydown);
});
</script>

<template>
  <header ref="titlebarRef" class="titlebar">
    <div class="titlebar-left">
      <button
        class="titlebar-icon"
        type="button"
        :data-tooltip="props.collapsed ? props.expandTooltip || null : props.collapseTooltip || null"
        @click="emit('toggle-sidebar')"
      >
        <OcIcon :name="props.collapsed ? 'nav.sidebar-expand' : 'nav.sidebar-collapse'" size="sm" />
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
    </div>

    <div class="titlebar-drag" :data-tauri-drag-region="props.dragRegion ? '' : null">
      <div class="titlebar-brand-lockup" :data-tauri-drag-region="props.dragRegion ? '' : null">
        <img v-if="props.brandLogoSrc" class="titlebar-logo" :src="props.brandLogoSrc" alt="" draggable="false" />
        <span class="titlebar-brand">{{ props.brandLabel }}</span>
      </div>
    </div>

    <div class="titlebar-right">
      <button
        v-for="control in props.windowControls ?? []"
        :key="control.key"
        class="titlebar-icon"
        :class="{ 'titlebar-icon-danger': control.danger, 'is-spinning': control.spinning }"
        type="button"
        :data-tooltip="control.hoverTip || null"
        @click="emit('window-control', control.key)"
      >
        <OcIcon :name="control.icon" size="sm" />
      </button>
    </div>
  </header>
</template>
