<template>
  <p class="oc-empty-hint" :class="hintClass" :style="hintStyle">
    <slot />
  </p>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'

type EmptyHintTone = 'dim' | 'muted'
type EmptyHintSize = 'label' | 'body'
type EmptyHintAlign = 'start' | 'center'

defineOptions({ name: 'OcEmptyHint' })

const props = withDefaults(defineProps<{
  tone?: EmptyHintTone
  size?: EmptyHintSize
  align?: EmptyHintAlign
  padding?: string
}>(), {
  tone: 'dim',
  size: 'body',
  align: 'center',
  padding: '24px',
})

const hintClass = computed(() => [
  `oc-empty-hint--tone-${props.tone}`,
  `oc-empty-hint--size-${props.size}`,
  `oc-empty-hint--align-${props.align}`,
])

const hintStyle = computed<CSSProperties>(() => ({
  padding: props.padding,
}))
</script>

<style scoped>
.oc-empty-hint {
  margin: 0;
  width: 100%;
}

.oc-empty-hint--tone-dim {
  color: var(--oc-text-dim);
}

.oc-empty-hint--tone-muted {
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
</style>
