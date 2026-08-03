<template>
  <OcDialog :open="open" :title="t('projectConfig.icons.generateIcons')" as="form" size="sm"
    close-on-backdrop @request-close="emit('close')" @submit="submit">
    <div class="project-icon-grid-dialog__dimensions">
      <label class="project-icon-grid-dialog__field">
        <OcText as="span" size="sm">{{ t('projectConfig.icons.rows') }}</OcText>
        <OcFieldInput type="number" min="1" step="1" :value="rows"
          :aria-invalid="!validRows" @input="updateDimension('rows', $event)" />
      </label>
      <label class="project-icon-grid-dialog__field">
        <OcText as="span" size="sm">{{ t('projectConfig.icons.columns') }}</OcText>
        <OcFieldInput type="number" min="1" step="1" :value="columns"
          :aria-invalid="!validColumns" @input="updateDimension('columns', $event)" />
      </label>
    </div>

    <OcSwitch :checked="overwrite" :disabled="!hasIcons"
      :label="t('projectConfig.icons.overwriteExisting')" @update:checked="overwrite = $event" />
    <OcSwitch :checked="pixelated"
      :label="t('projectConfig.icons.pixelated')" @update:checked="pixelated = $event" />

    <template #footer>
      <OcButton type="button" @click="emit('close')">{{ t('projectConfig.icons.cancel') }}</OcButton>
      <OcButton type="submit" variant="solid" :disabled="!canSubmit">
        {{ t('projectConfig.icons.generate') }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script lang="ts">
export type ProjectIconGridRequest = {
  rows: number
  columns: number
  overwrite: boolean
  pixelated: boolean
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DEFAULT_PROJECT_ICON_GRID_SETTINGS } from '../../features/workspace/model/projectIcons'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcSwitch from '../base/OcSwitch.vue'
import OcText from '../base/OcText.vue'
import OcDialog from '../standard/OcDialog.vue'

const props = withDefaults(defineProps<{
  open: boolean
  hasIcons?: boolean
  initialRows?: number
  initialColumns?: number
  initialPixelated?: boolean
}>(), {
  hasIcons: false,
  initialRows: DEFAULT_PROJECT_ICON_GRID_SETTINGS.rows,
  initialColumns: DEFAULT_PROJECT_ICON_GRID_SETTINGS.columns,
  initialPixelated: DEFAULT_PROJECT_ICON_GRID_SETTINGS.pixelated,
})
const emit = defineEmits<{
  close: []
  submit: [request: ProjectIconGridRequest]
}>()
const { t } = useI18n()
const rows = ref(1)
const columns = ref(1)
const overwrite = ref(false)
const pixelated = ref(false)

const validRows = computed(() => Number.isInteger(rows.value) && rows.value > 0)
const validColumns = computed(() => Number.isInteger(columns.value) && columns.value > 0)
const canSubmit = computed(() => validRows.value && validColumns.value)

watch(() => props.open, open => {
  if (!open) return
  rows.value = props.initialRows
  columns.value = props.initialColumns
  overwrite.value = false
  pixelated.value = props.initialPixelated
}, { immediate: true })

function updateDimension(field: 'rows' | 'columns', event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) return
  if (field === 'rows') rows.value = Number(event.target.value)
  else columns.value = Number(event.target.value)
}

function submit(): void {
  if (!canSubmit.value) return
  emit('submit', {
    rows: rows.value,
    columns: columns.value,
    overwrite: props.hasIcons && overwrite.value,
    pixelated: pixelated.value,
  })
}
</script>

<style scoped>
.project-icon-grid-dialog__dimensions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--oc-space-3);
}

.project-icon-grid-dialog__field {
  display: grid;
  min-width: 0;
  gap: var(--oc-space-2);
}
</style>
