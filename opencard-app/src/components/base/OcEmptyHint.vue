<template>
  <OcText
    as="p"
    class="oc-empty-hint"
    :class="hintClass"
    :size="props.size"
  >
    <slot />
  </OcText>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { OcText } from '../../shared/ui/primitives'

type EmptyHintTone = 'dim' | 'muted'
type EmptyHintSize = 'label' | 'body'
type EmptyHintAlign = 'start' | 'center'
type EmptyHintInset = 'none' | 'compact' | 'comfortable'

defineOptions({ name: 'OcEmptyHint' })

const props = withDefaults(defineProps<{
  tone?: EmptyHintTone
  size?: EmptyHintSize
  align?: EmptyHintAlign
  inset?: EmptyHintInset
}>(), {
  tone: 'dim',
  size: 'body',
  align: 'center',
  inset: 'comfortable',
})

const hintClass = computed(() => [
  `oc-empty-hint--tone-${props.tone}`,
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
