<template>
  <i
    v-if="icon.kind === 'codicon'"
    class="oc-icon codicon"
    :class="[icon.value, sizeClass]"
    :style="iconStyle"
    aria-hidden="true"
    v-bind="$attrs"
  />
  <svg
    v-else
    class="oc-icon oc-icon-svg"
    :class="[sizeClass]"
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
import { resolveIcon, type IconResolvable, type IconTone } from '../icon/iconRegistry'

type OcIconTone =
  | IconTone
  | 'opencard'
  | 'json'
  | 'markdown'
  | 'typescript'
  | 'javascript'
  | 'vue'
  | 'html'
  | 'css'
  | 'image'
  | 'package'
  | 'config'
  | 'folder-default'
  | 'folder-open'
  | 'folder-src'
  | 'folder-assets'
  | 'folder-components'
  | 'folder-views'
  | 'folder-locales'
  | 'folder-core'

type OcIconSize = 'sm' | 'md' | 'lg' | number | string

defineOptions({
  name: 'OcIcon',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  name?: IconResolvable
  tone?: OcIconTone
  size?: OcIconSize
  color?: string
}>(), {
  name: 'file.default',
  tone: 'default',
  size: 'md',
})

const icon = computed(() => resolveIcon(props.name))

const iconColorMap: Record<OcIconTone, string> = {
  default: 'var(--icon-default)',
  muted: 'var(--icon-muted)',
  primary: 'var(--icon-primary)',
  success: 'var(--icon-success)',
  warning: 'var(--icon-warning)',
  danger: 'var(--icon-danger)',
  opencard: 'var(--icon-opencard)',
  json: 'var(--icon-json)',
  markdown: 'var(--icon-markdown)',
  typescript: 'var(--icon-typescript)',
  javascript: 'var(--icon-javascript)',
  vue: 'var(--icon-vue)',
  html: 'var(--icon-html)',
  css: 'var(--icon-css)',
  image: 'var(--icon-image)',
  package: 'var(--icon-package)',
  config: 'var(--icon-config)',
  'folder-default': 'var(--icon-folder-default)',
  'folder-open': 'var(--icon-folder-open)',
  'folder-src': 'var(--icon-folder-src)',
  'folder-assets': 'var(--icon-folder-assets)',
  'folder-components': 'var(--icon-folder-components)',
  'folder-views': 'var(--icon-folder-views)',
  'folder-locales': 'var(--icon-folder-locales)',
  'folder-core': 'var(--icon-folder-core)',
}

const sizeClass = computed(() => {
  if (props.size === 'sm' || props.size === 'md' || props.size === 'lg') {
    return `oc-icon--${props.size}`
  }

  return null
})

const customSize = computed(() => {
  if (sizeClass.value) {
    return null
  }

  if (props.size === undefined || props.size === null) {
    return null
  }

  return typeof props.size === 'number' ? `${props.size}px` : props.size
})

const iconStyle = computed(() => ({
  color: props.color ?? iconColorMap[props.tone],
  ...(customSize.value
    ? {
      fontSize: customSize.value,
      width: customSize.value,
      height: customSize.value,
    }
    : {}),
}))
</script>

<style scoped>
.oc-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
}

.oc-icon-svg {
  overflow: visible;
}

.oc-icon--sm {
  font-size: 12px;
  width: 12px;
  height: 12px;
}

.oc-icon--md {
  font-size: 14px;
  width: 14px;
  height: 14px;
}

.oc-icon--lg {
  font-size: 18px;
  width: 18px;
  height: 18px;
}
</style>
