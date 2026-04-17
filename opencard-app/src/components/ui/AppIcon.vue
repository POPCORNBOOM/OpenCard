<template>
  <i
    v-if="icon.kind === 'codicon'"
    class="app-icon codicon"
    :class="[icon.value, toneClass]"
    :style="iconStyle"
    v-bind="$attrs"
  />
  <svg
    v-else
    class="app-icon app-icon-svg"
    :class="toneClass"
    :style="iconStyle"
    :viewBox="icon.viewBox ?? '0 0 24 24'"
    fill="currentColor"
    aria-hidden="true"
    v-bind="$attrs"
  >
    <path :d="icon.value" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolveIcon, type IconDefinition, type IconName, type IconTone } from '../../shared/ui/icon/iconRegistry'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  name?: IconName | string | { icon?: string } | IconDefinition
  size?: number | string
  color?: string
  tone?: IconTone
}>()

const icon = computed(() => resolveIcon(props.name))
const toneClass = computed(() => (props.tone ? `app-icon-tone-${props.tone}` : ''))
const normalizedSize = computed(() => {
  if (props.size === undefined) {
    return '1em'
  }

  return typeof props.size === 'number' ? `${props.size}px` : props.size
})

const iconStyle = computed(() => ({
  fontSize: normalizedSize.value,
  width: normalizedSize.value,
  height: normalizedSize.value,
  color: props.color,
}))
</script>

<style scoped>
.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--icon-default);
}

.app-icon-svg {
  overflow: visible;
}

.app-icon-tone-default {
  color: var(--icon-default);
}

.app-icon-tone-muted {
  color: var(--icon-muted);
}

.app-icon-tone-primary {
  color: var(--icon-primary);
}

.app-icon-tone-success {
  color: var(--icon-success);
}

.app-icon-tone-warning {
  color: var(--icon-warning);
}

.app-icon-tone-danger {
  color: var(--icon-danger);
}
</style>
