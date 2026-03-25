<template>
  <div
    class="block-wrapper"
    :class="{ 'block-wrapper-selected': isSelected }"
    :data-block-id="blockId"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { cardEditorContextKey } from './cardEditorContext'

const props = defineProps<{
  blockId: string
}>()

const editorContext = inject(cardEditorContextKey, null)

const isSelected = computed(() => {
  return editorContext?.selectedBlockIds.value.has(props.blockId) ?? false
})
</script>

<style scoped>
.block-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.block-wrapper-selected::after {
  content: '';
  position: absolute;
  inset: -2px;
  border: 2px solid #4da3ff;
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgba(10, 132, 255, 0.25);
  pointer-events: none;
}
</style>
