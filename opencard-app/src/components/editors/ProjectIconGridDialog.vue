<template>
  <OcDialog :open="open" :title="t('projectConfig.icons.generateIcons')" as="form" size="sm"
    close-on-backdrop @request-close="emit('close')" @submit="submit">
    <svg v-if="hasPreview" class="project-icon-grid-dialog__preview"
      :viewBox="`0 0 ${imageWidth} ${imageHeight}`" preserveAspectRatio="xMidYMid meet"
      role="img" :aria-label="t('projectConfig.icons.gridPreview')">
      <image :href="imageSrc" x="0" y="0" :width="imageWidth" :height="imageHeight"
        preserveAspectRatio="none" />
      <line v-for="coordinate in previewColumns" :key="`column-${coordinate}`"
        class="project-icon-grid-dialog__grid-line" :x1="coordinate" y1="0"
        :x2="coordinate" :y2="imageHeight" vector-effect="non-scaling-stroke" />
      <line v-for="coordinate in previewRows" :key="`row-${coordinate}`"
        class="project-icon-grid-dialog__grid-line" x1="0" :y1="coordinate"
        :x2="imageWidth" :y2="coordinate" vector-effect="non-scaling-stroke" />
    </svg>

    <div class="project-icon-grid-dialog__dimensions">
      <label class="project-icon-grid-dialog__field" @focusout="commitDimension('rows', rows)">
        <OcText as="span" size="sm">{{ t('projectConfig.icons.rows') }}</OcText>
        <NumberPropertyField :definition="rowDefinition" :value="rows"
          @update:value="updateDimension('rows', $event)" />
      </label>
      <label class="project-icon-grid-dialog__field" @focusout="commitDimension('columns', columns)">
        <OcText as="span" size="sm">{{ t('projectConfig.icons.columns') }}</OcText>
        <NumberPropertyField :definition="columnDefinition" :value="columns"
          @update:value="updateDimension('columns', $event)" />
      </label>
    </div>

    <div class="project-icon-grid-dialog__constraint">
      <OcSwitch :checked="factorConstraint"
        :label="t('projectConfig.icons.factorConstraint')"
        @update:checked="updateFactorConstraint" />
      <OcText tone="muted" size="xs">{{ t('projectConfig.icons.factorConstraintHelp') }}</OcText>
    </div>
    <OcSwitch :checked="overwrite" :disabled="!hasIcons"
      :label="t('projectConfig.icons.overwriteExisting')" @update:checked="overwrite = $event" />
    <OcSwitch :checked="pixelated"
      :label="t('projectConfig.icons.pixelated')" @update:checked="pixelated = $event" />

    <template #footer>
      <OcButton type="button" @click="emit('close')">{{ t('projectConfig.icons.cancel') }}</OcButton>
      <OcButton type="submit" variant="solid">
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
import NumberPropertyField from '../../shared/ui/property-editor/fields/NumberPropertyField.vue'
import OcButton from '../base/OcButton.vue'
import OcSwitch from '../base/OcSwitch.vue'
import OcText from '../base/OcText.vue'
import OcDialog from '../standard/OcDialog.vue'

const props = withDefaults(defineProps<{
  open: boolean
  hasIcons?: boolean
  initialRows?: number
  initialColumns?: number
  initialPixelated?: boolean
  imageSrc?: string
  imageWidth?: number
  imageHeight?: number
}>(), {
  hasIcons: false,
  initialRows: DEFAULT_PROJECT_ICON_GRID_SETTINGS.rows,
  initialColumns: DEFAULT_PROJECT_ICON_GRID_SETTINGS.columns,
  initialPixelated: DEFAULT_PROJECT_ICON_GRID_SETTINGS.pixelated,
  imageSrc: '',
  imageWidth: 0,
  imageHeight: 0,
})
const emit = defineEmits<{
  close: []
  submit: [request: ProjectIconGridRequest]
}>()
const { t } = useI18n()
const rows = ref('1')
const columns = ref('1')
const overwrite = ref(false)
const pixelated = ref(false)
const factorConstraint = ref(false)

const hasPreview = computed(() => Boolean(props.imageSrc && props.imageWidth > 0 && props.imageHeight > 0))
const rowFactors = computed(() => factorConstraint.value ? factorsOf(props.imageHeight) : undefined)
const columnFactors = computed(() => factorConstraint.value ? factorsOf(props.imageWidth) : undefined)
const rowDefinition = computed(() => ({
  title: t('projectConfig.icons.rows'),
  fieldType: 'number' as const,
  min: 1,
  ...(props.imageHeight > 0 ? { max: props.imageHeight } : {}),
  ...(rowFactors.value ? { allowedValues: rowFactors.value } : {}),
}))
const columnDefinition = computed(() => ({
  title: t('projectConfig.icons.columns'),
  fieldType: 'number' as const,
  min: 1,
  ...(props.imageWidth > 0 ? { max: props.imageWidth } : {}),
  ...(columnFactors.value ? { allowedValues: columnFactors.value } : {}),
}))
function factorsOf(size: number): number[] | undefined {
  if (!Number.isInteger(size) || size <= 0) return undefined
  const lower: number[] = []
  const upper: number[] = []
  for (let candidate = 1; candidate * candidate <= size; candidate += 1) {
    if (size % candidate !== 0) continue
    lower.push(candidate)
    if (candidate * candidate !== size) upper.unshift(size / candidate)
  }
  return [...lower, ...upper]
}

function gridCoordinates(size: number, count: number): number[] {
  if (size <= 0 || !Number.isInteger(count) || count <= 1) return []
  return Array.from({ length: count - 1 }, (_, index) => Math.floor((index + 1) * size / count))
}
const previewRows = computed(() => gridCoordinates(props.imageHeight, Number(rows.value)))
const previewColumns = computed(() => gridCoordinates(props.imageWidth, Number(columns.value)))

watch(() => props.open, open => {
  if (!open) return
  rows.value = String(props.initialRows)
  columns.value = String(props.initialColumns)
  overwrite.value = false
  pixelated.value = props.initialPixelated
  factorConstraint.value = false
  commitDimension('rows', rows.value)
  commitDimension('columns', columns.value)
}, { immediate: true })

function updateDimension(field: 'rows' | 'columns', value: string): void {
  if (field === 'rows') rows.value = value
  else columns.value = value
}

function nearestAllowed(value: string, allowed: readonly number[] | undefined, maximum: number): number {
  const parsed = Number(value)
  if (allowed?.length) {
    if (!Number.isFinite(parsed)) return allowed[0] ?? 1
    return allowed.reduce((nearest, candidate) => (
      Math.abs(candidate - parsed) < Math.abs(nearest - parsed) ? candidate : nearest
    ), allowed[0] ?? 1)
  }
  if (!Number.isFinite(parsed)) return 1
  return Math.min(Math.max(1, maximum), Math.max(1, Math.round(parsed)))
}

function commitDimension(field: 'rows' | 'columns', value: string): void {
  const normalized = field === 'rows'
    ? nearestAllowed(value, rowFactors.value, props.imageHeight)
    : nearestAllowed(value, columnFactors.value, props.imageWidth)
  if (field === 'rows') rows.value = String(normalized)
  else columns.value = String(normalized)
}

function updateFactorConstraint(enabled: boolean): void {
  factorConstraint.value = enabled
  commitDimension('rows', rows.value)
  commitDimension('columns', columns.value)
}

function submit(): void {
  commitDimension('rows', rows.value)
  commitDimension('columns', columns.value)
  emit('submit', {
    rows: Number(rows.value),
    columns: Number(columns.value),
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

.project-icon-grid-dialog__preview {
  display: block;
  width: 100%;
  height: var(--oc-project-icon-atlas-height);
  border: var(--oc-border-width) solid var(--oc-border-muted);
  border-radius: var(--oc-radius-md);
  background-color: var(--oc-bg-raised);
  background-image: var(--oc-viewport-dot-pattern);
  background-size: var(--oc-viewport-dot-size);
  background-position: var(--oc-viewport-dot-position);
}

.project-icon-grid-dialog__grid-line {
  stroke: var(--oc-border-accent);
  stroke-width: var(--oc-border-width);
}

.project-icon-grid-dialog__constraint {
  display: grid;
  gap: var(--oc-space-1);
}

.project-icon-grid-dialog__field {
  display: grid;
  min-width: 0;
  gap: var(--oc-space-2);
}
</style>
