<!-- Standard 标签页：组合 OcButton 实现 tab 行为、脏标记与关闭动作。 -->
<template>
  <div class="oc-tab" :class="tabClass" role="tab" :tabindex="tabTabindex" :aria-selected="active ? 'true' : 'false'"
    :aria-disabled="disabled ? 'true' : undefined" :title="resolvedTitle" data-oc-tab @click="handleSelect"
    @keydown="handleKeydown">
    <span v-if="dirty" class="oc-tab__dirty-dot" aria-hidden="true" />
    <OcText class="oc-tab__label">{{ label }}</OcText>
    <OcButton v-if="closable" class="oc-tab__close" variant="icon" icon="icon.close" icon-only size="sm"
      :disabled="disabled" :tabindex="closeTabindex" :title="resolvedCloseLabel" :aria-label="resolvedCloseLabel"
      @click.stop="handleClose" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcButton from '../base/OcButton.vue'
import OcText from '../base/OcText.vue'

interface OcTabProps {
  /** 标签文案。 */
  label: string
  /** 是否处于激活态。 */
  active?: boolean
  /** 是否显示脏标记。 */
  dirty?: boolean
  /** 是否显示关闭按钮。 */
  closable?: boolean
  /** 是否禁用。 */
  disabled?: boolean
  /** 鼠标悬停 title。 */
  title?: string
  /** 关闭按钮 aria-label。 */
  closeAriaLabel?: string
}

interface OcTabEmits {
  /** 请求激活当前 tab。 */
  select: []
  /** 请求关闭当前 tab。 */
  close: []
}

defineOptions({ name: 'OcTab' })

const props = withDefaults(defineProps<OcTabProps>(), {
  active: false,
  dirty: false,
  closable: true,
  disabled: false,
  title: undefined,
  closeAriaLabel: undefined,
})

const emit = defineEmits<OcTabEmits>()

const resolvedTitle = computed(() => props.title ?? props.label)
const resolvedCloseLabel = computed(() => props.closeAriaLabel ?? `Close ${props.label}`)

const tabClass = computed(() => ({
  'is-active': props.active,
  'is-disabled': props.disabled,
  'is-dirty': props.dirty,
  'is-closable': props.closable,
}))

const tabTabindex = computed(() => {
  if (props.disabled) {
    return -1
  }

  return props.active ? 0 : -1
})

const closeTabindex = computed(() => {
  if (props.disabled || !props.active) {
    return -1
  }

  return 0
})

function handleSelect(): void {
  if (props.disabled) {
    return
  }

  emit('select')
}

function handleClose(): void {
  if (props.disabled) {
    return
  }

  emit('close')
}

function handleKeydown(event: KeyboardEvent): void {
  if (props.disabled || event.target !== event.currentTarget) {
    return
  }

  if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
    return
  }

  event.preventDefault()
  emit('select')
}
</script>

<style scoped>
.oc-tab {
  min-width: 0;
  max-width: 240px;
  min-height: 32px;
  padding: 0 var(--oc-space-3);
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-2);
  border-right: 1px solid var(--oc-border-strong);
  border-bottom: 1px solid var(--oc-border-strong);
  background: var(--oc-bg-elevated);
  color: var(--oc-text-secondary);
  cursor: pointer;
  user-select: none;
  outline: none;
  transition:
    background-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    border-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard);
}

.oc-tab:hover {
  background: var(--oc-bg-hover);
  color: var(--oc-text-primary);
}

.oc-tab:focus-visible {
  outline: var(--oc-focus-ring-width) solid var(--oc-accent-glow);
  outline-offset: -2px;
  position: relative;
  z-index: 1;
}

.oc-tab.is-active {
  background: var(--oc-bg-base);
  color: var(--oc-text-primary);
  border-bottom-color: var(--oc-bg-base);
}

.oc-tab.is-disabled {
  color: var(--oc-text-disabled);
  cursor: default;
  background: var(--oc-bg-elevated);
}

.oc-tab__dirty-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: var(--oc-radius-pill);
  background: var(--oc-bg-accent);
}

.oc-tab__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--oc-text-primary);
}

.oc-tab__close {
  margin-left: auto;
  flex-shrink: 0;
  opacity: 0.56;
}

.oc-tab:hover .oc-tab__close,
.oc-tab:focus-within .oc-tab__close,
.oc-tab.is-active .oc-tab__close,
.oc-tab__close:focus-visible {
  opacity: 1;
}

.oc-tab.is-disabled .oc-tab__close {
  opacity: 0.4;
}
</style>
