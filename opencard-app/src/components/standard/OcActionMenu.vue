<!-- Recursive action menu shared by action buttons and text menu triggers. -->
<template>
  <div class="oc-action-menu" role="menu" @pointerenter="emit('keep-open')">
    <div
      v-for="action in actions"
      :key="action.key"
      class="oc-action-menu__item"
      :class="{
        'is-disabled': action.disabled === true,
        'has-children': hasActionChildren(action),
      }"
      @pointerenter="handleItemPointerEnter(action)"
      @pointerleave="handleItemPointerLeave(action)"
      @focusin="handleItemFocusIn(action)"
      @focusout="handleItemFocusOut(action)"
    >
      <button
        :ref="(element) => setChildAnchor(action.key, element)"
        type="button"
        class="oc-action-menu__button"
        :disabled="action.disabled === true"
        :title="action.title"
        role="menuitem"
        :aria-haspopup="hasActionChildren(action) ? 'menu' : undefined"
        :aria-expanded="hasActionChildren(action) ? openChildKey === action.key : undefined"
        @click.stop="handleActionClick(action)"
      >
        <OcIcon
          v-if="action.icon"
          :name="action.icon"
          :tone="action.iconTone"
          size="sm"
          class="oc-action-menu__icon"
        />
        <span v-else class="oc-action-menu__icon-spacer" />
        <span class="oc-action-menu__label">{{ action.title ?? action.key }}</span>
        <OcIcon
          v-if="hasActionChildren(action)"
          name="nav.arrow-right"
          size="sm"
          class="oc-action-menu__caret"
        />
      </button>

      <OcFloatingLayer
        v-if="hasActionChildren(action)"
        :open="openChildKey === action.key"
        :anchor="childAnchors.get(action.key) ?? null"
        placement="right-start"
        :gap="0"
        :max-height="480"
        class="oc-action-menu__floating"
        @pointerenter="keepMenusOpen"
        @pointerleave="scheduleChildClose"
      >
        <OcActionMenu
          :actions="action.children"
          @select="emit('select', $event)"
          @keep-open="keepMenusOpen"
        />
      </OcFloatingLayer>
    </div>
  </div>
</template>

<script lang="ts">
import type { IconToken, IconTone } from '../../shared/ui/icon/iconRegistry'

export interface OcActionDefinition {
  key: string
  icon?: IconToken
  iconTone?: IconTone
  title?: string
  disabled?: boolean
  children?: OcActionDefinition[]
}

export interface OcActionSelectPayload {
  key: string
}
</script>

<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, type ComponentPublicInstance } from 'vue'
import OcIcon from '../base/OcIcon.vue'
import OcFloatingLayer from './OcFloatingLayer.vue'

defineOptions({ name: 'OcActionMenu' })

defineProps<{
  actions: OcActionDefinition[]
}>()

const emit = defineEmits<{
  select: [payload: OcActionSelectPayload]
  'keep-open': []
}>()

const openChildKey = ref<string | null>(null)
const childAnchors = reactive(new Map<string, HTMLElement>())
let childCloseTimer: number | null = null

onBeforeUnmount(cancelChildClose)

function hasActionChildren(
  action: OcActionDefinition,
): action is OcActionDefinition & { children: OcActionDefinition[] } {
  return Array.isArray(action.children) && action.children.length > 0
}

function setChildAnchor(key: string, element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLElement) childAnchors.set(key, element)
  else childAnchors.delete(key)
}

function openChild(key: string): void {
  cancelChildClose()
  openChildKey.value = key
}

function scheduleChildClose(): void {
  cancelChildClose()
  childCloseTimer = window.setTimeout(() => {
    openChildKey.value = null
  }, 90)
}

function cancelChildClose(): void {
  if (childCloseTimer === null) return
  window.clearTimeout(childCloseTimer)
  childCloseTimer = null
}

function keepMenusOpen(): void {
  cancelChildClose()
  emit('keep-open')
}

function handleItemPointerEnter(action: OcActionDefinition): void {
  if (hasActionChildren(action) && action.disabled !== true) openChild(action.key)
}

function handleItemPointerLeave(action: OcActionDefinition): void {
  if (hasActionChildren(action)) scheduleChildClose()
}

function handleItemFocusIn(action: OcActionDefinition): void {
  if (hasActionChildren(action) && action.disabled !== true) openChild(action.key)
}

function handleItemFocusOut(action: OcActionDefinition): void {
  if (hasActionChildren(action)) scheduleChildClose()
}

function handleActionClick(action: OcActionDefinition): void {
  if (!hasActionChildren(action) && action.disabled !== true) {
    emit('select', { key: action.key })
  }
}
</script>

<style>
.oc-action-menu {
  position: static;
  box-sizing: border-box;
  min-width: 156px;
  max-height: inherit;
  padding: 3px;
  overflow-y: auto;
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-surface);
  box-shadow: var(--oc-shadow-lg);
}

.oc-action-menu__floating {
  overflow: visible;
}

.oc-action-menu__item {
  position: relative;
}

.oc-action-menu__button {
  width: 100%;
  height: var(--oc-size-md);
  padding: 0 var(--oc-space-3);
  border: 0;
  border-radius: var(--oc-radius-sm);
  background: transparent;
  color: var(--oc-fg-default);
  font: inherit;
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  cursor: pointer;
  text-align: left;
}

.oc-action-menu__button:hover:not(:disabled),
.oc-action-menu__button:focus-visible {
  background: var(--oc-bg-hover);
  outline: none;
}

.oc-action-menu__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.oc-action-menu__icon,
.oc-action-menu__icon-spacer,
.oc-action-menu__caret {
  flex: 0 0 auto;
}

.oc-action-menu__icon-spacer {
  width: var(--oc-size-sm);
  height: var(--oc-size-sm);
}

.oc-action-menu__label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
