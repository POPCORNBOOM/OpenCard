<!-- Base action button: icon action with optional hover/focus cascading children. -->
<template>
  <div
    ref="rootRef"
    class="oc-action-button"
    :class="{
      'is-disabled': action.disabled === true,
      'has-children': hasActionChildren(action),
    }"
    v-bind="$attrs"
    @pointerenter="openMenu"
    @pointerleave="scheduleCloseMenu"
    @focusin="openMenu"
    @focusout="scheduleCloseMenu"
  >
    <OcButton
      :variant="variant"
      :size="size"
      icon-only
      :icon="action.icon"
      :icon-tone="action.iconTone"
      :data-tooltip="action.title || null"
      :aria-label="action.title ?? action.key"
      :aria-haspopup="hasActionChildren(action) ? 'menu' : undefined"
      :aria-expanded="hasActionChildren(action) ? isMenuOpen : undefined"
      :disabled="action.disabled === true"
      @click.stop="handleButtonClick"
    />
    <OcFloatingLayer
      v-if="isMenuOpen && hasActionChildren(action)"
      :open="true"
      :anchor="rootRef"
      placement="bottom-end"
      :gap="0"
      :max-height="480"
      class="oc-action-button__floating"
      :data-oc-action-menu-branch="menuBranchId"
      @pointerenter="cancelCloseMenu"
      @pointerleave="scheduleCloseMenu"
    >
      <OcActionMenu
        v-if="hasActionChildren(action)"
        :actions="action.children"
        :branch-id="menuBranchId"
        @select="handleMenuSelect"
        @dismiss="closeMenu"
        @keep-open="cancelCloseMenu"
      />
    </OcFloatingLayer>
  </div>
</template>

<script lang="ts">
export type {
  OcActionDefinition as OcActionButtonAction,
  OcActionSelectPayload as OcActionButtonSelectPayload,
} from './OcActionMenu.vue'
</script>

<script setup lang="ts">
import { onBeforeUnmount, ref, useId } from 'vue'
import OcButton from '../base/OcButton.vue'
import OcActionMenu, {
  type OcActionDefinition,
  type OcActionMenuEntry,
  type OcActionSelectPayload,
  isActionMenuBranchEvent,
} from './OcActionMenu.vue'
import OcFloatingLayer from './OcFloatingLayer.vue'

type ActionButtonSize = 'sm' | 'md' | 'lg'
type ActionButtonVariant = 'solid' | 'soft' | 'ghost' | 'outline'

defineOptions({
  name: 'OcActionButton',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  action: OcActionDefinition
  size?: ActionButtonSize
  variant?: ActionButtonVariant
}>(), {
  size: 'md',
  variant: 'ghost',
})

const emit = defineEmits<{
  select: [payload: OcActionSelectPayload]
}>()

const rootRef = ref<HTMLElement | null>(null)
const menuBranchId = useId()
const isMenuOpen = ref(false)
const isMenuPinned = ref(false)
let closeTimer: number | null = null
let listeningForOutsidePointer = false

onBeforeUnmount(() => {
  cancelCloseMenu()
  stopListeningForOutsidePointer()
})

function handleButtonClick(): void {
  if (props.action.disabled) {
    return
  }

  if (hasActionChildren(props.action)) {
    if (isMenuPinned.value) {
      closeMenu()
      return
    }
    isMenuPinned.value = true
    startListeningForOutsidePointer()
    openMenu()
    return
  }

  emit('select', { key: props.action.key })
}

function handleMenuSelect(payload: OcActionSelectPayload): void {
  closeMenu()
  emit('select', payload)
}

function openMenu(): void {
  if (props.action.disabled || !hasActionChildren(props.action) || !rootRef.value) {
    return
  }

  cancelCloseMenu()
  isMenuOpen.value = true
}

function scheduleCloseMenu(): void {
  if (isMenuPinned.value) return
  cancelCloseMenu()
  closeTimer = window.setTimeout(() => {
    closeMenu()
  }, 90)
}

function cancelCloseMenu(): void {
  if (closeTimer === null) {
    return
  }

  window.clearTimeout(closeTimer)
  closeTimer = null
}

function closeMenu(): void {
  cancelCloseMenu()
  isMenuPinned.value = false
  isMenuOpen.value = false
  stopListeningForOutsidePointer()
}

function startListeningForOutsidePointer(): void {
  if (listeningForOutsidePointer) return
  listeningForOutsidePointer = true
  document.addEventListener('pointerdown', handleDocumentPointerDown, true)
}

function stopListeningForOutsidePointer(): void {
  if (!listeningForOutsidePointer) return
  listeningForOutsidePointer = false
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!isMenuPinned.value) return
  const path = event.composedPath()
  const isInsideTrigger = rootRef.value ? path.includes(rootRef.value) : false
  const isInsideActionMenu = isActionMenuBranchEvent(event, menuBranchId)
  if (!isInsideTrigger && !isInsideActionMenu) closeMenu()
}

function hasActionChildren(
  action: OcActionDefinition,
): action is OcActionDefinition & { children: readonly OcActionMenuEntry[] } {
  return Array.isArray(action.children) && action.children.length > 0
}
</script>

<style>
.oc-action-button {
  position: relative;
  display: inline-flex;
}

.oc-action-button__floating {
  overflow: visible;
}
</style>
