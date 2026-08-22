<template>
  <OcDialog
    :open="open"
    :title="t('sidebar.initializeDialog.title')"
    :description="t('sidebar.initializeDialog.description')"
    as="form"
    size="md"
    :dismissible="!busy"
    :close-on-backdrop="!busy"
    :aria-busy="busy"
    @request-close="requestClose"
    @submit="submit"
  >
    <div class="initialize-repository-dialog" :inert="busy ? true : undefined">
      <label class="initialize-repository-dialog__field">
        <OcText as="span" size="sm">{{ t('sidebar.initializeDialog.nameLabel') }}</OcText>
        <OcFieldInput
          full-width
          autofocus
          required
          :value="name"
          :placeholder="t('sidebar.initializeDialog.namePlaceholder')"
          :aria-invalid="submitted && !name.trim()"
          :disabled="busy"
          @input="name = fieldValue($event)"
        />
      </label>
      <OcText v-if="submitted && !name.trim()" as="p" size="sm" tone="danger" role="alert">
        {{ t('sidebar.initializeDialog.nameRequired') }}
      </OcText>
      <label class="initialize-repository-dialog__field">
        <OcText as="span" size="sm">{{ t('sidebar.initializeDialog.emailLabel') }}</OcText>
        <OcFieldInput
          type="email"
          full-width
          required
          :value="email"
          :placeholder="t('sidebar.initializeDialog.emailPlaceholder')"
          :aria-invalid="submitted && !email.trim()"
          :disabled="busy"
          @input="email = fieldValue($event)"
        />
      </label>
      <OcText v-if="submitted && !email.trim()" as="p" size="sm" tone="danger" role="alert">
        {{ t('sidebar.initializeDialog.emailRequired') }}
      </OcText>
      <OcText v-if="error" as="p" size="sm" tone="danger" role="alert">
        {{ error }}
      </OcText>
    </div>

    <template #footer>
      <OcButton type="button" variant="ghost" :disabled="busy" @click="requestClose">
        {{ t('sidebar.initializeDialog.cancel') }}
      </OcButton>
      <OcButton type="submit" variant="solid" :disabled="busy || !name.trim() || !email.trim()">
        {{ busy ? t('sidebar.initializeDialog.initializing') : t('sidebar.initializeDialog.initialize') }}
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
import type { GitIdentity } from '../git.types'

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
  submit: [identity: GitIdentity]
}>()
const { t } = useI18n()
const name = ref('')
const email = ref('')
const submitted = ref(false)

watch(() => props.open, open => {
  if (!open) return
  name.value = ''
  email.value = ''
  submitted.value = false
})

function fieldValue(event: Event): string {
  return (event.target as HTMLInputElement).value
}

function requestClose(): void {
  if (!props.busy) emit('close')
}

function submit(): void {
  submitted.value = true
  const identity = { name: name.value.trim(), email: email.value.trim() }
  if (!props.busy && identity.name && identity.email) emit('submit', identity)
}
</script>

<style scoped>
.initialize-repository-dialog { display: grid; gap: var(--oc-space-2); }
.initialize-repository-dialog__field { display: grid; gap: var(--oc-space-2); color: var(--oc-fg-muted); }
.initialize-repository-dialog__field .oc-field-input { min-height: var(--oc-size-lg); }
.initialize-repository-dialog p { margin: 0; }
</style>
