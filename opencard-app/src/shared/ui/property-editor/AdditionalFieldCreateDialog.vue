<template>
  <OcDialog :open="open" :title="t('propertyEditor.customFields.create')" as="form" size="sm"
    close-on-backdrop @request-close="emit('close')" @submit="emit('submit')">
        <label v-if="showTitle !== false" class="additional-field-dialog__field">
          <span>{{ t('propertyEditor.customFields.type') }}</span>
          <OcSelect
            full-width
            :model-value="fieldType"
            :options="fieldTypeOptions"
            @update:model-value="emit('update-field-type', $event)"
          />
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

    <template #footer>
      <OcButton type="button" @click="emit('close')">
        {{ t('propertyEditor.customFields.cancel') }}
      </OcButton>
      <OcButton type="submit" variant="solid" :disabled="invalid">
        {{ t('propertyEditor.customFields.confirmCreate') }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../../../components/base/OcButton.vue'
import OcFieldInput from '../../../components/base/OcFieldInput.vue'
import OcDialog from '../../../components/standard/OcDialog.vue'
import OcSelect from '../../../components/standard/OcSelect.vue'

const props = defineProps<{
  open: boolean
  fieldTypes: readonly string[]
  fieldType: string
  fieldKey: string
  title: string
  showTitle?: boolean
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
const fieldTypeOptions = computed(() => props.fieldTypes.map(option => ({
  value: option,
  label: t(`propertyEditor.fieldTypes.${option}`),
})))

function emitInputValue(
  eventName: 'update-field-key' | 'update-title',
  event: Event,
): void {
  const value = (event.target as HTMLInputElement).value
  if (eventName === 'update-field-key') emit('update-field-key', value)
  else emit('update-title', value)
}
</script>

<style scoped>
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

</style>
