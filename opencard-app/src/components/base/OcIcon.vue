<!-- Base 图标：渲染项目语义图标的 MDI SVG path。 -->
<template>
  <svg
    class="oc-icon oc-icon-svg"
    :class="[sizeClass]"
    :style="iconStyle"
    :viewBox="icon.viewBox ?? '0 0 24 24'"
    fill="currentColor"
    aria-hidden="true"
    v-bind="forwardedAttrs"
  >
    <path :d="icon.path" />
  </svg>
</template>

<script lang="ts">
export type OcIconSize = 'sm' | 'md' | 'lg' | 'action' | 'display'
</script>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { resolveIcon, type IconResolvable, type IconTone } from '../../shared/ui/icon/iconRegistry'

/**
 * Icon tone/color semantic tokens.
 * Base tones: default, muted, accent, success, warning, danger
 * File-type tones: file-opencard, file-json, file-markdown, file-typescript, file-javascript, file-vue, file-html, file-css, file-image, file-config
 * Folder tones: folder, folder-open
 */
/**
 * OcIcon component props.
 */
interface OcIconProps {
  /** 图标注册键 */
  name?: IconResolvable
  /** 图标色调 */
  tone?: IconTone
  /** 图标尺寸 */
  size?: OcIconSize
}

defineOptions({
  name: 'OcIcon',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<OcIconProps>(), {
  name: 'file.generic',
  tone: 'default',
  size: 'md',
})

const attrs = useAttrs()
const icon = computed(() => resolveIcon(props.name, 'OcIcon.props.name'))

const forwardedAttrs = computed(() => {
  const { color: _deprecatedColor, ...restAttrs } = attrs
  return restAttrs
})

const iconColorMap: Record<IconTone, string> = {
  default: 'var(--oc-icon-default)',
  muted: 'var(--oc-icon-muted)',
  primary: 'var(--oc-icon-accent)',
  success: 'var(--oc-icon-success)',
  active: 'var(--oc-icon-active)',
  warning: 'var(--oc-icon-warning)',
  danger: 'var(--oc-icon-danger)',
  opencard: 'var(--oc-icon-file-opencard)',
  json: 'var(--oc-icon-file-json)',
  markdown: 'var(--oc-icon-file-markdown)',
  typescript: 'var(--oc-icon-file-typescript)',
  javascript: 'var(--oc-icon-file-javascript)',
  vue: 'var(--oc-icon-file-vue)',
  html: 'var(--oc-icon-file-html)',
  css: 'var(--oc-icon-file-css)',
  image: 'var(--oc-icon-file-image)',
  config: 'var(--oc-icon-file-config)',
  'folder-default': 'var(--oc-icon-folder)',
  'folder-open': 'var(--oc-icon-folder-open)',
  'block-text': 'var(--oc-icon-block-text)',
  'block-markdown': 'var(--oc-icon-block-markdown)',
  'block-image': 'var(--oc-icon-block-image)',
  'block-qrcode': 'var(--oc-icon-block-qrcode)',
  'block-shape': 'var(--oc-icon-block-shape)',
  'block-simple-container': 'var(--oc-icon-block-simple-container)',
  'block-flow-container': 'var(--oc-icon-block-flow-container)',
}

const sizeClass = computed(() => `oc-icon--${props.size}`)

const iconStyle = computed(() => ({
  color: iconColorMap[props.tone] ?? iconColorMap.default,
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
  font-size: var(--oc-icon-size-sm);
  width: var(--oc-icon-size-sm);
  height: var(--oc-icon-size-sm);
}

.oc-icon--md {
  font-size: var(--oc-icon-size-md);
  width: var(--oc-icon-size-md);
  height: var(--oc-icon-size-md);
}

.oc-icon--lg {
  font-size: var(--oc-icon-size-lg);
  width: var(--oc-icon-size-lg);
  height: var(--oc-icon-size-lg);
}

.oc-icon--action {
  font-size: var(--oc-icon-size-action);
  width: var(--oc-icon-size-action);
  height: var(--oc-icon-size-action);
}

.oc-icon--display {
  font-size: var(--oc-icon-size-display);
  width: var(--oc-icon-size-display);
  height: var(--oc-icon-size-display);
}
</style>
