import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useDataGridSelection } from './useDataGridSelection'

describe('useDataGridSelection', () => {
  it('selects and normalizes a rectangular cell range', () => {
    const grid = useDataGridSelection({
      rowKeys: ref(['r1', 'r2', 'r3']),
      columnKeys: ref(['c1', 'c2', 'c3']),
    })
    grid.selectCell({ rowKey: 'r3', columnKey: 'c3' })
    grid.selectCell({ rowKey: 'r1', columnKey: 'c2' }, true)
    expect(grid.normalizedRange.value).toEqual({
      start: { rowKey: 'r1', columnKey: 'c2' },
      end: { rowKey: 'r3', columnKey: 'c3' },
    })
    expect(grid.isCellSelected({ rowKey: 'r2', columnKey: 'c2' })).toBe(true)
    expect(grid.isCellSelected({ rowKey: 'r2', columnKey: 'c1' })).toBe(false)
  })

  it('moves focus and extends from the original anchor', () => {
    const grid = useDataGridSelection({
      rowKeys: ref(['r1', 'r2']),
      columnKeys: ref(['c1', 'c2']),
    })
    grid.selectCell({ rowKey: 'r1', columnKey: 'c1' })
    grid.moveFocus('right', true)
    grid.moveFocus('down', true)
    expect(grid.normalizedRange.value).toEqual({
      start: { rowKey: 'r1', columnKey: 'c1' },
      end: { rowKey: 'r2', columnKey: 'c2' },
    })
  })

  it('toggles independent row and column sets', () => {
    const grid = useDataGridSelection({ rowKeys: ref([]), columnKeys: ref([]) })
    grid.selectRow('r1')
    grid.selectRow('r2', true)
    expect(grid.selection.value).toEqual({ kind: 'rows', keys: new Set(['r1', 'r2']) })
    grid.selectColumn('c1')
    grid.selectColumn('c2', true)
    expect(grid.selection.value).toEqual({ kind: 'columns', keys: new Set(['c1', 'c2']) })
  })
})
