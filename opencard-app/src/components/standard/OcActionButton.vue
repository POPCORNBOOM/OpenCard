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
      :title="action.title"
      :aria-label="action.title ?? action.key"
      :aria-haspopup="hasActionChildren(action) ? 'menu' : undefined"
      :aria-expanded="hasActionChildren(action) ? isMenuOpen : undefined"
      :disabled="action.disabled === true"
      @click.stop="handleButtonClick"
    />
    <OcFloatingLayer
      :open="isMenuOpen && hasActionChildren(action)"
      :anchor="rootRef"
      placement="bottom-end"
      :gap="0"
      :max-height="480"
      class="oc-action-button__floating"
      @pointerenter="cancelCloseMenu"
      @pointerleave="scheduleCloseMenu"
    >
      <OcActionMenu
        v-if="hasActionChildren(action)"
        :actions="action.children"
        @select="handleMenuSelect"
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
import { onBeforeUnmount, ref } from 'vue'
import OcButton from '../base/OcButton.vue'
import OcActionMenu, {
  type OcActionDefinition,
  type OcActionMenuEntry,
  type OcActionSelectPayload,
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
const isMenuOpen = ref(false)
let closeTimer: number | null = null

onBeforeUnmount(() => {
  cancelCloseMenu()
})

function handleButtonClick(): void {
  if (props.action.disabled) {
    return
  }

  if (hasActionChildren(props.action)) {
    if (isMenuOpen.value) {
      closeMenu()
      return
    }
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
  isMenuOpen.value = false
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
