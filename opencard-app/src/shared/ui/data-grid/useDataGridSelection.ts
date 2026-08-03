import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type {
  DataGridCellAddress,
  DataGridCellRange,
  DataGridDirection,
  DataGridSelection,
} from './dataGrid.types'

type DataGridSelectionOptions = {
  rowKeys: Readonly<Ref<readonly string[]> | ComputedRef<readonly string[]>>
  columnKeys: Readonly<Ref<readonly string[]> | ComputedRef<readonly string[]>>
}

function toggleKey(keys: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(keys)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

export function useDataGridSelection(options: DataGridSelectionOptions) {
  const focus = ref<DataGridCellAddress | null>(null)
  const anchor = ref<DataGridCellAddress | null>(null)
  const selection = ref<DataGridSelection>({ kind: 'none' })

  const normalizedRange = computed<DataGridCellRange | null>(() => {
    if (selection.value.kind !== 'cells') return null
    const rows = options.rowKeys.value
    const columns = options.columnKeys.value
    const startRow = rows.indexOf(selection.value.range.start.rowKey)
    const endRow = rows.indexOf(selection.value.range.end.rowKey)
    const startColumn = columns.indexOf(selection.value.range.start.columnKey)
    const endColumn = columns.indexOf(selection.value.range.end.columnKey)
    if ([startRow, endRow, startColumn, endColumn].some(index => index < 0)) return null
    return {
      start: {
        rowKey: rows[Math.min(startRow, endRow)]!,
        columnKey: columns[Math.min(startColumn, endColumn)]!,
      },
      end: {
        rowKey: rows[Math.max(startRow, endRow)]!,
        columnKey: columns[Math.max(startColumn, endColumn)]!,
      },
    }
  })

  function selectCell(address: DataGridCellAddress, extend = false): void {
    if (!extend || !anchor.value) anchor.value = address
    focus.value = address
    selection.value = { kind: 'cells', range: { start: anchor.value, end: address } }
  }

  function selectRow(key: string, toggle = false): void {
    const previous = selection.value.kind === 'rows' ? selection.value.keys : new Set<string>()
    const keys = toggle ? toggleKey(previous, key) : new Set([key])
    selection.value = keys.size > 0 ? { kind: 'rows', keys } : { kind: 'none' }
    focus.value = null
    anchor.value = null
  }

  function selectColumn(key: string, toggle = false): void {
    const previous = selection.value.kind === 'columns' ? selection.value.keys : new Set<string>()
    const keys = toggle ? toggleKey(previous, key) : new Set([key])
    selection.value = keys.size > 0 ? { kind: 'columns', keys } : { kind: 'none' }
    focus.value = null
    anchor.value = null
  }

  function moveFocus(direction: DataGridDirection, extend = false): DataGridCellAddress | null {
    const rows = options.rowKeys.value
    const columns = options.columnKeys.value
    if (rows.length === 0 || columns.length === 0) return null
    const current = focus.value ?? { rowKey: rows[0]!, columnKey: columns[0]! }
    const rowIndex = Math.max(0, rows.indexOf(current.rowKey))
    const columnIndex = Math.max(0, columns.indexOf(current.columnKey))
    const next = {
      rowKey: rows[Math.min(rows.length - 1, Math.max(0, rowIndex + (
        direction === 'up' ? -1 : direction === 'down' ? 1 : 0
      )))]!,
      columnKey: columns[Math.min(columns.length - 1, Math.max(0, columnIndex + (
        direction === 'left' ? -1 : direction === 'right' ? 1 : 0
      )))]!,
    }
    selectCell(next, extend)
    return next
  }

  function isCellSelected(address: DataGridCellAddress): boolean {
    const range = normalizedRange.value
    if (!range) return false
    const rows = options.rowKeys.value
    const columns = options.columnKeys.value
    const rowIndex = rows.indexOf(address.rowKey)
    const columnIndex = columns.indexOf(address.columnKey)
    return rowIndex >= rows.indexOf(range.start.rowKey)
      && rowIndex <= rows.indexOf(range.end.rowKey)
      && columnIndex >= columns.indexOf(range.start.columnKey)
      && columnIndex <= columns.indexOf(range.end.columnKey)
  }

  function clearSelection(): void {
    focus.value = null
    anchor.value = null
    selection.value = { kind: 'none' }
  }

  return {
    focus,
    selection,
    normalizedRange,
    selectCell,
    selectRow,
    selectColumn,
    moveFocus,
    isCellSelected,
    clearSelection,
  }
}
