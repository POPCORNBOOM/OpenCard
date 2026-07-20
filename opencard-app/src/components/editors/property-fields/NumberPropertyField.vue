<template>
  <OcFieldFrame class="number-field" full-width :disabled="definition.isReadonly">
    <OcFieldInput
      as="input"
      class="number-field__input"
      variant="plain"
      type="text"
      inputmode="decimal"
      :value="textValue"
      :readonly="definition.isReadonly"
      full-width
      @input="onInput"
    />
    <template #suffix>
      <span class="number-field__steppers">
        <OcButton class="number-field__stepper" icon-only variant="ghost" icon="nav.arrow-up"
          :disabled="definition.isReadonly || isAtMaximum" title="Increase" aria-label="Increase"
          @click="stepValue(1)" />
        <OcButton class="number-field__stepper" icon-only variant="ghost" icon="nav.arrow-down"
          :disabled="definition.isReadonly || isAtMinimum" title="Decrease" aria-label="Decrease"
          @click="stepValue(-1)" />
      </span>
    </template>
  </OcFieldFrame>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcButton from '../../base/OcButton.vue'
import OcFieldFrame from '../../base/OcFieldFrame.vue'
import OcFieldInput from '../../base/OcFieldInput.vue'
import type { EditorPropertyDefinition } from '../../../entities/card/schema'

const props = defineProps<{
  definition: Extract<EditorPropertyDefinition, { fieldType: 'number' }>
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const textValue = computed(() => typeof props.value === 'string' ? props.value : '')
const numberValue = computed(() => {
  const parsed = textValue.value.trim() === '' ? Number.NaN : Number(textValue.value)
  return Number.isFinite(parsed) ? parsed : undefined
})
const isAtMinimum = computed(() => props.definition.min != null && numberValue.value != null
  && numberValue.value <= props.definition.min)
const isAtMaximum = computed(() => props.definition.max != null && numberValue.value != null
  && numberValue.value >= props.definition.max)

function onInput(event: Event) {
  emit('update:value', (event.target as HTMLInputElement).value)
}

function stepValue(delta: number) {
  const current = numberValue.value ?? 0
  const minimum = props.definition.min ?? -Infinity
  const maximum = props.definition.max ?? Infinity
  emit('update:value', String(Math.min(maximum, Math.max(minimum, current + delta))))
}
</script>

<style scoped>
.number-field :deep(.number-field__input.oc-field-input) {
  height: 100%;
  min-height: 0;
  padding: var(--oc-space-1) var(--oc-space-2);
}

.number-field :deep(.number-field__input:focus),
.number-field :deep(.number-field__input:focus-visible) {
  border-color: transparent;
}

.number-field__steppers {
  display: grid;
  flex: 0 0 20px;
  height: 100%;
  grid-template-rows: repeat(2, minmax(0, 1fr));
  border-left: 1px solid var(--oc-border-muted);
}

.number-field__stepper.oc-button {
  width: 20px;
  height: 100%;
  min-height: 0;
  padding: 0;
  border-radius: 0;
  color: var(--oc-fg-muted);
}

.number-field__stepper:first-child {
  border-bottom: 1px solid var(--oc-border-muted);
}

.number-field__stepper:hover:not(:disabled),
.number-field__stepper:focus-visible {
  color: var(--oc-fg-default);
}
</style>
