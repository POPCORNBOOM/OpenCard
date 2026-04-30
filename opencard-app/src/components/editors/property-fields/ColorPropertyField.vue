<!-- Base 颜色选取器：使用原生 color input 输出十六进制颜色值。 -->
<template>
  <input
    class="color-picker"
    type="color"
    :value="pickerValue"
    @input="handlePickerInput"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface ColorPropertyFieldProps {
  /** 当前字段值。 */
  value: unknown
}

interface ColorPropertyFieldEmits {
  /** 颜色变化时输出 HEX 字符串（如 #112233）。 */
  (e: 'update:value', value: string): void
}

defineOptions({
  name: 'ColorPropertyField',
  inheritAttrs: false,
})

const props = defineProps<ColorPropertyFieldProps>()

const emit = defineEmits<ColorPropertyFieldEmits>()

const pickerValue = computed(() => toHexColor(props.value) ?? '#000000')

function handlePickerInput(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }
  emit('update:value', target.value)
}

function toHexColor(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (/^#[\da-fA-F]{6}$/.test(trimmed)) {
    return trimmed
  }
  if (/^#[\da-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
  }
  return null
}
</script>

<style scoped>
.color-picker {
  width: 32px;
  height: 24px;
  border: none;
  padding: 0;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}
</style>
