<template>
  <section ref="rootRef" class="card-data-table" :aria-label="t('cardDesigner.dataTable.title')">
    <div ref="scrollRef" class="card-data-table__scroll">
      <table :style="{ width: `${tableWidth}px` }">
        <colgroup>
          <col :style="{ width: `${getColumnWidth(FIELD_COLUMN_KEY)}px` }">
          <col v-for="column in columns" :key="column.key"
            :style="{ width: `${getColumnWidth(column.key)}px` }">
          <col :style="{ width: `${TAIL_COLUMN_WIDTH}px` }">
        </colgroup>
        <thead>
          <tr>
            <th class="card-data-table__corner" scope="col">
              {{ t('cardDesigner.dataTable.fieldColumn') }}
              <span class="card-data-table__column-resize" role="separator" tabindex="0"
                aria-orientation="vertical" :aria-valuemin="MIN_COLUMN_WIDTH"
                :aria-valuemax="MAX_COLUMN_WIDTH" :aria-valuenow="getColumnWidth(FIELD_COLUMN_KEY)"
                :aria-label="t('cardDesigner.dataTable.resizeColumn', {
                  title: t('cardDesigner.dataTable.fieldColumn'),
                })"
                :data-tooltip="t('cardDesigner.dataTable.resizeColumn', {
                  title: t('cardDesigner.dataTable.fieldColumn'),
                })"
                @pointerdown="beginColumnResize($event, FIELD_COLUMN_KEY)"
                @keydown="handleColumnResizeKeydown($event, FIELD_COLUMN_KEY)" />
            </th>
            <th v-for="column in columns" :key="column.key" class="card-data-table__data-column" scope="col">
              <form v-if="renamingColumnKey === column.key" class="card-data-table__rename"
                @submit.prevent="commitRename(column.key)">
                <OcFieldInput :value="renameDraft" size="sm" full-width autofocus
                  @input="renameDraft = ($event.target as HTMLInputElement).value"
                  @blur="commitRename(column.key)"
                  @keydown.esc.stop.prevent="cancelRename" />
              </form>
              <div v-else class="card-data-table__column-heading" tabindex="0"
                @contextmenu="openColumnContextMenu($event, column)"
                @keydown="openColumnKeyboardMenu($event, column)">
                <OcIcon :name="column.kind === 'blueprint' ? 'entity.card-blueprint' : 'entity.card-instance'"
                  size="md" tone="muted" />
                <span>{{ column.title }}</span>
                <OcButton
                  v-if="column.kind === 'instance'"
                  icon-only
                  size="sm"
                  variant="ghost"
                  :icon="column.exported ? 'status.eye' : 'status.eye-off'"
                  :icon-tone="column.exported ? 'primary' : 'muted'"
                  :data-tooltip="column.exported
                    ? t('cardDesigner.dataTable.excludeInstanceFromExport')
                    : t('cardDesigner.dataTable.includeInstanceInExport')"
                  :aria-label="column.exported
                    ? t('cardDesigner.dataTable.excludeInstanceFromExport')
                    : t('cardDesigner.dataTable.includeInstanceInExport')"
                  @click="emit('set-instance-exported', column.key, !column.exported)" />
                <OcActionButton :action="columnAction(column)" size="sm" variant="ghost"
                  @select="handleColumnAction(column, $event.key)" />
              </div>
              <span class="card-data-table__column-resize" role="separator" tabindex="0"
                aria-orientation="vertical" :aria-valuemin="MIN_COLUMN_WIDTH"
                :aria-valuemax="MAX_COLUMN_WIDTH" :aria-valuenow="getColumnWidth(column.key)"
                :aria-label="t('cardDesigner.dataTable.resizeColumn', { title: column.title })"
                :data-tooltip="t('cardDesigner.dataTable.resizeColumn', { title: column.title })"
                @pointerdown="beginColumnResize($event, column.key)"
                @keydown="handleColumnResizeKeydown($event, column.key)" />
            </th>
            <th class="card-data-table__add-column" scope="col">
              <OcButton icon-only size="sm" variant="ghost" icon="action.add"
                :data-tooltip="t('cardDesigner.dataTable.addInstance')"
                :aria-label="t('cardDesigner.dataTable.addInstance')" @click="emit('add-instance')" />
            </th>
          </tr>
        </thead>
        <template v-for="face in faceGroups" :key="face.key">
          <tbody class="card-data-table__face-group">
            <tr class="card-data-table__face-row">
              <th scope="rowgroup">
                <span class="card-data-table__face-heading"
                  :tabindex="faceCommands(face).length > 0 ? 0 : undefined"
                  @contextmenu="openFaceContextMenu($event, face)"
                  @keydown="openFaceKeyboardMenu($event, face)">
                  <OcIcon name="file.opencard" size="md" tone="muted" />
                  <span>{{ face.title }}</span>
                  <OcActionButton v-if="faceBlockAction(face)" :action="faceBlockAction(face)!"
                    size="sm" variant="ghost" @select="emit('add-block', $event.key)" />
                </span>
              </th>
              <td :colspan="columns.length + 1" />
            </tr>
          </tbody>
          <tbody v-for="block in face.blocks" :key="block.key" class="card-data-table__block-group">
            <tr class="card-data-table__block-row">
              <th scope="rowgroup">
                <span class="card-data-table__block-heading" tabindex="0"
                  :style="{ paddingInlineStart: `${block.depth * 14}px` }"
                  @contextmenu="openBlockContextMenu($event, block)"
                  @keydown="openBlockKeyboardMenu($event, block)">
                  <OcIcon :name="getBlockTreeIcon(block.type)" size="md" tone="muted" />
                  <span>{{ block.title }}</span>
                  <OcActionButton :action="blockFieldAction(block)" size="sm" variant="ghost"
                    @select="handleBlockAction(block.key, $event.key)" />
                  <OcActionButton :action="removeBlockAction()" size="sm" variant="ghost"
                    @select="handleBlockAction(block.key, $event.key)" />
                </span>
              </th>
              <td :colspan="columns.length + 1" />
            </tr>
            <tr v-for="field in block.fields" :key="field.key" class="card-data-table__field-row"
              :class="{ 'is-multiline': isMultilineField(field) }"
              :data-block-id="block.key" :data-field-key="field.key">
              <th scope="row">
                <span class="card-data-table__field-heading" tabindex="0"
                  :style="{ paddingInlineStart: `${block.depth * 14 + 14}px` }"
                  @contextmenu="openFieldContextMenu($event, block, field)"
                  @keydown="openFieldKeyboardMenu($event, block, field)">
                  <OcIcon :name="getPropertyFieldIcon(field.definition.fieldType)" size="sm" tone="muted" />
                  <span>{{ field.title }}</span>
                  <OcActionButton v-if="field.deletable" :action="deleteFieldAction()"
                    size="sm" variant="ghost"
                    @select="handleFieldAction(block.key, field.key, $event.key)" />
                  <OcActionButton :action="excludeFieldAction()" size="sm" variant="ghost"
                    @select="handleFieldAction(block.key, field.key, $event.key)" />
                </span>
              </th>
              <td v-for="cell in field.cells" :key="cell.identity"
                class="card-data-table__cell" :class="{ 'is-inherited': cell.inherited }"
                :data-card-id="cell.cardId" :ref="element => setCellElement(cell.identity, element)">
                <template v-if="shouldMountCell(cell.identity)">
                  <span v-if="cell.readonly" class="card-data-table__cell-preview">
                    {{ formatCellPreview(cell.value) }}
                  </span>
                  <template v-else>
                    <div class="card-data-table__cell-editor">
                      <PropertyFieldRenderer appearance="embedded"
                        :definition="resolveCellDefinition(block.key, field, cell)"
                        :value="cell.value"
                        :editor-id="resolveCellEditorState(block.key, field, cell).editorId"
                        @update:value="handleCellValueUpdate(block.key, field, cell, $event)" />
                      <PropertyFieldActionRail
                        :actions="resolveCellActions(block.key, field, cell)"
                        @action="handleCellAction(block.key, field, cell, $event)" />
                    </div>
                  </template>
                </template>
                <span v-else class="card-data-table__cell-preview">{{ formatCellPreview(cell.value) }}</span>
              </td>
              <td class="card-data-table__tail-cell" />
            </tr>
          </tbody>
        </template>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  type ComponentPublicInstance,
} from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../../components/base/OcButton.vue'
import OcFieldInput from '../../components/base/OcFieldInput.vue'
import OcIcon from '../../components/base/OcIcon.vue'
import OcActionButton, { type OcActionButtonAction } from '../../components/standard/OcActionButton.vue'
import { useFloatingMenu } from '../../composables/useFloatingMenu'
import type { PropertyEditorBindingInterpreter, PropertyEditorFieldDefinition } from '../../shared/ui/property-editor/propertyEditor.types'
import PropertyFieldActionRail from '../../shared/ui/property-editor/PropertyFieldActionRail.vue'
import PropertyFieldRenderer from '../../shared/ui/property-editor/PropertyFieldRenderer.vue'
import {
  createPropertyFieldEditorModeAction,
  usePropertyFieldEditorModes,
} from '../../shared/ui/property-editor/propertyFieldEditorMode'
import { getPropertyFieldIcon } from '../../shared/ui/property-editor/propertyFieldRegistry'
import { getBlockTreeIcon } from './blockPresentation'
import type {
  CdeDataTableCell,
  CdeDataTableColumn,
  CdeDataTableFaceCatalog,
  CdeDataTableFaceGroup,
  CdeDataTableBlockCatalogEntry,
  CdeDataTableFieldRow,
} from './useCdeDataTableModel'
import type { CdeBlockFieldTarget } from './useCdeBlockFieldCommands'

defineOptions({ name: 'CardDataTable' })

const props = defineProps<{
  columns: readonly CdeDataTableColumn[]
  catalogFaceGroups: readonly CdeDataTableFaceCatalog[]
  faceGroups: readonly CdeDataTableFaceGroup[]
  bindingInterpreter?: PropertyEditorBindingInterpreter
  getCellDefinition?: (
    blockId: string,
    field: CdeDataTableFieldRow,
    cell: CdeDataTableCell,
  ) => PropertyEditorFieldDefinition
}>()

const emit = defineEmits<{
  'add-instance': []
  'rename-instance': [cardId: string, name: string]
  'duplicate-card': [cardId: string]
  'delete-instance': [cardId: string]
  'set-instance-exported': [cardId: string, exported: boolean]
  'add-block': [blockId: string]
  'remove-block': [blockId: string]
  'include-field': [blockId: string, fieldKey: string]
  'exclude-field': [blockId: string, fieldKey: string]
  'create-field': [blockId: string]
  'delete-field': [blockId: string, fieldKey: string]
  'update-cell': [payload: CdeBlockFieldTarget & { value: unknown }]
  'reset-cell': [payload: CdeBlockFieldTarget]
}>()

const { t } = useI18n()
const { openContextMenu } = useFloatingMenu()
const fieldEditorModes = usePropertyFieldEditorModes()
const rootRef = ref<HTMLElement | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
const renamingColumnKey = ref<string | null>(null)
const renameDraft = ref('')
const FIELD_COLUMN_KEY = '__field-column__'
const DEFAULT_FIELD_COLUMN_WIDTH = 232
const TAIL_COLUMN_WIDTH = 40
const DEFAULT_COLUMN_WIDTH = 260
const MIN_COLUMN_WIDTH = 180
const MAX_COLUMN_WIDTH = 520
const COLUMN_RESIZE_STEP = 16
const columnWidths = reactive<Record<string, number>>({})
const INCLUDE_FIELD_PREFIX = 'include-field:'
const supportsIntersectionObserver = typeof IntersectionObserver !== 'undefined'
const mountedCellIdentities = reactive(new Set<string>())
const cellElements = new Map<string, HTMLElement>()
const cellIdentityByElement = new WeakMap<Element, string>()
let cellObserver: IntersectionObserver | null = null
let revealHighlightTimer: ReturnType<typeof setTimeout> | null = null
let columnResizeState: { key: string; startX: number; startWidth: number } | null = null
let previousDocumentCursor = ''
let previousDocumentUserSelect = ''

const tableWidth = computed(() => (
  getColumnWidth(FIELD_COLUMN_KEY)
  + TAIL_COLUMN_WIDTH
  + props.columns.reduce((width, column) => width + getColumnWidth(column.key), 0)
))

function clampColumnWidth(width: number): number {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)))
}

function getColumnWidth(key: string): number {
  return columnWidths[key] ?? (key === FIELD_COLUMN_KEY ? DEFAULT_FIELD_COLUMN_WIDTH : DEFAULT_COLUMN_WIDTH)
}

function setColumnWidth(key: string, width: number): void {
  columnWidths[key] = clampColumnWidth(width)
}

function beginColumnResize(event: PointerEvent, key: string): void {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  finishColumnResize()
  columnResizeState = { key, startX: event.clientX, startWidth: getColumnWidth(key) }
  previousDocumentCursor = document.documentElement.style.cursor
  previousDocumentUserSelect = document.documentElement.style.userSelect
  document.documentElement.style.cursor = 'col-resize'
  document.documentElement.style.userSelect = 'none'
  rootRef.value?.classList.add('is-resizing-column')
  window.addEventListener('pointermove', handleColumnResizeMove)
  window.addEventListener('pointerup', finishColumnResize)
  window.addEventListener('pointercancel', finishColumnResize)
  window.addEventListener('blur', finishColumnResize)
}

function handleColumnResizeMove(event: PointerEvent): void {
  if (!columnResizeState) return
  setColumnWidth(
    columnResizeState.key,
    columnResizeState.startWidth + event.clientX - columnResizeState.startX,
  )
}

function finishColumnResize(): void {
  if (!columnResizeState) return
  columnResizeState = null
  document.documentElement.style.cursor = previousDocumentCursor
  document.documentElement.style.userSelect = previousDocumentUserSelect
  rootRef.value?.classList.remove('is-resizing-column')
  window.removeEventListener('pointermove', handleColumnResizeMove)
  window.removeEventListener('pointerup', finishColumnResize)
  window.removeEventListener('pointercancel', finishColumnResize)
  window.removeEventListener('blur', finishColumnResize)
}

function handleColumnResizeKeydown(event: KeyboardEvent, key: string): void {
  let nextWidth: number | null = null
  if (event.key === 'ArrowLeft') nextWidth = getColumnWidth(key) - COLUMN_RESIZE_STEP
  else if (event.key === 'ArrowRight') nextWidth = getColumnWidth(key) + COLUMN_RESIZE_STEP
  else if (event.key === 'Home') nextWidth = MIN_COLUMN_WIDTH
  else if (event.key === 'End') nextWidth = MAX_COLUMN_WIDTH
  if (nextWidth === null) return
  event.preventDefault()
  setColumnWidth(key, nextWidth)
}

function setCellElement(
  identity: string,
  element: Element | ComponentPublicInstance | null,
): void {
  const previous = cellElements.get(identity)
  const next = element instanceof HTMLElement ? element : null
  if (previous === next) return
  if (previous) cellObserver?.unobserve(previous)
  if (!next) {
    cellElements.delete(identity)
    return
  }
  cellElements.set(identity, next)
  cellIdentityByElement.set(next, identity)
  cellObserver?.observe(next)
}

function shouldMountCell(identity: string): boolean {
  return !supportsIntersectionObserver || mountedCellIdentities.has(identity)
}

function formatCellPreview(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function isMultilineField(field: CdeDataTableFieldRow): boolean {
  return field.definition.fieldType === 'string' && Boolean(field.definition.multiline)
}

function resolveCellDefinition(
  blockId: string,
  field: CdeDataTableFieldRow,
  cell: CdeDataTableCell,
): PropertyEditorFieldDefinition {
  return props.getCellDefinition?.(blockId, field, cell) ?? field.definition
}

function resolveCellEditorState(
  blockId: string,
  field: CdeDataTableFieldRow,
  cell: CdeDataTableCell,
) {
  return fieldEditorModes.resolve({
    identity: cell.identity,
    definition: resolveCellDefinition(blockId, field, cell),
    value: cell.value,
    bindingInterpreter: props.bindingInterpreter,
  })
}

function resolveCellActions(
  blockId: string,
  field: CdeDataTableFieldRow,
  cell: CdeDataTableCell,
): OcActionButtonAction[] {
  const definition = resolveCellDefinition(blockId, field, cell)
  const modeAction = createPropertyFieldEditorModeAction(
    resolveCellEditorState(blockId, field, cell),
    definition,
    {
      useFieldEditor: t('propertyEditor.bindings.useFieldEditor'),
      useRawStringEditor: t('propertyEditor.bindings.useRawEditor'),
    },
  )
  return [
    ...(modeAction ? [modeAction] : []),
    ...(cell.overridden ? [resetCellAction()] : []),
  ]
}

function handleCellAction(
  blockId: string,
  field: CdeDataTableFieldRow,
  cell: CdeDataTableCell,
  actionKey: string,
): void {
  if (fieldEditorModes.select(cell.identity, actionKey)) return
  if (actionKey === 'reset-cell') {
    emit('reset-cell', { cardId: cell.cardId, blockId, fieldKey: field.key })
  }
}

function handleCellValueUpdate(
  blockId: string,
  field: CdeDataTableFieldRow,
  cell: CdeDataTableCell,
  value: unknown,
): void {
  if (resolveCellEditorState(blockId, field, cell).editorId === 'raw-string') {
    fieldEditorModes.preserveRawString(cell.identity)
  }
  emit('update-cell', { cardId: cell.cardId, blockId, fieldKey: field.key, value })
}

onMounted(() => {
  if (!supportsIntersectionObserver) return
  cellObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      const identity = cellIdentityByElement.get(entry.target)
      if (identity) mountedCellIdentities.add(identity)
    }
  }, {
    root: scrollRef.value,
    rootMargin: '240px 520px',
  })
  for (const element of cellElements.values()) cellObserver.observe(element)
})

function columnCommands(column: CdeDataTableColumn): OcActionButtonAction[] {
  if (column.kind === 'blueprint') return [{
      key: 'duplicate',
      icon: 'action.add',
      title: t('cardDesigner.dataTable.duplicateBlueprint'),
    }]
  return [
    { key: 'rename', icon: 'action.edit', title: t('cardDesigner.dataTable.renameInstance') },
    { key: 'duplicate', icon: 'action.copy', title: t('cardDesigner.dataTable.duplicateInstance') },
    { key: 'delete', icon: 'action.delete', title: t('cardDesigner.dataTable.deleteInstance') },
  ]
}

function columnAction(column: CdeDataTableColumn): OcActionButtonAction {
  const commands = columnCommands(column)
  if (column.kind === 'blueprint') return commands[0]!
  return {
    key: 'more',
    icon: 'nav.more',
    title: t('cardDesigner.dataTable.instanceActions'),
    children: commands,
  }
}

function handleColumnAction(column: CdeDataTableColumn, actionKey: string): void {
  if (actionKey === 'rename' && column.kind === 'instance') {
    renamingColumnKey.value = column.key
    renameDraft.value = column.title
  } else if (actionKey === 'duplicate') emit('duplicate-card', column.key)
  else if (actionKey === 'delete' && column.kind === 'instance') emit('delete-instance', column.key)
}

function faceCommands(face: CdeDataTableFaceGroup): OcActionButtonAction[] {
  const catalog = props.catalogFaceGroups.find(candidate => candidate.key === face.key)
  if (!catalog) return []
  const selectedBlockIds = new Set(face.blocks.map(block => block.key))
  const availableBlocks = catalog.blocks.filter(block => !selectedBlockIds.has(block.key))
  return availableBlocks.map(block => ({
    key: block.key,
    icon: getBlockTreeIcon(block.type),
    title: block.title,
  }))
}

function faceBlockAction(face: CdeDataTableFaceGroup): OcActionButtonAction | null {
  const commands = faceCommands(face)
  if (commands.length === 0) return null
  return {
    key: 'add-block',
    icon: 'action.add',
    title: t('cardDesigner.dataTable.addBlock'),
    children: commands,
  }
}

function blockFieldCommands(block: CdeDataTableBlockCatalogEntry): OcActionButtonAction[] {
  const selectedFieldKeys = new Set(block.fields.map(field => field.key))
  const catalogBlock = props.catalogFaceGroups
    .flatMap(face => face.blocks)
    .find(candidate => candidate.key === block.key)
  const availableFields = catalogBlock?.fields.filter(field => !selectedFieldKeys.has(field.key)) ?? []
  return [
      ...availableFields.map(field => ({
        key: `${INCLUDE_FIELD_PREFIX}${field.key}`,
        icon: getPropertyFieldIcon(field.definition.fieldType),
        title: field.title,
      })),
      {
        key: 'create-field',
        icon: 'action.add',
        title: t('cardDesigner.dataTable.createField'),
      },
    ]
}

function blockFieldAction(block: CdeDataTableBlockCatalogEntry): OcActionButtonAction {
  return {
    key: 'manage-fields',
    icon: 'action.add',
    title: t('cardDesigner.dataTable.editBlockFields'),
    children: blockFieldCommands(block),
  }
}

function removeBlockAction(): OcActionButtonAction {
  return {
    key: 'remove-block',
    icon: 'action.close',
    title: t('cardDesigner.dataTable.stopEditingBlock'),
  }
}

function deleteFieldAction(): OcActionButtonAction {
  return {
    key: 'delete-field',
    icon: 'action.delete',
    iconTone: 'danger',
    title: t('cardDesigner.dataTable.deleteField'),
  }
}

function excludeFieldAction(): OcActionButtonAction {
  return {
    key: 'exclude-field',
    icon: 'action.close',
    title: t('cardDesigner.dataTable.stopEditingField'),
  }
}

function resetCellAction(): OcActionButtonAction {
  return {
    key: 'reset-cell',
    icon: 'action.discard',
    title: t('cardDesigner.dataTable.resetOverride'),
  }
}

function blockContextCommands(block: CdeDataTableBlockCatalogEntry): OcActionButtonAction[] {
  return [blockFieldAction(block), removeBlockAction()]
}

function handleBlockAction(blockId: string, actionKey: string): void {
  if (actionKey.startsWith(INCLUDE_FIELD_PREFIX)) {
    emit('include-field', blockId, actionKey.slice(INCLUDE_FIELD_PREFIX.length))
  } else if (actionKey === 'create-field') emit('create-field', blockId)
  else if (actionKey === 'remove-block') emit('remove-block', blockId)
}

function fieldCommands(field: CdeDataTableFieldRow): OcActionButtonAction[] {
  return [
    ...(field.deletable ? [deleteFieldAction()] : []),
    excludeFieldAction(),
  ]
}

function openKeyboardContextMenu(
  event: KeyboardEvent,
  items: readonly OcActionButtonAction[],
  onSelect: (key: string) => void,
): void {
  if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return
  if (items.length === 0 || !(event.currentTarget instanceof HTMLElement)) return
  event.preventDefault()
  openContextMenu({ anchor: event.currentTarget, items, onSelect })
}

function openColumnContextMenu(event: MouseEvent, column: CdeDataTableColumn): void {
  openContextMenu({ event, items: columnCommands(column), onSelect: key => handleColumnAction(column, key) })
}

function openColumnKeyboardMenu(event: KeyboardEvent, column: CdeDataTableColumn): void {
  openKeyboardContextMenu(event, columnCommands(column), key => handleColumnAction(column, key))
}

function openFaceContextMenu(event: MouseEvent, face: CdeDataTableFaceGroup): void {
  openContextMenu({ event, items: faceCommands(face), onSelect: key => emit('add-block', key) })
}

function openFaceKeyboardMenu(event: KeyboardEvent, face: CdeDataTableFaceGroup): void {
  openKeyboardContextMenu(event, faceCommands(face), key => emit('add-block', key))
}

function openBlockContextMenu(event: MouseEvent, block: CdeDataTableBlockCatalogEntry): void {
  openContextMenu({ event, items: blockContextCommands(block), onSelect: key => handleBlockAction(block.key, key) })
}

function openBlockKeyboardMenu(event: KeyboardEvent, block: CdeDataTableBlockCatalogEntry): void {
  openKeyboardContextMenu(event, blockContextCommands(block), key => handleBlockAction(block.key, key))
}

function handleFieldAction(blockId: string, fieldKey: string, actionKey: string): void {
  if (actionKey === 'exclude-field') emit('exclude-field', blockId, fieldKey)
  else if (actionKey === 'delete-field') emit('delete-field', blockId, fieldKey)
}

function openFieldContextMenu(
  event: MouseEvent,
  block: CdeDataTableBlockCatalogEntry,
  field: CdeDataTableFieldRow,
): void {
  openContextMenu({
    event,
    items: fieldCommands(field),
    onSelect: key => handleFieldAction(block.key, field.key, key),
  })
}

function openFieldKeyboardMenu(
  event: KeyboardEvent,
  block: CdeDataTableBlockCatalogEntry,
  field: CdeDataTableFieldRow,
): void {
  openKeyboardContextMenu(
    event,
    fieldCommands(field),
    key => handleFieldAction(block.key, field.key, key),
  )
}

function commitRename(cardId: string): void {
  if (renamingColumnKey.value !== cardId) return
  const name = renameDraft.value.trim()
  if (!name) return
  emit('rename-instance', cardId, name)
  cancelRename()
}

function cancelRename(): void {
  renamingColumnKey.value = null
  renameDraft.value = ''
}

function toCodeUnitOffset(value: string, characterOffset: number): number {
  return Array.from(value).slice(0, characterOffset).join('').length
}

async function revealCell(
  cardId: string,
  blockId: string,
  fieldKey: string,
  characterOffset?: number,
): Promise<boolean> {
  const rows = rootRef.value?.querySelectorAll<HTMLElement>('[data-block-id][data-field-key]') ?? []
  const row = Array.from(rows).find(candidate =>
    candidate.dataset.blockId === blockId && candidate.dataset.fieldKey === fieldKey
  )
  const cells = row?.querySelectorAll<HTMLElement>('[data-card-id]') ?? []
  const cell = Array.from(cells).find(candidate => candidate.dataset.cardId === cardId)
  if (!cell) return false
  mountedCellIdentities.add(`${cardId}\u0000${blockId}\u0000${fieldKey}`)
  await nextTick()
  cell.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  const control = cell.querySelector<HTMLElement>(
    'input:not([type="hidden"]), textarea, button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  control?.focus()
  if (
    characterOffset !== undefined
    && (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)
  ) {
    const selectionOffset = toCodeUnitOffset(control.value, characterOffset)
    try {
      control.setSelectionRange(selectionOffset, selectionOffset)
    } catch {
      // Some non-text input types reject text selection.
    }
  }
  cell.classList.add('is-revealed')
  if (revealHighlightTimer) clearTimeout(revealHighlightTimer)
  revealHighlightTimer = setTimeout(() => {
    cell.classList.remove('is-revealed')
    revealHighlightTimer = null
  }, 1600)
  return true
}

defineExpose({ revealCell })

onBeforeUnmount(() => {
  finishColumnResize()
  cellObserver?.disconnect()
  if (revealHighlightTimer) clearTimeout(revealHighlightTimer)
})
</script>

<style scoped>
.card-data-table,
.card-data-table__scroll {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.card-data-table {
  --card-data-table-row-height: var(--oc-table-row-height);
  --oc-field-control-height: calc(var(--oc-table-row-height) - var(--oc-border-width));
  background: var(--oc-bg-base);
}

.card-data-table__scroll {
  overflow: auto;
}

table {
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}

th,
td {
  box-sizing: border-box;
  height: var(--card-data-table-row-height);
  padding: 0 var(--oc-space-2);
  border-right: var(--oc-border-width) solid var(--oc-border-muted);
  border-bottom: var(--oc-border-width) solid var(--oc-border-muted);
  background: var(--oc-bg-base);
  text-align: left;
  vertical-align: middle;
}

thead th {
  position: sticky;
  top: 0;
  z-index: 4;
  background: var(--oc-bg-raised);
}

.card-data-table__corner,
tbody th {
  position: sticky;
  left: 0;
  z-index: 3;
}

.card-data-table__corner {
  z-index: 5;
}

.card-data-table__add-column,
.card-data-table__tail-cell {
  text-align: center;
}

.card-data-table__data-column {
  overflow: visible;
}

.card-data-table__column-resize {
  position: absolute;
  top: 0;
  right: -4px;
  bottom: 0;
  z-index: 1;
  width: 8px;
  cursor: col-resize;
  touch-action: none;
}

.card-data-table__column-resize::after {
  position: absolute;
  top: 8px;
  right: 3px;
  bottom: 8px;
  width: 1px;
  background: var(--oc-border-accent);
  content: '';
  opacity: 0;
}

.card-data-table__column-resize:hover::after,
.card-data-table__column-resize:focus-visible::after,
.card-data-table.is-resizing-column .card-data-table__column-resize::after {
  opacity: 1;
}

.card-data-table__column-resize:focus-visible {
  outline: none;
}

.card-data-table__column-heading,
.card-data-table__face-heading,
.card-data-table__block-heading,
.card-data-table__field-heading {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  min-width: 0;
}

.card-data-table__column-heading > span,
.card-data-table__face-heading > span,
.card-data-table__block-heading > span,
.card-data-table__field-heading > span {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-data-table__face-row th,
.card-data-table__face-row td {
  background: var(--oc-bg-surface);
  color: var(--oc-fg-default);
  font-weight: 600;
}

.card-data-table__block-row th,
.card-data-table__block-row td {
  background: var(--oc-bg-block);
}

.card-data-table__field-row th,
.card-data-table__field-row td {
  background: var(--oc-bg-base);
}

.card-data-table__field-row.is-multiline:focus-within {
  --oc-field-control-target-height: var(
    --oc-field-control-expanded-height,
    var(--oc-property-row-expanded-height)
  );
}

.card-data-table__field-row.is-multiline:focus-within .card-data-table__cell-preview {
  align-items: flex-start;
}

.card-data-table__field-heading {
  min-height: var(--oc-field-control-height);
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
}

.card-data-table__cell {
  position: relative;
}

.card-data-table__cell.is-inherited {
  background: color-mix(in srgb, var(--oc-bg-base) 92%, var(--oc-fg-muted));
}

.card-data-table__cell.is-revealed {
  background: var(--oc-bg-selected);
  outline: 2px solid var(--oc-fg-accent);
  outline-offset: -2px;
}

.card-data-table__cell-preview {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-data-table__cell-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  gap: var(--oc-space-1);
  width: 100%;
  min-width: 0;
  min-height: var(--oc-field-control-height);
}

</style>
