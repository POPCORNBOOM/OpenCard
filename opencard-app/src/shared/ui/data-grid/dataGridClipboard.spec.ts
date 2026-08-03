import { describe, expect, it } from 'vitest'
import { formatDataGridTsv, parseDataGridTsv } from './dataGridClipboard'

describe('dataGridClipboard', () => {
  it('round trips tabs, line breaks, and quotes', () => {
    const matrix = [['plain', 'with\ttab'], ['line\nbreak', 'a "quote"']]
    expect(parseDataGridTsv(formatDataGridTsv(matrix))).toEqual(matrix)
  })

  it('accepts spreadsheet CRLF and a trailing line break', () => {
    expect(parseDataGridTsv('one\ttwo\r\nthree\tfour\r\n')).toEqual([
      ['one', 'two'],
      ['three', 'four'],
    ])
  })
})
