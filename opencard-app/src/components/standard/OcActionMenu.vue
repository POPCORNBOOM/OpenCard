<!-- Recursive action menu shared by action buttons and text menu triggers. -->
<template>
  <div
    ref="menuElement"
    class="oc-action-menu"
    role="menu"
    :data-oc-action-menu-branch="props.branchId"
    @pointerenter="emit('keep-open')"
  >
    <template v-for="entry in actions" :key="entry.key">
      <div
        v-if="isActionDivider(entry)"
        class="oc-action-menu__divider"
        role="separator"
      />
      <div
        v-else
        class="oc-action-menu__item"
        :class="{
          'is-disabled': entry.disabled === true,
          'has-children': hasActionChildren(entry),
        }"
        @pointerenter="handleItemPointerEnter(entry)"
        @pointerleave="handleItemPointerLeave(entry)"
        @focusin="handleItemFocusIn(entry)"
        @focusout="handleItemFocusOut(entry)"
      >
        <button
          :ref="(element) => setChildAnchor(entry.key, element)"
          type="button"
          class="oc-action-menu__button"
          :disabled="entry.disabled === true"
          :data-tooltip="entry.title || null"
          role="menuitem"
          :aria-haspopup="hasActionChildren(entry) ? 'menu' : undefined"
          :aria-expanded="hasActionChildren(entry) ? openChildKey === entry.key : undefined"
          @click.stop="handleActionClick(entry)"
          @keydown="handleActionKeydown($event, entry)"
        >
          <OcIcon
            v-if="entry.icon"
            :name="entry.icon"
            :tone="entry.iconTone"
            size="md"
            class="oc-action-menu__icon"
          />
          <span v-else class="oc-action-menu__icon-spacer" />
          <span class="oc-action-menu__label">{{ entry.title ?? entry.key }}</span>
          <span v-if="entry.shortcut?.length" class="oc-action-menu__shortcut" aria-hidden="true">
            <span v-for="part in entry.shortcut" :key="part" class="oc-action-menu__shortcut-chip">
              {{ part }}
            </span>
          </span>
          <OcIcon
            v-if="hasActionChildren(entry)"
            name="nav.arrow-right"
            size="md"
            class="oc-action-menu__caret"
          />
        </button>

        <OcFloatingLayer
          v-if="hasActionChildren(entry)"
          :open="openChildKey === entry.key"
          :anchor="childAnchors.get(entry.key) ?? null"
          placement="right-start"
          :gap="0"
          :max-height="480"
          class="oc-action-menu__floating"
          :data-oc-action-menu-branch="props.branchId"
          @pointerenter="keepMenusOpen"
          @pointerleave="scheduleChildClose"
        >
          <OcActionMenu
            :ref="(element) => setChildMenu(entry.key, element)"
            :actions="entry.children"
            :branch-id="props.branchId"
            @select="emit('select', $event)"
            @keep-open="keepMenusOpen"
            @close-submenu="closeChildAndFocus(entry.key)"
            @dismiss="emit('dismiss')"
          />
        </OcFloatingLayer>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import type { IconToken, IconTone } from '../../shared/ui/icon/iconRegistry'

export interface OcActionDefinition {
  type?: 'action'
  key: string
  icon?: IconToken
  iconTone?: IconTone
  title?: string
  shortcut?: readonly string[]
  disabled?: boolean
  children?: readonly OcActionMenuEntry[]
}

export interface OcActionDivider {
  type: 'divider'
  key: string
}

export type OcActionMenuEntry = OcActionDefinition | OcActionDivider

export interface OcActionSelectPayload {
  key: string
}

export function isActionMenuBranchEvent(event: Event, branchId: string): boolean {
  return event.composedPath().some(target => (
    target instanceof HTMLElement
      && target.dataset.ocActionMenuBranch === branchId
  ))
}
</script>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, reactive, ref, type ComponentPublicInstance } from 'vue'
import OcIcon from '../base/OcIcon.vue'
import OcFloatingLayer from './OcFloatingLayer.vue'

defineOptions({ name: 'OcActionMenu' })

const props = defineProps<{
  actions: readonly OcActionMenuEntry[]
  branchId?: string
}>()

const emit = defineEmits<{
  select: [payload: OcActionSelectPayload]
  'keep-open': []
  'close-submenu': []
  dismiss: []
}>()

const menuElement = ref<HTMLElement | null>(null)
const openChildKey = ref<string | null>(null)
const childAnchors = reactive(new Map<string, HTMLElement>())
const childMenus = new Map<string, ComponentPublicInstance & { focusFirst?: () => void }>()
let childCloseTimer: number | null = null

onBeforeUnmount(cancelChildClose)

function hasActionChildren(
  action: OcActionDefinition,
): action is OcActionDefinition & { children: readonly OcActionMenuEntry[] } {
  return Array.isArray(action.children) && action.children.length > 0
}

function isActionDivider(entry: OcActionMenuEntry): entry is OcActionDivider {
  return entry.type === 'divider'
}

function setChildAnchor(key: string, element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLElement) childAnchors.set(key, element)
  else childAnchors.delete(key)
}

function setChildMenu(key: string, element: Element | ComponentPublicInstance | null): void {
  if (element && '$el' in element) {
    childMenus.set(key, element as ComponentPublicInstance & { focusFirst?: () => void })
  } else childMenus.delete(key)
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

function enabledButtons(): HTMLButtonElement[] {
  return Array.from(menuElement.value?.querySelectorAll<HTMLButtonElement>(
    ':scope > .oc-action-menu__item > .oc-action-menu__button:not(:disabled)',
  ) ?? [])
}

function focusFirst(): void {
  enabledButtons()[0]?.focus()
}

defineExpose({ focusFirst })

function moveFocus(current: HTMLButtonElement, direction: -1 | 1): void {
  const buttons = enabledButtons()
  const currentIndex = buttons.indexOf(current)
  if (currentIndex < 0 || buttons.length === 0) return
  buttons[(currentIndex + direction + buttons.length) % buttons.length]?.focus()
}

async function openChildAndFocus(action: OcActionDefinition): Promise<void> {
  if (!hasActionChildren(action) || action.disabled === true) return
  openChild(action.key)
  await nextTick()
  childMenus.get(action.key)?.focusFirst?.()
}

function closeChildAndFocus(key: string): void {
  openChildKey.value = null
  nextTick(() => childAnchors.get(key)?.focus())
}

function handleActionKeydown(event: KeyboardEvent, action: OcActionDefinition): void {
  const target = event.currentTarget
  if (!(target instanceof HTMLButtonElement)) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    moveFocus(target, event.key === 'ArrowDown' ? 1 : -1)
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    const buttons = enabledButtons()
    buttons[event.key === 'Home' ? 0 : buttons.length - 1]?.focus()
  } else if (event.key === 'ArrowRight' && hasActionChildren(action)) {
    event.preventDefault()
    void openChildAndFocus(action)
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    emit('close-submenu')
  } else if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('dismiss')
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

.oc-action-menu__divider {
  height: 1px;
  margin: 3px var(--oc-space-2);
  background: var(--oc-border-muted);
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

.oc-action-menu__shortcut {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 3px;
}

.oc-action-menu__shortcut-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  box-sizing: border-box;
  border-radius: var(--oc-radius-sm);
  background: var(--oc-bg-hover);
  color: var(--oc-fg-muted);
  font-family: var(--oc-font-mono);
  font-size: var(--oc-text-xs);
  line-height: 1;
  white-space: nowrap;
  box-shadow: inset 0 0 0 1px var(--oc-border-muted);
}
</style>
