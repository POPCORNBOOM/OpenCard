<!-- Base 空状态提示：独立实现文案尺寸、色调与对齐策略，不依赖 shared primitives。 -->
<template>
  <p
    class="oc-empty-hint"
    :class="hintClass"
  >
    <slot />
  </p>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type EmptyHintTone = 'dim' | 'muted'
type EmptyHintSize = 'label' | 'body'
type EmptyHintAlign = 'start' | 'center'
type EmptyHintInset = 'none' | 'compact' | 'comfortable'

interface OcEmptyHintProps {
  /** 文案色调。 */
  tone?: EmptyHintTone
  /** 文案尺寸。 */
  size?: EmptyHintSize
  /** 文案对齐方式。 */
  align?: EmptyHintAlign
  /** 内边距语义。 */
  inset?: EmptyHintInset
}

defineOptions({ name: 'OcEmptyHint' })

const props = withDefaults(defineProps<OcEmptyHintProps>(), {
  tone: 'dim',
  size: 'body',
  align: 'center',
  inset: 'comfortable',
})

const hintClass = computed(() => [
  `oc-empty-hint--tone-${props.tone}`,
  `oc-empty-hint--size-${props.size}`,
  `oc-empty-hint--align-${props.align}`,
  `oc-empty-hint--inset-${props.inset}`,
])
</script>

<style scoped>
.oc-empty-hint {
  margin: 0;
  width: 100%;
}

.oc-empty-hint.oc-empty-hint--tone-dim {
  color: var(--oc-text-dim);
}

.oc-empty-hint.oc-empty-hint--tone-muted {
  color: var(--oc-text-muted);
}

.oc-empty-hint--size-label {
  font-size: var(--oc-label-size);
}

.oc-empty-hint--size-body {
  font-size: var(--oc-body-size);
}

.oc-empty-hint--align-start {
  text-align: left;
}

.oc-empty-hint--align-center {
  text-align: center;
}

.oc-empty-hint--inset-none {
  padding: 0;
}

.oc-empty-hint--inset-compact {
  padding: 8px 10px;
}

.oc-empty-hint--inset-comfortable {
  padding: 24px;
}
</style>
