<template>
  <div
    class="oc-resize-track"
    :class="[
      `oc-resize-track--${props.orientation}`,
      attrs.class,
    ]"
    :style="attrs.style"
    v-bind="forwardedAttrs"
    @dblclick="handleDoubleClick"
  >
    <OcResizeHandle
      :minimum="props.minimum"
      :maximum="props.maximum"
      :value="props.value"
      :label="props.label"
      :orientation="props.orientation"
      :direction="props.direction"
      :step="props.step"
      :disabled="props.disabled"
      @update:value="emit('update:value', $event)"
      @resize="emit('resize', $event)"
      @resize-start="emit('resize-start', $event)"
      @resize-end="emit('resize-end', $event)"
      @resize-cancel="emit('resize-cancel', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import OcResizeHandle, { type OcResizeHandleChange } from './OcResizeHandle.vue'

defineOptions({ name: 'OcResizeTrack', inheritAttrs: false })

type ResizeOrientation = 'horizontal' | 'vertical'
type ResizeDirection = 'normal' | 'reverse'

const props = withDefaults(defineProps<{
  minimum: number
  maximum: number
  value: number
  label: string
  orientation?: ResizeOrientation
  direction?: ResizeDirection
  step?: number
  disabled?: boolean
}>(), {
  orientation: 'horizontal',
  direction: 'normal',
  step: 16,
  disabled: false,
})

const emit = defineEmits<{
  'update:value': [value: number]
  resize: [change: OcResizeHandleChange]
  'resize-start': [event: PointerEvent]
  'resize-end': [event: PointerEvent]
  'resize-cancel': [event: PointerEvent | KeyboardEvent]
  'double-click': [event: MouseEvent]
}>()

const attrs = useAttrs()
const forwardedAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

function handleDoubleClick(event: MouseEvent): void {
  emit('double-click', event)
}
</script>

<style scoped>
.oc-resize-track {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
}

.oc-resize-track--horizontal {
  width: 100%;
  height: var(--oc-resize-track-size, var(--oc-space-3));
}

.oc-resize-track--vertical {
  width: var(--oc-resize-track-size, var(--oc-space-3));
  height: 100%;
}
</style>
