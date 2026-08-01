<!-- Standard 颜色字段：复用 OcColorPicker 的完整字段变体。 -->
<template>
  <OcColorPicker
    class="oc-color-field"
    :model-value="modelValue"
    :label="label"
    :disabled="disabled"
    :allow-alpha="allowAlpha"
    variant="field"
    @update:model-value="commitValue"
  />
</template>

<script setup lang="ts">
import OcColorPicker from './OcColorPicker.vue'

interface Props {
  modelValue?: string
  label?: string
  disabled?: boolean
  allowAlpha?: boolean
}

withDefaults(defineProps<Props>(), {
  modelValue: '',
  label: 'Choose color',
  disabled: false,
  allowAlpha: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  commit: [value: string]
}>()

defineOptions({ name: 'OcColorField' })

function commitValue(value: string): void {
  emit('update:modelValue', value)
  emit('commit', value)
}
</script>

<style scoped>
.oc-color-field {
  width: 100%;
}
</style>
