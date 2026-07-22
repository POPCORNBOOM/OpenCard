<template>
  <Teleport to="body">
    <div v-if="open" class="additional-field-dialog__backdrop" @mousedown.self="emit('close')">
      <form
        class="additional-field-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="t('propertyEditor.customFields.create')"
        @submit.prevent="emit('submit')"
        @keydown.esc.prevent="emit('close')"
      >
        <header class="additional-field-dialog__header">
          <h2>{{ t('propertyEditor.customFields.create') }}</h2>
        </header>

        <label class="additional-field-dialog__field">
          <span>{{ t('propertyEditor.customFields.type') }}</span>
          <OcFieldInput
            as="select"
            full-width
            :value="fieldType"
            @change="emitInputValue('update-field-type', $event)"
          >
            <option v-for="option in fieldTypes" :key="option" :value="option">
              {{ t(`propertyEditor.fieldTypes.${option}`) }}
            </option>
          </OcFieldInput>
        </label>

        <label class="additional-field-dialog__field">
          <span>{{ t('propertyEditor.customFields.key') }}</span>
          <OcFieldInput
            full-width
            mono
            autofocus
            :value="fieldKey"
            @input="emitInputValue('update-field-key', $event)"
          />
        </label>

        <label class="additional-field-dialog__field">
          <span>{{ t('propertyEditor.customFields.title') }}</span>
          <OcFieldInput
            full-width
            :value="title"
            @input="emitInputValue('update-title', $event)"
          />
        </label>

        <p v-if="errorText" class="additional-field-dialog__error" role="alert">{{ errorText }}</p>

        <footer class="additional-field-dialog__actions">
          <OcButton type="button" @click="emit('close')">
            {{ t('propertyEditor.customFields.cancel') }}
          </OcButton>
          <OcButton type="submit" variant="solid" :disabled="invalid">
            {{ t('propertyEditor.customFields.confirmCreate') }}
          </OcButton>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import OcButton from '../../../components/base/OcButton.vue'
import OcFieldInput from '../../../components/base/OcFieldInput.vue'

defineProps<{
  open: boolean
  fieldTypes: readonly string[]
  fieldType: string
  fieldKey: string
  title: string
  errorText?: string
  invalid?: boolean
}>()

const emit = defineEmits<{
  (e: 'update-field-type', value: string): void
  (e: 'update-field-key', value: string): void
  (e: 'update-title', value: string): void
  (e: 'close'): void
  (e: 'submit'): void
}>()
const { t } = useI18n()

function emitInputValue(
  eventName: 'update-field-type' | 'update-field-key' | 'update-title',
  event: Event,
): void {
  const value = (event.target as HTMLInputElement | HTMLSelectElement).value
  if (eventName === 'update-field-type') emit('update-field-type', value)
  else if (eventName === 'update-field-key') emit('update-field-key', value)
  else emit('update-title', value)
}
</script>

<style scoped>
.additional-field-dialog__backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: var(--oc-space-6);
  background: color-mix(in srgb, var(--oc-bg-base) 62%, transparent);
}

.additional-field-dialog {
  width: min(360px, 100%);
  display: grid;
  gap: var(--oc-space-4);
  padding: var(--oc-space-5);
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-surface);
  box-shadow: var(--oc-shadow-lg);
  color: var(--oc-fg-default);
}

.additional-field-dialog__header h2 {
  margin: 0;
  font-size: var(--oc-text-lg);
  font-weight: 600;
}

.additional-field-dialog__field {
  display: grid;
  gap: var(--oc-space-2);
  min-width: 0;
  font-size: var(--oc-text-sm);
  color: var(--oc-fg-muted);
}

.additional-field-dialog__error {
  margin: 0;
  font-size: var(--oc-text-sm);
  color: var(--oc-fg-danger);
}

.additional-field-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--oc-space-2);
}
</style>
