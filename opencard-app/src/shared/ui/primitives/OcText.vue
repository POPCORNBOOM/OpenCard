<!-- 文本呈现原语：只负责排版层级与文本色调，不承载交互语义。 -->
<template>
  <component
    :is="as"
    class="oc-text"
    :class="textClass"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type OcTextTone = 'primary' | 'secondary' | 'muted' | 'label' | 'info'
type OcTextSize = 'label' | 'body' | 'title'

defineOptions({ name: 'OcText' })

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

const props = withDefaults(defineProps<OcTextProps>(), {
  as: 'span',
  tone: 'primary',
  size: 'body',
  truncate: false,
})

const textClass = computed(() => [
  `oc-text--tone-${props.tone}`,
  `oc-text--size-${props.size}`,
  { 'is-truncate': props.truncate },
])
</script>

<style scoped>
.oc-text {
  min-width: 0;
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
