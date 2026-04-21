<template>
  <span
    class="oc-icon codicon"
    :class="[name, sizeClass]"
    :style="iconStyle"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

type OcIconTone =
  | 'default'
  | 'muted'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
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

type OcIconSize = 'sm' | 'md' | 'lg'

defineOptions({ name: 'OcIcon' })

const props = withDefaults(defineProps<{
  name: string
  tone?: OcIconTone
  size?: OcIconSize
}>(), {
  tone: 'default',
  size: 'md',
})

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

const iconStyle = computed(() => ({
  color: iconColorMap[props.tone],
}))

const sizeClass = computed(() => `oc-icon--${props.size}`)
</script>

<style scoped>
.oc-icon {
  line-height: 1;
}

.oc-icon--sm {
  font-size: 12px;
}

.oc-icon--md {
  font-size: 14px;
}

.oc-icon--lg {
  font-size: 18px;
}
</style>

