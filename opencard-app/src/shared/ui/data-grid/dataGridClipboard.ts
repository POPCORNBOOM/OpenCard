function encodeCell(value: string): string {
  if (!/[\t\r\n"]/.test(value)) return value
  return `"${value.replace(/"/g, '""')}"`
}

export function formatDataGridTsv(rows: readonly (readonly string[])[]): string {
  return rows.map(row => row.map(encodeCell).join('\t')).join('\n')
}

export function parseDataGridTsv(text: string): string[][] {
  const rows: string[][] = [[]]
  let value = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"'
        index += 1
      } else if (character === '"') quoted = false
      else value += character
      continue
    }
    if (character === '"' && value.length === 0) quoted = true
    else if (character === '\t') {
      rows[rows.length - 1]!.push(value)
      value = ''
    } else if (character === '\n' || character === '\r') {
      rows[rows.length - 1]!.push(value)
      value = ''
      if (character === '\r' && text[index + 1] === '\n') index += 1
      if (index < text.length - 1) rows.push([])
    } else value += character
  }
  if (!/[\r\n]$/.test(text) || rows[rows.length - 1]!.length === 0) {
    rows[rows.length - 1]!.push(value)
  }
  return rows
}
