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
                  @keydown.esc.prevent="cancelRename" />
                <OcButton icon-only size="sm" variant="ghost" icon="action.check"
                  :aria-label="t('cardDesigner.dataTable.renameConfirm')" type="submit" />
                <OcButton icon-only size="sm" variant="ghost" icon="action.close"
                  :aria-label="t('cardDesigner.dataTable.renameCancel')" @click="cancelRename" />
              </form>
              <div v-else class="card-data-table__column-heading" tabindex="0"
                @contextmenu="openColumnContextMenu($event, column)"
                @keydown="openColumnKeyboardMenu($event, column)">
                <OcIcon :name="column.kind === 'blueprint' ? 'entity.card-blueprint' : 'entity.card-instance'"
                  size="md" tone="muted" />
                <span>{{ column.title }}</span>
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
                </span>
              </th>
              <td :colspan="columns.length + 1" />
            </tr>
            <tr v-for="field in block.fields" :key="field.key" class="card-data-table__field-row"
              :data-block-id="block.key" :data-field-key="field.key">
              <th scope="row">
                <span class="card-data-table__field-heading" tabindex="0"
                  :style="{ paddingInlineStart: `${block.depth * 14 + 14}px` }"
                  @contextmenu="openFieldContextMenu($event, block, field)"
                  @keydown="openFieldKeyboardMenu($event, block, field)">
                  <OcIcon :name="getPropertyFieldIcon(field.definition.fieldType)" size="sm" tone="muted" />
                  <span>{{ field.title }}</span>
                  <OcButton icon-only size="sm" variant="ghost" icon="action.close"
                    :data-tooltip="t('cardDesigner.dataTable.excludeField')"
                    :aria-label="t('cardDesigner.dataTable.excludeField')"
                    @click="emit('exclude-field', block.key, field.key)" />
                  <OcButton v-if="field.deletable" icon-only size="sm" variant="ghost" icon="action.delete"
                    icon-tone="danger" :data-tooltip="t('cardDesigner.dataTable.deleteField')"
                    :aria-label="t('cardDesigner.dataTable.deleteField')"
                    @click="emit('delete-field', block.key, field.key)" />
                </span>
              </th>
              <td v-for="cell in field.cells" :key="cell.identity"
                class="card-data-table__cell" :class="{ 'is-inherited': cell.inherited, 'has-reset': cell.overridden }"
                :data-card-id="cell.cardId" :ref="element => setCellElement(cell.identity, element)">
                <template v-if="shouldMountCell(cell.identity)">
                  <PropertyFieldControl :identity="cell.identity" appearance="embedded"
                    :definition="getCellDefinition?.(block.key, field, cell) ?? field.definition"
                    :value="cell.value" :binding-interpreter="bindingInterpreter"
                    @update:value="emit('update-cell', {
                      cardId: cell.cardId,
                      blockId: block.key,
                      fieldKey: field.key,
                      value: $event,
                    })" />
                  <OcButton v-if="cell.overridden" class="card-data-table__reset" icon-only size="sm"
                    variant="ghost" icon="action.discard" :data-tooltip="t('cardDesigner.dataTable.resetOverride')"
                    :aria-label="t('cardDesigner.dataTable.resetOverride')"
                    @click="emit('reset-cell', { cardId: cell.cardId, blockId: block.key, fieldKey: field.key })" />
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
import PropertyFieldControl from '../../shared/ui/property-editor/PropertyFieldControl.vue'
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

function blockCommands(block: CdeDataTableBlockCatalogEntry): OcActionButtonAction[] {
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
      {
        key: 'remove-block',
        icon: 'action.close',
        title: t('cardDesigner.dataTable.removeBlock'),
      },
    ]
}

function blockFieldAction(block: CdeDataTableBlockCatalogEntry): OcActionButtonAction {
  return {
    key: 'manage-fields',
    icon: 'action.add',
    title: t('cardDesigner.dataTable.manageFields'),
    children: blockCommands(block),
  }
}

function handleBlockAction(blockId: string, actionKey: string): void {
  if (actionKey.startsWith(INCLUDE_FIELD_PREFIX)) {
    emit('include-field', blockId, actionKey.slice(INCLUDE_FIELD_PREFIX.length))
  } else if (actionKey === 'create-field') emit('create-field', blockId)
  else if (actionKey === 'remove-block') emit('remove-block', blockId)
}

function fieldCommands(field: CdeDataTableFieldRow): OcActionButtonAction[] {
  return [
    { key: 'exclude-field', icon: 'action.close', title: t('cardDesigner.dataTable.excludeField') },
    ...(field.deletable
      ? [{ key: 'delete-field', icon: 'action.delete' as const, iconTone: 'danger' as const, title: t('cardDesigner.dataTable.deleteField') }]
      : []),
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
  openContextMenu({ event, items: blockCommands(block), onSelect: key => handleBlockAction(block.key, key) })
}

function openBlockKeyboardMenu(event: KeyboardEvent, block: CdeDataTableBlockCatalogEntry): void {
  openKeyboardContextMenu(event, blockCommands(block), key => handleBlockAction(block.key, key))
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
  --card-data-table-row-height: 40px;
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
  padding: var(--oc-space-1) var(--oc-space-2);
  border-right: 1px solid var(--oc-border-muted);
  border-bottom: 1px solid var(--oc-border-muted);
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
  background: var(--oc-bg-raised);
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
.card-data-table__field-heading,
.card-data-table__rename {
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
  background: var(--oc-bg-raised);
  color: var(--oc-fg-default);
  font-weight: 600;
}

.card-data-table__block-row th,
.card-data-table__block-row td {
  background: var(--oc-bg-subtle);
}

.card-data-table__field-heading {
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
  box-shadow: inset 0 0 0 2px var(--oc-fg-accent);
}

.card-data-table__cell:focus-within:not(.is-revealed) {
  box-shadow: inset 0 0 0 1px var(--oc-border-accent);
}

.card-data-table__cell-preview {
  display: block;
  min-width: 0;
  height: var(--oc-size-md);
  overflow: hidden;
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
  line-height: var(--oc-size-md);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-data-table__cell.has-reset {
  padding-right: calc(var(--oc-size-sm) + var(--oc-space-2));
}

.card-data-table__reset {
  position: absolute;
  top: 50%;
  right: var(--oc-space-1);
  transform: translateY(-50%);
}
</style>
