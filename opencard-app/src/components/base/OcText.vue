<!-- Base 文本组件：独立实现排版层级与文本色调，不依赖 shared primitives。 -->
<template>
  <component :is="as" class="oc-text" :class="textClass">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type OcTextTone = 'primary' | 'secondary' | 'muted' | 'label' | 'info'
type OcTextSize = 'label' | 'body' | 'title'

interface OcTextProps {
  /** 根元素标签。 */
  as?: string
  /** 文本色调语义 token。 */
  tone?: OcTextTone
  /** 文本排版层级 token。 */
  size?: OcTextSize
  /** 是否启用单行省略。 */
  truncate?: boolean
}

defineOptions({ name: 'OcText' })

const props = withDefaults(defineProps<OcTextProps>(), {
  as: 'span',
  tone: 'primary',
  truncate: false,
})

const textClass = computed(() => [
  `oc-text--tone-${props.tone}`,
  props.size ? `oc-text--size-${props.size}` : null,
  { 'is-truncate': props.truncate },
])
</script>

<style scoped>
.oc-text {
  min-width: 0;
  font-family: var(--oc-font-family-ui);
  font-size: var(--oc-body-size);
}

.oc-text--tone-primary {
  color: var(--oc-text-primary);
}

.oc-text--tone-secondary {
  color: var(--oc-text-secondary);
}

.oc-text--tone-muted {
  color: var(--oc-text-muted);
}

.oc-text--tone-label {
  color: var(--oc-text-label);
}

.oc-text--tone-info {
  color: var(--oc-text-info);
}

.oc-text--size-label {
  font-size: var(--oc-label-size);
}

.oc-text--size-body {
  font-size: var(--oc-body-size);
}

.oc-text--size-title {
  font-size: var(--oc-title-size);
}

.oc-text.is-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
