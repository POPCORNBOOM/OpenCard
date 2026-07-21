<!-- Base 颜色选取器：使用原生 color input 输出十六进制颜色值。 -->
<template>
  <OcColorField :model-value="stringValue" :disabled="definition.isReadonly"
    @update:model-value="emit('update:value', $event)" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PropertyEditorFieldDefinition } from '../propertyEditor.types'
import OcColorField from '../../../../components/standard/OcColorField.vue'

interface ColorPropertyFieldProps {
  /** 当前字段值。 */
  value: unknown
  definition: Extract<PropertyEditorFieldDefinition, { fieldType: 'color' }>
}

interface ColorPropertyFieldEmits {
  /** 颜色变化时输出当前颜色字符串。 */
  (e: 'update:value', value: string): void
}

defineOptions({
  name: 'ColorPropertyField',
  inheritAttrs: false,
})

const props = defineProps<ColorPropertyFieldProps>()

const emit = defineEmits<ColorPropertyFieldEmits>()

const stringValue = computed(() => (props.value == null ? '' : String(props.value)))
</script>
