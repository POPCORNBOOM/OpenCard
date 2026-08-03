<template>
  <section ref="rootRef" class="dictionary-editor" :aria-label="t('dictionaryEditor.title')"
    @keydown="handleGridKeydown">
    <div class="dictionary-editor__content">
      <header class="dictionary-editor__header">
        <div class="dictionary-editor__title">
          <OcIcon name="data.collection" size="lg" />
          <div>
            <h1>{{ t('dictionaryEditor.title') }}</h1>
            <OcText tone="muted" size="sm">{{ filePath }}</OcText>
          </div>
        </div>
      </header>

      <div v-if="dictionary && missingActiveLanguage" class="dictionary-editor__notice" role="status">
        <OcIcon name="status.warning" tone="warning" />
        <OcText size="sm">{{ t('dictionaryEditor.missingActive', { language: dictionary.active }) }}</OcText>
      </div>
      <div v-if="clipboardNotice" class="dictionary-editor__notice" role="status">
        <OcIcon name="status.warning" tone="warning" />
        <OcText size="sm">{{ clipboardNotice }}</OcText>
      </div>

      <section v-if="dictionary" class="dictionary-editor__grid oc-data-grid">
        <div ref="scrollRef" class="dictionary-editor__table-scroll oc-data-grid__scroll">
          <table class="dictionary-editor__table oc-data-grid__table" :style="{ width: `${tableWidth}px` }">
            <colgroup>
              <col :style="{ width: `${getColumnWidth(KEY_COLUMN_KEY)}px` }">
              <col v-for="column in grid.columns" :key="column.key"
                :style="{ width: `${getColumnWidth(column.key)}px` }">
              <col :style="{ width: `${tailColumnWidth}px` }">
            </colgroup>
            <thead>
              <tr>
                <th class="dictionary-editor__key-column oc-data-grid__corner oc-data-grid__sticky-column" scope="col">
                  {{ t('dictionaryEditor.columns.key') }}
                  <OcDataGridColumnResizeHandle :minimum="minimumColumnWidth" :maximum="maximumColumnWidth"
                    :value="getColumnWidth(KEY_COLUMN_KEY)" :label="t('dictionaryEditor.actions.resizeColumn', {
                      title: t('dictionaryEditor.columns.key'),
                    })" @resize-start="beginColumnResize($event, KEY_COLUMN_KEY)"
                    @resize-keydown="handleColumnResizeKeydown($event, KEY_COLUMN_KEY)" />
                </th>
                <th v-for="column in grid.columns" :key="column.key"
                  class="dictionary-editor__data-column" :class="{
                    'is-active': column.active,
                    'is-selected': isColumnSelected(column.key),
                  }" scope="col" :aria-selected="isColumnSelected(column.key)"
                  tabindex="0" @click="selectColumn(column.key, $event)"
                  @contextmenu="openColumnContextMenu($event, column)"
                  @keydown="openColumnKeyboardMenu($event, column)">
                  <form v-if="editingLanguage === column.sourceKey" class="dictionary-editor__rename"
                    @submit.prevent="commitLanguageRename(column.sourceKey!)">
                    <OcFieldInput :value="renameDraft" size="sm" mono full-width autofocus
                      @input="renameDraft = ($event.target as HTMLInputElement).value"
                      @blur="commitLanguageRename(column.sourceKey!)"
                      @keydown.esc.stop.prevent="cancelRename" />
                  </form>
                  <div v-else class="dictionary-editor__column-heading">
                    <span>{{ column.kind === 'base' ? t('dictionaryEditor.columns.base') : column.sourceKey }}</span>
                    <span class="dictionary-editor__column-actions">
                      <OcButton icon-only size="sm" variant="ghost" icon="action.check"
                        :class="{ 'is-selected': column.active }"
                        :data-tooltip="column.kind === 'base'
                          ? t('dictionaryEditor.actions.useBase')
                          : t('dictionaryEditor.actions.setActive')"
                        :aria-label="column.kind === 'base'
                          ? t('dictionaryEditor.actions.useBase')
                          : t('dictionaryEditor.actions.setActive')"
                        @click="setActiveLanguage(column.sourceKey)" />
                      <OcActionButton v-if="column.kind === 'language'" :action="languageAction(column.sourceKey!)"
                        size="sm" variant="ghost" @select="handleLanguageAction(column.sourceKey!, $event.key)" />
                    </span>
                  </div>
                  <OcDataGridColumnResizeHandle :minimum="minimumColumnWidth" :maximum="maximumColumnWidth"
                    :value="getColumnWidth(column.key)" :label="t('dictionaryEditor.actions.resizeColumn', {
                      title: column.sourceKey ?? t('dictionaryEditor.columns.base'),
                    })" @resize-start="beginColumnResize($event, column.key)"
                    @resize-keydown="handleColumnResizeKeydown($event, column.key)" />
                </th>
                <th class="dictionary-editor__add-column oc-data-grid__tail" scope="col">
                  <form v-if="addingLanguage" class="dictionary-editor__inline-create" @submit.prevent="addLanguage">
                    <OcFieldInput :value="newLanguageKey" size="sm" mono full-width autofocus
                      :placeholder="t('dictionaryEditor.placeholders.languageKey')"
                      :aria-label="t('dictionaryEditor.placeholders.languageKey')"
                      :aria-invalid="Boolean(newLanguageKey && !canUseLanguageKey(newLanguageKey))"
                      @input="newLanguageKey = ($event.target as HTMLInputElement).value"
                      @keydown.esc.stop.prevent="cancelLanguageCreate" />
                  </form>
                  <OcButton v-else icon-only size="sm" variant="ghost" icon="action.add"
                    :data-tooltip="t('dictionaryEditor.actions.addLanguage')"
                    :aria-label="t('dictionaryEditor.actions.addLanguage')" @click="beginLanguageCreate" />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="grid.rows.length === 0" class="dictionary-editor__empty-row">
                <td :colspan="grid.columns.length + 2" class="dictionary-editor__empty">
                  {{ t('dictionaryEditor.empty') }}
                </td>
              </tr>
              <tr v-for="row in grid.rows" :key="row.key">
                <th class="dictionary-editor__key-column oc-data-grid__sticky-column"
                  :class="{ 'is-selected': isRowSelected(row.key) }" scope="row"
                  :aria-selected="isRowSelected(row.key)" tabindex="0"
                  @click="selectRow(row.key, $event)"
                  @contextmenu="openRecordContextMenu($event, row.key)"
                  @keydown="openRecordKeyboardMenu($event, row.key)">
                  <form v-if="editingRecord === row.key" class="dictionary-editor__rename"
                    @submit.prevent="commitRecordRename(row.key)">
                    <OcFieldInput :value="renameDraft" size="sm" mono full-width autofocus
                      @input="renameDraft = ($event.target as HTMLInputElement).value"
                      @blur="commitRecordRename(row.key)"
                      @keydown.esc.stop.prevent="cancelRename" />
                  </form>
                  <div v-else class="dictionary-editor__record-heading">
                    <code>{{ row.key }}</code>
                    <OcActionButton :action="recordAction(row.key)" size="sm" variant="ghost"
                      @select="handleRecordAction(row.key, $event.key)" />
                  </div>
                </th>
                <td v-for="cell in row.cells" :key="cell.columnKey"
                  class="dictionary-editor__cell oc-data-grid__cell"
                  :class="{
                    'is-active': isActiveColumn(cell.columnKey),
                    'is-inherited': cell.inherited,
                    'is-selected': isCellSelected(cell.recordKey, cell.columnKey),
                  }" tabindex="0" :aria-selected="isCellSelected(cell.recordKey, cell.columnKey)"
                  :data-grid-row="cell.recordKey" :data-grid-column="cell.columnKey"
                  :ref="element => setCellElement(cellIdentity(cell.recordKey, cell.columnKey), element)"
                  @click="selectCell(cell.recordKey, cell.columnKey, $event)"
                  @keydown="handleCellKeydown($event, cell.recordKey, cell.columnKey)">
                  <div v-if="shouldMountCell(cellIdentity(cell.recordKey, cell.columnKey))"
                    class="oc-data-grid__cell-editor">
                    <PropertyFieldRenderer appearance="embedded" :definition="cellDefinition"
                      :value="cell.value" editor-id="field"
                      @update:value="updateCell(cell.columnKey, cell.recordKey, String($event ?? ''))" />
                    <span class="dictionary-editor__cell-action-slot">
                      <PropertyFieldActionRail :actions="cell.overridden && cell.columnKey !== DICTIONARY_BASE_COLUMN_KEY
                        ? [resetOverrideAction()]
                        : []" @action="resetOverride(cell.columnKey, cell.recordKey)" />
                      </span>
                  </div>
                  <span v-else class="oc-data-grid__cell-preview">{{ cell.value }}</span>
                </td>
                <td class="oc-data-grid__tail" />
              </tr>
              <tr class="dictionary-editor__add-row">
                <th class="dictionary-editor__key-column oc-data-grid__sticky-column" scope="row">
                  <form v-if="addingRecord" class="dictionary-editor__inline-create" @submit.prevent="addRecord">
                    <OcFieldInput :value="newRecordKey" size="sm" mono full-width autofocus
                      :placeholder="t('dictionaryEditor.placeholders.recordKey')"
                      :aria-label="t('dictionaryEditor.placeholders.recordKey')"
                      :aria-invalid="Boolean(newRecordKey && !canUseRecordKey(newRecordKey))"
                      @input="newRecordKey = ($event.target as HTMLInputElement).value"
                      @keydown.esc.stop.prevent="cancelRecordCreate" />
                  </form>
                  <OcButton v-else size="sm" variant="ghost" icon="action.add"
                    @click="beginRecordCreate">{{ t('dictionaryEditor.actions.addRecord') }}</OcButton>
                </th>
                <td :colspan="grid.columns.length + 1" />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-else class="dictionary-editor__repair" role="alert">
        <div class="dictionary-editor__diagnostic">
          <OcIcon name="status.error" tone="danger" />
          <div>
            <strong>{{ t('dictionaryEditor.invalid') }}</strong>
            <OcText tone="muted" size="sm">{{ t('dictionaryEditor.repairHint') }}</OcText>
          </div>
        </div>
        <div class="dictionary-editor__source">
          <MonacoEditor :model-value="modelValue ?? ''" language="json" :theme-id="themeId"
            :theme-overrides="themeOverrides"
            @update:model-value="emit('update:modelValue', $event)" @save="save" />
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import { parseProjectDictionaryText, serializeProjectDictionary, type ProjectDictionary } from '../../features/workspace/model/projectDictionary'
import {
  DICTIONARY_BASE_COLUMN_KEY,
  addDictionaryLanguage,
  addDictionaryRecord,
  applyDictionaryCellMatrix,
  canUseDictionaryLanguageKey,
  canUseDictionaryRecordKey,
  clearDictionaryCells,
  deleteDictionaryLanguages,
  deleteDictionaryRecords,
  projectDictionaryGrid,
  renameDictionaryLanguage,
  renameDictionaryRecord,
  resetDictionaryOverride,
  setDictionaryActiveLanguage,
  setDictionaryCellValue,
  type DictionaryGridColumn,
} from '../../features/workspace/model/projectDictionaryGrid'
import { useFloatingMenu } from '../../composables/useFloatingMenu'
import { formatDataGridTsv, parseDataGridTsv } from '../../shared/ui/data-grid/dataGridClipboard'
import OcDataGridColumnResizeHandle from '../../shared/ui/data-grid/OcDataGridColumnResizeHandle.vue'
import { useDataGridCellMounting } from '../../shared/ui/data-grid/useDataGridCellMounting'
import { useDataGridColumnSizing } from '../../shared/ui/data-grid/useDataGridColumnSizing'
import { useDataGridSelection } from '../../shared/ui/data-grid/useDataGridSelection'
import '../../shared/ui/data-grid/dataGrid.css'
import type { PropertyEditorFieldDefinition } from '../../shared/ui/property-editor/propertyEditor.types'
import PropertyFieldActionRail from '../../shared/ui/property-editor/PropertyFieldActionRail.vue'
import PropertyFieldRenderer from '../../shared/ui/property-editor/PropertyFieldRenderer.vue'
import MonacoEditor from './MonacoEditor.vue'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcActionButton, { type OcActionButtonAction } from '../standard/OcActionButton.vue'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const { openContextMenu } = useFloatingMenu()
const dictionary = ref<ProjectDictionary | null>(null)
const rootRef = ref<HTMLElement | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
const newRecordKey = ref('')
const newLanguageKey = ref('')
const addingRecord = ref(false)
const addingLanguage = ref(false)
const editingRecord = ref<string | null>(null)
const editingLanguage = ref<string | null>(null)
const renameDraft = ref('')
const clipboardNotice = ref('')
const KEY_COLUMN_KEY = '$key'
const NEW_LANGUAGE_COLUMN_KEY = '$new-language'

const themeId = computed(() => props.themeId ?? 'dark')
const themeOverrides = computed(() => props.themeOverrides ?? {})
const grid = computed(() => projectDictionaryGrid(dictionary.value ?? {}))
const recordKeys = computed(() => grid.value.rows.map(row => row.key))
const columnKeys = computed(() => grid.value.columns.map(column => column.key))
const missingActiveLanguage = computed(() => Boolean(
  dictionary.value?.active
  && !grid.value.columns.some(column => column.kind === 'language' && column.active),
))
const cellDefinition = computed<PropertyEditorFieldDefinition>(() => ({
  title: t('dictionaryEditor.columns.value'),
  fieldType: 'string',
}))

const columnSizing = useDataGridColumnSizing({
  root: rootRef,
  defaultWidthToken: key => key === KEY_COLUMN_KEY
    ? '--oc-data-grid-key-column-width'
    : '--oc-data-grid-column-width',
})
const { getColumnWidth, beginColumnResize, handleColumnResizeKeydown, finishColumnResize } = columnSizing
const minimumColumnWidth = computed(columnSizing.minimumWidth)
const maximumColumnWidth = computed(columnSizing.maximumWidth)
const tailColumnWidth = computed(() => addingLanguage.value
  ? getColumnWidth(NEW_LANGUAGE_COLUMN_KEY)
  : columnSizing.tailColumnWidth())
const tableWidth = computed(() => getColumnWidth(KEY_COLUMN_KEY) + tailColumnWidth.value
  + columnKeys.value.reduce((width, key) => width + getColumnWidth(key), 0))

const gridSelection = useDataGridSelection({ rowKeys: recordKeys, columnKeys })
const { selection, normalizedRange } = gridSelection
const { setCellElement, shouldMountCell } = useDataGridCellMounting({ scrollRoot: scrollRef })

watch(() => props.modelValue, content => {
  dictionary.value = parseProjectDictionaryText(content ?? '')
}, { immediate: true })

function canUseRecordKey(candidate: string, current?: string) {
  return dictionary.value
    ? canUseDictionaryRecordKey(dictionary.value, candidate, current)
    : false
}

function canUseLanguageKey(candidate: string, current?: string) {
  return dictionary.value
    ? canUseDictionaryLanguageKey(dictionary.value, candidate, current)
    : false
}

function commit(next: ProjectDictionary) {
  dictionary.value = next
  emit('update:modelValue', serializeProjectDictionary(next))
}

function beginRecordCreate(): void {
  addingRecord.value = true
  addingLanguage.value = false
}

function cancelRecordCreate(): void {
  addingRecord.value = false
  newRecordKey.value = ''
}

function addRecord() {
  if (!dictionary.value || !canUseRecordKey(newRecordKey.value)) return
  commit(addDictionaryRecord(dictionary.value, newRecordKey.value))
  cancelRecordCreate()
}

function beginLanguageCreate(): void {
  addingLanguage.value = true
  addingRecord.value = false
}

function cancelLanguageCreate(): void {
  addingLanguage.value = false
  newLanguageKey.value = ''
}

function addLanguage() {
  if (!dictionary.value || !canUseLanguageKey(newLanguageKey.value)) return
  commit(addDictionaryLanguage(dictionary.value, newLanguageKey.value))
  cancelLanguageCreate()
}

function updateCell(columnKey: string, recordKey: string, value: string) {
  if (!dictionary.value) return
  commit(setDictionaryCellValue(dictionary.value, columnKey, recordKey, value))
}

function resetOverride(language: string, recordKey: string) {
  if (!dictionary.value) return
  commit(resetDictionaryOverride(dictionary.value, language, recordKey))
}

function resetOverrideAction(): OcActionButtonAction {
  return { key: 'reset-override', icon: 'action.undo', title: t('dictionaryEditor.actions.resetOverride') }
}

function setActiveLanguage(language: string | undefined) {
  if (!dictionary.value) return
  commit(setDictionaryActiveLanguage(dictionary.value, language))
}

function beginRecordRename(recordKey: string) {
  editingLanguage.value = null
  editingRecord.value = recordKey
  renameDraft.value = recordKey
}

function beginLanguageRename(language: string) {
  editingRecord.value = null
  editingLanguage.value = language
  renameDraft.value = language
}

function cancelRename() {
  editingRecord.value = null
  editingLanguage.value = null
  renameDraft.value = ''
}

function commitRecordRename(recordKey: string) {
  if (editingRecord.value !== recordKey) return
  if (!canUseRecordKey(renameDraft.value, recordKey)) return
  commit(renameDictionaryRecord(dictionary.value!, recordKey, renameDraft.value))
  cancelRename()
}

function commitLanguageRename(language: string) {
  if (editingLanguage.value !== language) return
  if (!canUseLanguageKey(renameDraft.value, language)) return
  commit(renameDictionaryLanguage(dictionary.value!, language, renameDraft.value))
  cancelRename()
}

function selectedRecordKeysFor(recordKey: string): string[] {
  return selection.value.kind === 'rows' && selection.value.keys.has(recordKey)
    ? recordKeys.value.filter(key => selection.value.kind === 'rows' && selection.value.keys.has(key))
    : [recordKey]
}

function selectedLanguageKeysFor(language: string): string[] {
  return selection.value.kind === 'columns' && selection.value.keys.has(language)
    ? columnKeys.value.filter(key => key !== DICTIONARY_BASE_COLUMN_KEY
      && selection.value.kind === 'columns' && selection.value.keys.has(key))
    : [language]
}

function recordCommands(recordKey: string): OcActionButtonAction[] {
  const count = selectedRecordKeysFor(recordKey).length
  return [
    { key: 'rename', icon: 'action.edit', title: t('dictionaryEditor.actions.renameRecord'), disabled: count > 1 },
    {
      key: 'delete',
      icon: 'action.delete',
      iconTone: 'danger',
      title: t('dictionaryEditor.actions.deleteRecords', { count }),
      children: [{
        key: 'confirm-delete',
        icon: 'action.delete',
        iconTone: 'danger',
        title: t('dictionaryEditor.actions.confirmDeleteRecords', { count }),
      }],
    },
  ]
}

function recordAction(recordKey: string): OcActionButtonAction {
  return {
    key: 'more',
    icon: 'nav.more',
    title: t('dictionaryEditor.actions.recordActions'),
    children: recordCommands(recordKey),
  }
}

function handleRecordAction(recordKey: string, actionKey: string): void {
  if (actionKey === 'rename') beginRecordRename(recordKey)
  else if (actionKey === 'confirm-delete' && dictionary.value) {
    commit(deleteDictionaryRecords(dictionary.value, selectedRecordKeysFor(recordKey)))
    gridSelection.clearSelection()
  }
}

function languageCommands(language: string): OcActionButtonAction[] {
  const count = selectedLanguageKeysFor(language).length
  return [
    { key: 'set-active', icon: 'action.check', title: t('dictionaryEditor.actions.setActive'), disabled: count > 1 },
    { key: 'rename', icon: 'action.edit', title: t('dictionaryEditor.actions.renameLanguage'), disabled: count > 1 },
    {
      key: 'delete',
      icon: 'action.delete',
      iconTone: 'danger',
      title: t('dictionaryEditor.actions.deleteLanguages', { count }),
      children: [{
        key: 'confirm-delete',
        icon: 'action.delete',
        iconTone: 'danger',
        title: t('dictionaryEditor.actions.confirmDeleteLanguages', { count }),
      }],
    },
  ]
}

function languageAction(language: string): OcActionButtonAction {
  return {
    key: 'more',
    icon: 'nav.more',
    title: t('dictionaryEditor.actions.languageActions'),
    children: languageCommands(language),
  }
}

function handleLanguageAction(language: string, actionKey: string): void {
  if (actionKey === 'set-active') setActiveLanguage(language)
  else if (actionKey === 'rename') beginLanguageRename(language)
  else if (actionKey === 'confirm-delete' && dictionary.value) {
    commit(deleteDictionaryLanguages(dictionary.value, selectedLanguageKeysFor(language)))
    gridSelection.clearSelection()
  }
}

function openKeyboardContextMenu(
  event: KeyboardEvent,
  items: readonly OcActionButtonAction[],
  onSelect: (key: string) => void,
): void {
  if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return
  if (!(event.currentTarget instanceof HTMLElement)) return
  event.preventDefault()
  openContextMenu({ anchor: event.currentTarget, items, onSelect })
}

function openRecordContextMenu(event: MouseEvent, recordKey: string): void {
  openContextMenu({
    event,
    items: recordCommands(recordKey),
    onSelect: key => handleRecordAction(recordKey, key),
  })
}

function openRecordKeyboardMenu(event: KeyboardEvent, recordKey: string): void {
  openKeyboardContextMenu(event, recordCommands(recordKey), key => handleRecordAction(recordKey, key))
}

function openColumnContextMenu(event: MouseEvent, column: DictionaryGridColumn): void {
  if (column.kind !== 'language') return
  openContextMenu({
    event,
    items: languageCommands(column.sourceKey!),
    onSelect: key => handleLanguageAction(column.sourceKey!, key),
  })
}

function openColumnKeyboardMenu(event: KeyboardEvent, column: DictionaryGridColumn): void {
  if (column.kind !== 'language') return
  openKeyboardContextMenu(
    event,
    languageCommands(column.sourceKey!),
    key => handleLanguageAction(column.sourceKey!, key),
  )
}

function selectCell(recordKey: string, columnKey: string, event: MouseEvent): void {
  gridSelection.selectCell({ rowKey: recordKey, columnKey }, event.shiftKey)
}

function cellIdentity(recordKey: string, columnKey: string): string {
  return `${recordKey}\u0000${columnKey}`
}

function selectRow(recordKey: string, event: MouseEvent): void {
  gridSelection.selectRow(recordKey, event.ctrlKey || event.metaKey)
}

function selectColumn(columnKey: string, event: MouseEvent): void {
  gridSelection.selectColumn(columnKey, event.ctrlKey || event.metaKey)
}

function isCellSelected(recordKey: string, columnKey: string): boolean {
  return gridSelection.isCellSelected({ rowKey: recordKey, columnKey })
}

function isRowSelected(recordKey: string): boolean {
  return selection.value.kind === 'rows' && selection.value.keys.has(recordKey)
}

function isColumnSelected(columnKey: string): boolean {
  return selection.value.kind === 'columns' && selection.value.keys.has(columnKey)
}

function isActiveColumn(columnKey: string): boolean {
  return grid.value.columns.some(column => column.key === columnKey && column.active)
}

function selectedMatrixCoordinates(): { rowKeys: string[]; columnKeys: string[] } | null {
  if (selection.value.kind === 'rows') return {
    rowKeys: recordKeys.value.filter(key => selection.value.kind === 'rows' && selection.value.keys.has(key)),
    columnKeys: [...columnKeys.value],
  }
  if (selection.value.kind === 'columns') return {
    rowKeys: [...recordKeys.value],
    columnKeys: columnKeys.value.filter(key => selection.value.kind === 'columns' && selection.value.keys.has(key)),
  }
  const range = normalizedRange.value
  if (!range) return null
  const startRow = recordKeys.value.indexOf(range.start.rowKey)
  const endRow = recordKeys.value.indexOf(range.end.rowKey)
  const startColumn = columnKeys.value.indexOf(range.start.columnKey)
  const endColumn = columnKeys.value.indexOf(range.end.columnKey)
  return {
    rowKeys: recordKeys.value.slice(startRow, endRow + 1),
    columnKeys: columnKeys.value.slice(startColumn, endColumn + 1),
  }
}

function valueAt(recordKey: string, columnKey: string): string {
  return grid.value.rows.find(row => row.key === recordKey)?.cells.find(
    cell => cell.columnKey === columnKey,
  )?.value ?? ''
}

async function copySelection(): Promise<void> {
  const coordinates = selectedMatrixCoordinates()
  if (!coordinates || !navigator.clipboard?.writeText) return
  const matrix = coordinates.rowKeys.map(rowKey => coordinates.columnKeys.map(
    columnKey => valueAt(rowKey, columnKey),
  ))
  await navigator.clipboard.writeText(formatDataGridTsv(matrix))
  clipboardNotice.value = ''
}

async function pasteSelection(): Promise<void> {
  if (!dictionary.value || !gridSelection.focus.value || !navigator.clipboard?.readText) return
  const matrix = parseDataGridTsv(await navigator.clipboard.readText())
  const coordinates = selectedMatrixCoordinates()
  const result = applyDictionaryCellMatrix(
    dictionary.value,
    gridSelection.focus.value,
    matrix,
    coordinates ?? undefined,
  )
  commit(result.dictionary)
  clipboardNotice.value = result.clipped ? t('dictionaryEditor.feedback.pasteClipped') : ''
}

function clearSelectedCells(): void {
  if (!dictionary.value || selection.value.kind !== 'cells') return
  const coordinates = selectedMatrixCoordinates()
  if (!coordinates) return
  commit(clearDictionaryCells(dictionary.value, coordinates.rowKeys, coordinates.columnKeys))
}

async function focusSelectedCell(): Promise<void> {
  await nextTick()
  const focused = gridSelection.focus.value
  if (!focused) return
  const cells = rootRef.value?.querySelectorAll<HTMLElement>('[data-grid-row][data-grid-column]') ?? []
  Array.from(cells).find(cell => cell.dataset.gridRow === focused.rowKey
    && cell.dataset.gridColumn === focused.columnKey)?.focus()
}

function handleCellKeydown(event: KeyboardEvent, recordKey: string, columnKey: string): void {
  if (!gridSelection.focus.value) gridSelection.selectCell({ rowKey: recordKey, columnKey })
  const direction = event.key === 'ArrowUp' ? 'up'
    : event.key === 'ArrowDown' ? 'down'
      : event.key === 'ArrowLeft' ? 'left'
        : event.key === 'ArrowRight' ? 'right'
          : null
  if (!direction) return
  event.preventDefault()
  event.stopPropagation()
  gridSelection.moveFocus(direction, event.shiftKey)
  void focusSelectedCell()
}

function handleGridKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 's') {
    event.preventDefault()
    save()
    return
  }
  const target = event.target
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
    || (target instanceof HTMLElement && target.isContentEditable)) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'c') {
    event.preventDefault()
    void copySelection()
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'v') {
    event.preventDefault()
    void pasteSelection()
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    clearSelectedCells()
  }
}

function save() {
  if (dictionary.value) emit('save')
}

onBeforeUnmount(finishColumnResize)
defineExpose({ save })
</script>

<style scoped>
.dictionary-editor {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--oc-bg-base);
  color: var(--oc-fg-default);
}

.dictionary-editor__content {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.dictionary-editor__header {
  display: flex;
  align-items: flex-start;
  padding-bottom: var(--oc-space-4);
  border-bottom: var(--oc-border-width) solid var(--oc-border-muted);
}

.dictionary-editor__title,
.dictionary-editor__column-heading,
.dictionary-editor__column-actions,
.dictionary-editor__record-heading,
.dictionary-editor__notice,
.dictionary-editor__diagnostic {
  display: flex;
  align-items: center;
}

.dictionary-editor__title {
  min-width: 0;
  gap: var(--oc-space-3);
}

.dictionary-editor h1 {
  margin: 0 0 var(--oc-space-1);
  font-size: var(--oc-text-lg);
  font-weight: var(--font-weight-ui-title);
  letter-spacing: 0;
}

.dictionary-editor__grid {
  flex: 1 1 auto;
  min-height: 0;
  margin-top: var(--oc-space-5);
  border-top: var(--oc-border-width) solid var(--oc-border-muted);
  border-left: var(--oc-border-width) solid var(--oc-border-muted);
}

.dictionary-editor__notice {
  gap: var(--oc-space-2);
  margin-top: var(--oc-space-4);
  color: var(--oc-icon-warning);
}

.dictionary-editor__table thead th,
.dictionary-editor__key-column {
  font-size: var(--oc-text-sm);
}

.dictionary-editor__key-column {
  background: var(--oc-bg-raised);
}

.dictionary-editor__data-column {
  overflow: visible;
}

.dictionary-editor__table .is-active {
  background: var(--oc-bg-accent-subtle);
}

.dictionary-editor__table .is-selected {
  background: var(--oc-bg-selected);
  outline: var(--oc-border-width) solid var(--oc-fg-accent);
  outline-offset: calc(-1 * var(--oc-border-width));
}

.dictionary-editor__table th,
.dictionary-editor__table td {
  transition: background-color var(--oc-duration-fast) var(--oc-ease);
}

.dictionary-editor__table th:hover,
.dictionary-editor__table td:hover {
  background: var(--oc-bg-hover);
}

.dictionary-editor__column-heading,
.dictionary-editor__record-heading {
  align-items: center;
  justify-content: space-between;
  gap: var(--oc-space-2);
  min-width: 0;
}

.dictionary-editor__column-heading > span,
.dictionary-editor__record-heading > code {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dictionary-editor__column-heading :deep(.is-selected) {
  color: var(--oc-icon-active);
}

.dictionary-editor__column-actions {
  flex: 0 0 auto;
  gap: var(--oc-space-1);
}

.dictionary-editor__cell-action-slot {
  display: inline-flex;
  width: var(--oc-size-sm);
  flex: 0 0 var(--oc-size-sm);
  align-items: center;
}

.dictionary-editor__cell.is-inherited :deep(input) {
  color: var(--oc-fg-muted);
  font-style: italic;
}

.dictionary-editor__inline-create,
.dictionary-editor__rename {
  width: 100%;
}

.dictionary-editor__empty {
  color: var(--oc-fg-muted);
  text-align: center !important;
}

.dictionary-editor__add-row th,
.dictionary-editor__add-row td {
  background: var(--oc-bg-block);
}

.dictionary-editor__repair {
  flex: 1 1 auto;
  display: grid;
  grid-template-rows: auto minmax(var(--oc-list-max-height-lg), 1fr);
  gap: var(--oc-space-4);
  min-height: 0;
  padding-top: var(--oc-space-5);
}

.dictionary-editor__diagnostic {
  align-items: flex-start;
  gap: var(--oc-space-3);
}

.dictionary-editor__diagnostic div {
  display: grid;
  gap: var(--oc-space-1);
}

.dictionary-editor__source {
  min-height: var(--oc-list-max-height-lg);
  overflow: hidden;
  border: var(--oc-border-width) solid var(--oc-border-muted);
}
</style>
