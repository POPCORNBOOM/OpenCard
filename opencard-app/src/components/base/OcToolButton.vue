<template>
  <OcPressable
    class="oc-tool-button"
    :class="toolButtonClass"
    :variant="resolvedVariant"
    :size="resolvedSize"
    :radius="resolvedRadius"
    :block="resolvedBlock"
    :icon-only="iconOnly"
    :active="active"
    :disabled="disabled"
    :title="resolvedTitle"
    :aria-label="resolvedAriaLabel"
    @click="emit('click', $event)"
  >
    <slot>
      <template v-if="iconOnly">
        <OcIcon v-if="icon" class="oc-tool-button__icon" :name="icon" />
      </template>
      <template v-else>
        <OcIcon v-if="icon" class="oc-tool-button__icon" :name="icon" />
        <OcText v-if="label" as="span" class="oc-tool-button__label">{{ label }}</OcText>
      </template>
    </slot>
  </OcPressable>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { OcIcon, OcPressable, OcText } from '../../shared/ui/primitives'

type ToolButtonKind = 'menu' | 'sidebar' | 'panel'
type ToolButtonSize = 'sm' | 'md' | 'lg'

defineOptions({ name: 'OcToolButton' })

const props = withDefaults(defineProps<{
  label?: string
  icon?: string
  iconOnly?: boolean
  active?: boolean
  disabled?: boolean
  title?: string
  ariaLabel?: string
  kind?: ToolButtonKind
  size?: ToolButtonSize
  block?: boolean
}>(), {
  label: undefined,
  icon: undefined,
  iconOnly: false,
  active: false,
  disabled: false,
  title: undefined,
  ariaLabel: undefined,
  kind: 'panel',
  size: undefined,
  block: undefined,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const resolvedVariant = computed(() => props.iconOnly ? 'icon' : 'ghost')
const resolvedSize = computed<ToolButtonSize>(() => {
  if (props.size) {
    return props.size
  }

  return props.kind === 'panel' ? 'sm' : 'md'
})
const resolvedRadius = computed(() => props.kind === 'menu' ? 'sm' : 'none')
const resolvedBlock = computed(() => props.block ?? (props.kind === 'sidebar'))
const resolvedTitle = computed(() => props.title ?? props.label ?? props.ariaLabel)
const resolvedAriaLabel = computed(() => props.ariaLabel ?? (props.iconOnly ? props.label ?? props.title : undefined))

const toolButtonClass = computed(() => [
  `oc-tool-button--${props.kind}`,
  `oc-tool-button--size-${resolvedSize.value}`,
  {
    'is-icon-only': props.iconOnly,
    'is-block': resolvedBlock.value,
  },
])
</script>

<style scoped>
.oc-tool-button {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.oc-tool-button__icon {
  flex-shrink: 0;
}

.oc-tool-button__label {
  white-space: nowrap;
}

.oc-tool-button--menu.oc-tool-button--size-sm:not(.is-icon-only) {
  min-height: 24px;
  padding: 0 var(--oc-space-1);
  font-size: 13px;
}

.oc-tool-button--menu.oc-tool-button--size-md:not(.is-icon-only) {
  min-height: 28px;
  padding: 0 var(--oc-space-2);
  font-size: 13px;
}

.oc-tool-button--menu.oc-tool-button--size-lg:not(.is-icon-only) {
  min-height: 32px;
  padding: 0 var(--oc-space-3);
  font-size: 13px;
}

.oc-tool-button--sidebar {
  position: relative;
  border-radius: 0;
}

.oc-tool-button--sidebar.is-block.is-icon-only {
  width: 100%;
  height: auto;
}

.oc-tool-button--sidebar.oc-tool-button--size-sm {
  min-height: 44px;
}

.oc-tool-button--sidebar.oc-tool-button--size-md {
  min-height: 48px;
}

.oc-tool-button--sidebar.oc-tool-button--size-lg {
  min-height: 56px;
}

.oc-tool-button--sidebar:focus-visible {
  outline-offset: -2px;
}

.oc-tool-button--sidebar.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--oc-accent);
}

.oc-tool-button--panel.oc-tool-button--size-sm {
  min-width: 22px;
}

.oc-tool-button--panel.oc-tool-button--size-sm.is-icon-only {
  min-height: 22px;
  width: 22px;
  height: 22px;
}

.oc-tool-button--panel.oc-tool-button--size-md.is-icon-only {
  width: 26px;
  height: 26px;
}

.oc-tool-button--panel.oc-tool-button--size-lg.is-icon-only {
  width: 32px;
  height: 32px;
}
</style>
