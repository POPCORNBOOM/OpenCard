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
      <OcActionButtonMenu
        v-if="hasActionChildren(action)"
        class="oc-action-button__menu--root"
        :actions="action.children"
        @select="handleMenuSelect"
        @keep-open="cancelCloseMenu"
      />
    </OcFloatingLayer>
  </div>
</template>

<script lang="ts">
import type { IconToken, IconTone } from '../../shared/ui/icon/iconRegistry'

export interface OcActionButtonAction {
  key: string
  icon?: IconToken
  iconTone?: IconTone
  title?: string
  disabled?: boolean
  children?: OcActionButtonAction[]
}

export interface OcActionButtonSelectPayload {
  key: string
}
</script>

<script setup lang="ts">
import { defineComponent, onBeforeUnmount, ref, h, type ComponentPublicInstance, type PropType, type VNode } from 'vue'
import OcButton from '../base/OcButton.vue'
import OcIcon from '../base/OcIcon.vue'
import OcFloatingLayer from './OcFloatingLayer.vue'

type ActionButtonSize = 'sm' | 'md' | 'lg'
type ActionButtonVariant = 'solid' | 'soft' | 'ghost' | 'outline'

defineOptions({
  name: 'OcActionButton',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  action: OcActionButtonAction
  size?: ActionButtonSize
  variant?: ActionButtonVariant
}>(), {
  size: 'md',
  variant: 'ghost',
})

const emit = defineEmits<{
  select: [payload: OcActionButtonSelectPayload]
}>()

const rootRef = ref<HTMLElement | null>(null)
const isMenuOpen = ref(false)
let closeTimer: number | null = null

const OcActionButtonMenu: ReturnType<typeof defineComponent> = defineComponent({
  name: 'OcActionButtonMenu',
  props: {
    actions: {
      type: Array as PropType<OcActionButtonAction[]>,
      required: true,
    },
  },
  emits: {
    select: (_payload: OcActionButtonSelectPayload) => true,
    keepOpen: () => true,
  },
  setup(menuProps, { emit: menuEmit }) {
    const openChildKey = ref<string | null>(null)
    const childAnchors = new Map<string, HTMLElement>()
    let childCloseTimer: number | null = null

    onBeforeUnmount(() => {
      cancelChildClose()
    })

    function setChildAnchor(
      key: string,
      element: Element | ComponentPublicInstance | null,
    ): void {
      if (element instanceof HTMLElement) {
        childAnchors.set(key, element)
        return
      }
      childAnchors.delete(key)
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
      menuEmit('keepOpen')
    }

    function renderAction(action: OcActionButtonAction): VNode {
      const hasChildren = hasActionChildren(action)
      const isChildOpen = hasChildren && openChildKey.value === action.key

      return h(
        'div',
        {
          key: action.key,
          class: {
            'oc-action-button__menu-item': true,
            'is-disabled': action.disabled === true,
            'has-children': hasChildren,
          },
          onPointerenter: () => {
            if (hasChildren && action.disabled !== true) openChild(action.key)
          },
          onPointerleave: () => {
            if (hasChildren) scheduleChildClose()
          },
          onFocusin: () => {
            if (hasChildren && action.disabled !== true) openChild(action.key)
          },
          onFocusout: () => {
            if (hasChildren) scheduleChildClose()
          },
        },
        [
          h(
            'button',
            {
              ref: (element: Element | ComponentPublicInstance | null) => setChildAnchor(action.key, element),
              type: 'button',
              class: 'oc-action-button__menu-button',
              disabled: action.disabled === true,
              title: action.title,
              role: 'menuitem',
              'aria-haspopup': hasChildren ? 'menu' : undefined,
              'aria-expanded': hasChildren ? isChildOpen : undefined,
              onClick: (event: MouseEvent) => {
                event.stopPropagation()
                if (!hasChildren && action.disabled !== true) {
                  menuEmit('select', { key: action.key })
                }
              },
            },
            [
              action.icon
                ? h(OcIcon, {
                  name: action.icon,
                  tone: action.iconTone,
                  size: 'sm',
                  class: 'oc-action-button__menu-icon',
                })
                : h('span', { class: 'oc-action-button__menu-icon-spacer' }),
              h('span', { class: 'oc-action-button__menu-label' }, action.title ?? action.key),
              hasChildren
                ? h(OcIcon, {
                  name: 'nav.arrow-right',
                  size: 'sm',
                  class: 'oc-action-button__menu-caret',
                })
                : null,
            ],
          ),
          hasChildren
            ? h(
              OcFloatingLayer,
              {
                open: isChildOpen,
                anchor: childAnchors.get(action.key) ?? null,
                placement: 'right-start',
                gap: 0,
                maxHeight: 480,
                class: 'oc-action-button__floating',
                onPointerenter: keepMenusOpen,
                onPointerleave: scheduleChildClose,
              },
              {
                default: () => h(OcActionButtonMenu, {
                  class: 'oc-action-button__menu--root',
                  actions: action.children,
                  onSelect: (payload: OcActionButtonSelectPayload) => menuEmit('select', payload),
                  onKeepOpen: keepMenusOpen,
                }),
              },
            )
            : null,
        ],
      )
    }

    return (): VNode => h(
      'div',
      {
        class: 'oc-action-button__menu',
        role: 'menu',
      },
      menuProps.actions.map(renderAction),
    )
  },
})

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

function handleMenuSelect(payload: OcActionButtonSelectPayload): void {
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
  action: OcActionButtonAction,
): action is OcActionButtonAction & { children: OcActionButtonAction[] } {
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

.oc-action-button__menu {
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

.oc-action-button__menu--root {
  display: block;
}
.oc-action-button__menu-item {
  position: relative;
}

.oc-action-button__menu-button {
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

.oc-action-button__menu-button:hover:not(:disabled),
.oc-action-button__menu-button:focus-visible {
  background: var(--oc-bg-hover);
  outline: none;
}

.oc-action-button__menu-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.oc-action-button__menu-icon,
.oc-action-button__menu-icon-spacer,
.oc-action-button__menu-caret {
  flex: 0 0 auto;
}

.oc-action-button__menu-icon-spacer {
  width: var(--oc-size-sm);
  height: var(--oc-size-sm);
}

.oc-action-button__menu-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
