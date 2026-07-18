<!-- Standard 操作组：一组操作按钮，支持菜单/侧栏/普通动作。 -->
<script lang="ts">
import type { IconToken } from '../../shared/ui/icon/iconRegistry'

export interface OcActionGroupAction {
  key: string
  icon?: IconToken
  label?: string
  title?: string
  ariaLabel?: string
  disabled?: boolean
}

export interface OcActionGroupActionPayload {
  key: string
}
</script>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import OcButton from '../base/OcButton.vue'

interface Props {
  actions: readonly OcActionGroupAction[]
  preset?: 'default' | 'menu' | 'sidebar'
  mode?: 'normal' | 'toggle' | 'radio'
  modelValue?: string | string[] | null
  size?: 'sm' | 'md' | 'lg'
  direction?: 'horizontal' | 'vertical'
  iconOnly?: boolean
  disabled?: boolean
  grow?: boolean
  shrink?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  preset: 'default',
  mode: 'normal',
  modelValue: null,
  size: 'sm',
  direction: undefined,
  iconOnly: undefined,
  disabled: false,
  grow: false,
  shrink: true,
})

const emit = defineEmits<{
  action: [payload: OcActionGroupActionPayload]
  'update:modelValue': [value: string | string[]]
}>()

const attrs = useAttrs()

defineOptions({ name: 'OcActionGroup', inheritAttrs: false })

const resolvedDirection = computed(() => props.direction ?? (props.preset === 'sidebar' ? 'vertical' : 'horizontal'))
const resolvedIconOnly = computed(() => props.iconOnly ?? props.preset === 'sidebar')
const groupClass = computed(() => [
  `oc-action-group--${resolvedDirection.value}`,
  `oc-action-group--preset-${props.preset}`,
  {
    'oc-action-group--grow': props.grow,
    'oc-action-group--no-shrink': props.shrink === false,
  },
])

function isActive(key: string): boolean {
  if (props.mode === 'radio') {
    return props.modelValue === key
  }
  if (props.mode === 'toggle') {
    return Array.isArray(props.modelValue) && props.modelValue.includes(key)
  }
  return false
}

function handleActionClick(key: string): void {
  if (props.disabled) return

  emit('action', { key })

  if (props.mode === 'radio') {
    emit('update:modelValue', key)
    return
  }

  if (props.mode === 'toggle') {
    const current = Array.isArray(props.modelValue) ? [...props.modelValue] : []
    const index = current.indexOf(key)
    if (index > -1) {
      current.splice(index, 1)
    } else {
      current.push(key)
    }
    emit('update:modelValue', current)
  }
}
</script>

<template>
  <div class="oc-action-group" :class="groupClass" v-bind="attrs">
    <OcButton
      v-for="action in actions"
      :key="action.key"
      :icon="action.icon"
      :size="size"
      :disabled="disabled || action.disabled"
      :variant="isActive(action.key) ? 'solid' : (preset === 'menu' ? 'ghost' : 'soft')"
      :icon-only="resolvedIconOnly"
      :title="action.title ?? action.label"
      @click="handleActionClick(action.key)"
    >
      {{ action.label ?? action.title }}
    </OcButton>
  </div>
</template>

<style scoped>
.oc-action-group {
  display: flex;
  gap: var(--oc-space-1);
  min-width: 0;
}

.oc-action-group--vertical {
  flex-direction: column;
}

.oc-action-group--horizontal {
  flex-direction: row;
  align-items: center;
}

.oc-action-group--grow {
  flex: 1 1 auto;
}

.oc-action-group--no-shrink {
  flex-shrink: 0;
}

.oc-action-group--preset-menu {
  gap: var(--oc-space-1);
}

.oc-action-group--preset-sidebar {
  align-items: stretch;
  padding: var(--oc-space-1);
}
</style>
