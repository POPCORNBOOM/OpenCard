export type DataGridCellAddress = {
  rowKey: string
  columnKey: string
}

export type DataGridCellRange = {
  start: DataGridCellAddress
  end: DataGridCellAddress
}

export type DataGridSelection =
  | { kind: 'cells'; range: DataGridCellRange }
  | { kind: 'rows'; keys: ReadonlySet<string> }
  | { kind: 'columns'; keys: ReadonlySet<string> }
  | { kind: 'none' }

export type DataGridDirection = 'up' | 'down' | 'left' | 'right'
