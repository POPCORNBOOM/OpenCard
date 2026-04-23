<template>
  <OcPressable
    class="oc-tool-button"
    :class="toolButtonClass"
    :style="toolButtonStyle"
    :variant="resolvedVariant"
    :size="resolvedSize"
    :radius="resolvedRadius"
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
import { computed, type CSSProperties } from 'vue'
import { OcIcon, OcPressable, OcText } from '../../shared/ui/primitives'

type ToolButtonKind = 'menu' | 'sidebar' | 'panel'

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
  width?: string
  minWidth?: string
  height?: string
  minHeight?: string
}>(), {
  label: undefined,
  icon: undefined,
  iconOnly: false,
  active: false,
  disabled: false,
  title: undefined,
  ariaLabel: undefined,
  kind: 'panel',
  width: undefined,
  minWidth: undefined,
  height: undefined,
  minHeight: undefined,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const resolvedVariant = computed(() => props.iconOnly ? 'icon' : 'ghost')
const resolvedSize = computed(() => props.kind === 'panel' ? 'sm' : 'md')
const resolvedRadius = computed(() => props.kind === 'menu' ? 'sm' : 'none')
const resolvedTitle = computed(() => props.title ?? props.label ?? props.ariaLabel)
const resolvedAriaLabel = computed(() => props.ariaLabel ?? (props.iconOnly ? props.label ?? props.title : undefined))

const toolButtonClass = computed(() => [
  `oc-tool-button--${props.kind}`,
  {
    'is-icon-only': props.iconOnly,
  },
])

const toolButtonStyle = computed<CSSProperties>(() => ({
  ...(props.width ? { width: props.width } : {}),
  ...(props.minWidth ? { minWidth: props.minWidth } : {}),
  ...(props.height ? { height: props.height } : {}),
  ...(props.minHeight ? { minHeight: props.minHeight } : {}),
}))
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

.oc-tool-button--menu:not(.is-icon-only) {
  min-height: 28px;
  padding: 0 var(--oc-space-2);
  font-size: 13px;
}

.oc-tool-button--sidebar {
  width: 48px;
  height: 48px;
  position: relative;
  border-radius: 0;
}

.oc-tool-button--sidebar:hover {
  background: var(--oc-bg-hover);
}

.oc-tool-button--sidebar:focus-visible {
  outline-offset: -2px;
}

.oc-tool-button--sidebar.is-active {
  background: var(--oc-bg-base);
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

.oc-tool-button--panel {
  min-width: 22px;
  min-height: 22px;
}
</style>
