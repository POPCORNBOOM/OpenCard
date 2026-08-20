<template>
  <OcDialog
    :open="open"
    :title="t('sidebar.commitDialog.title')"
    :description="t('sidebar.commitDialog.description')"
    as="form"
    size="md"
    :dismissible="!busy"
    :close-on-backdrop="!busy"
    :aria-busy="busy"
    @request-close="requestClose"
    @submit="submit"
  >
    <div class="commit-version-dialog" :inert="busy ? true : undefined">
      <label class="commit-version-dialog__field">
        <OcText as="span" size="sm">{{ t('sidebar.commitDialog.messageLabel') }}</OcText>
        <OcFieldInput
          as="textarea"
          full-width
          autofocus
          resize="vertical"
          :value="message"
          :placeholder="t('sidebar.commitDialog.messagePlaceholder')"
          :aria-invalid="submitted && !message.trim()"
          :disabled="busy"
          @input="message = fieldValue($event)"
        />
      </label>
      <OcText v-if="submitted && !message.trim()" as="p" size="sm" tone="danger" role="alert">
        {{ t('sidebar.commitDialog.messageRequired') }}
      </OcText>
      <OcText v-else-if="error" as="p" size="sm" tone="danger" role="alert">
        {{ error }}
      </OcText>
    </div>

    <template #footer>
      <OcButton type="button" variant="ghost" :disabled="busy" @click="requestClose">
        {{ t('sidebar.commitDialog.cancel') }}
      </OcButton>
      <OcButton type="submit" variant="solid" :disabled="busy || !message.trim()">
        {{ busy ? t('sidebar.commitDialog.committing') : t('sidebar.commitDialog.commit') }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../../../components/base/OcButton.vue'
import OcFieldInput from '../../../components/base/OcFieldInput.vue'
import OcText from '../../../components/base/OcText.vue'
import OcDialog from '../../../components/standard/OcDialog.vue'

const props = withDefaults(defineProps<{
  open: boolean
  busy?: boolean
  error?: string
}>(), {
  busy: false,
  error: '',
})
const emit = defineEmits<{
  close: []
  submit: [message: string]
}>()
const { t } = useI18n()
const message = ref('')
const submitted = ref(false)

watch(() => props.open, open => {
  if (!open) return
  message.value = ''
  submitted.value = false
})

function fieldValue(event: Event): string {
  return (event.target as HTMLTextAreaElement).value
}

function requestClose(): void {
  if (!props.busy) emit('close')
}

function submit(): void {
  submitted.value = true
  const normalizedMessage = message.value.trim()
  if (!props.busy && normalizedMessage) emit('submit', normalizedMessage)
}
</script>

<style scoped>
.commit-version-dialog { display: grid; gap: var(--oc-space-2); }
.commit-version-dialog__field { display: grid; gap: var(--oc-space-2); color: var(--oc-fg-muted); }
.commit-version-dialog__field .oc-field-input { min-height: var(--oc-size-lg); }
.commit-version-dialog p { margin: 0; }
</style>
