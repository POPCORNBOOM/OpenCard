import type { CardStoredValue, CardDocument } from '../../entities/card/model'
import type {
  CdeDataTableCell,
  CdeDataTableColumn,
  CdeDataTableFaceGroup,
} from './useCdeDataTableModel'

const BLUEPRINT_CARD_ID = '__blueprint__'
const WORKSHEET_NAME = 'Card Data'
const METADATA_SHEET_NAME = '_OpenCard'
const FORMAT_NAME = 'opencard-data-table'
const FORMAT_VERSION = 1
const FIRST_DATA_COLUMN = 6
const FIRST_DATA_ROW = 3

type ExcelJsModule = typeof import('exceljs')

export type CardDataWorkbookExportInput = {
  document: CardDocument
  columns: readonly CdeDataTableColumn[]
  faceGroups: readonly CdeDataTableFaceGroup[]
  exportInstanceIds: readonly string[]
  labels: { face: string; block: string; field: string }
}

export type CardDataWorkbookUpdate = {
  cardId: string
  blockId: string
  fieldKey: string
  value?: CardStoredValue
  reset: boolean
}

export type CardDataWorkbookImportResult = {
  updates: CardDataWorkbookUpdate[]
  warnings: string[]
}

export class CardDataWorkbookError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CardDataWorkbookError'
  }
}

export async function exportCardDataWorkbook(
  input: CardDataWorkbookExportInput,
): Promise<Uint8Array> {
  const ExcelJS = await loadExcelJs()
  const workbook = new ExcelJS.Workbook()
  workbook.calcProperties.fullCalcOnLoad = true

  const worksheet = workbook.addWorksheet(WORKSHEET_NAME)
  worksheet.views = [{ state: 'frozen', xSplit: FIRST_DATA_COLUMN - 1, ySplit: 2 }]
  worksheet.columns = [
    { key: 'blockId', width: 2, hidden: true },
    { key: 'fieldKey', width: 2, hidden: true },
    { key: 'face', width: 12 },
    { key: 'blockName', width: 28 },
    { key: 'fieldName', width: 28 },
  ]
  worksheet.getRow(1).hidden = true
  setCell(worksheet, 1, 1, 'blockId')
  setCell(worksheet, 1, 2, 'fieldKey')
  setCell(worksheet, 1, 3, 'face')
  setCell(worksheet, 1, 4, 'blockName')
  setCell(worksheet, 1, 5, 'fieldName')

  const includedColumns = input.columns.filter(column => (
    column.kind === 'blueprint' || input.exportInstanceIds.includes(column.key)
  ))
  includedColumns.forEach((column, index) => {
    const columnNumber = FIRST_DATA_COLUMN + index
    worksheet.getColumn(columnNumber).width = 32
    setCell(worksheet, 1, columnNumber, column.key)
    setCell(worksheet, 2, columnNumber, column.title)
  })
  setCell(worksheet, 2, 3, input.labels.face)
  setCell(worksheet, 2, 4, input.labels.block)
  setCell(worksheet, 2, 5, input.labels.field)

  let rowNumber = FIRST_DATA_ROW
  for (const face of input.faceGroups) {
    for (const block of face.blocks) {
      for (const field of block.fields) {
        setCell(worksheet, rowNumber, 1, block.key)
        setCell(worksheet, rowNumber, 2, field.key)
        setCell(worksheet, rowNumber, 3, face.title)
        setCell(worksheet, rowNumber, 4, block.title)
        setCell(worksheet, rowNumber, 5, field.title)
        const cells = new Map(field.cells.map(cell => [cell.cardId, cell]))
        includedColumns.forEach((column, index) => {
          const columnNumber = FIRST_DATA_COLUMN + index
          const cell = cells.get(column.key)
          if (!cell) return
          writeExportCell(worksheet, rowNumber, columnNumber, cell, column.kind)
        })
        rowNumber += 1
      }
    }
  }

  const metadata = workbook.addWorksheet(METADATA_SHEET_NAME)
  metadata.state = 'veryHidden'
  metadata.getCell('A1').value = 'format'
  metadata.getCell('B1').value = FORMAT_NAME
  metadata.getCell('A2').value = 'version'
  metadata.getCell('B2').value = FORMAT_VERSION
  metadata.getCell('A3').value = 'documentId'
  metadata.getCell('B3').value = input.document.id

  const buffer = await workbook.xlsx.writeBuffer()
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
}

export async function importCardDataWorkbook(
  bytes: Uint8Array,
  document: CardDocument,
  faceGroups: readonly CdeDataTableFaceGroup[],
): Promise<CardDataWorkbookImportResult> {
  const ExcelJS = await loadExcelJs()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(bytes)
  validateMetadata(workbook, document)

  const worksheet = workbook.getWorksheet(WORKSHEET_NAME)
  if (!worksheet) throw new CardDataWorkbookError(`Missing worksheet: ${WORKSHEET_NAME}`)

  const visibleFields = new Set<string>()
  const blockSamples = new Map<string, unknown>()
  for (const face of faceGroups) {
    for (const block of face.blocks) {
      for (const field of block.fields) {
        const key = `${block.key}\u0000${field.key}`
        visibleFields.add(key)
        const blueprintCell = field.cells.find(cell => cell.cardId === BLUEPRINT_CARD_ID)
        blockSamples.set(key, blueprintCell?.value)
      }
    }
  }

  const currentInstanceIds = new Set(document.instances.map(instance => instance.id))
  const columnTargets = readColumnTargets(worksheet, currentInstanceIds)
  const warnings = columnTargets.warnings
  const updates: CardDataWorkbookUpdate[] = []
  const seenFields = new Set<string>()

  for (let rowNumber = FIRST_DATA_ROW; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const blockId = readString(worksheet.getCell(rowNumber, 1).value)
    const fieldKey = readString(worksheet.getCell(rowNumber, 2).value)
    if (!blockId && !fieldKey) continue
    if (!blockId || !fieldKey) {
      throw new CardDataWorkbookError(`Row ${rowNumber} has an incomplete field identity`)
    }
    const fieldIdentity = `${blockId}\u0000${fieldKey}`
    if (seenFields.has(fieldIdentity)) {
      throw new CardDataWorkbookError(`Workbook contains duplicate field ${blockId}.${fieldKey}`)
    }
    seenFields.add(fieldIdentity)
    if (!visibleFields.has(fieldIdentity)) {
      throw new CardDataWorkbookError(`Field ${blockId}.${fieldKey} is not visible in the Data Table`)
    }

    const sample = blockSamples.get(fieldIdentity)
    columnTargets.columns.forEach(({ columnNumber, cardId }) => {
      const cell = worksheet.getCell(rowNumber, columnNumber)
      const formula = cell.formula
      if (formula !== undefined) {
        if (cardId === BLUEPRINT_CARD_ID) {
          throw new CardDataWorkbookError(`Blueprint cell ${cell.address} cannot contain an inherit formula`)
        }
        if (normalizeFormula(formula) === `F${rowNumber}`) {
          updates.push({ cardId, blockId, fieldKey, reset: true })
          return
        }
        throw new CardDataWorkbookError(`Unsupported formula in ${cell.address}`)
      }
      updates.push({
        cardId,
        blockId,
        fieldKey,
        value: decodeCellValue(cell.value, sample, cell.address),
        reset: false,
      })
    })
  }

  return { updates, warnings }
}

async function loadExcelJs(): Promise<ExcelJsModule> {
  return await import('exceljs')
}

function writeExportCell(
  worksheet: import('exceljs').Worksheet,
  rowNumber: number,
  columnNumber: number,
  cell: CdeDataTableCell,
  kind: CdeDataTableColumn['kind'],
): void {
  const target = worksheet.getCell(rowNumber, columnNumber)
  if (kind === 'instance' && cell.inherited) {
    const blueprintColumn = getColumnLetter(FIRST_DATA_COLUMN)
    target.value = { formula: `$${blueprintColumn}${rowNumber}`, result: encodeCellValue(cell.value) }
    return
  }
  target.value = encodeCellValue(cell.value)
}

function validateMetadata(workbook: import('exceljs').Workbook, document: CardDocument): void {
  const metadata = workbook.getWorksheet(METADATA_SHEET_NAME)
  if (!metadata) throw new CardDataWorkbookError('Missing OpenCard workbook metadata')
  if (readString(metadata.getCell('B1').value) !== FORMAT_NAME) {
    throw new CardDataWorkbookError('Unsupported OpenCard workbook format')
  }
  if (Number(metadata.getCell('B2').value) !== FORMAT_VERSION) {
    throw new CardDataWorkbookError('Unsupported OpenCard workbook version')
  }
  if (readString(metadata.getCell('B3').value) !== document.id) {
    throw new CardDataWorkbookError('Workbook belongs to a different card document')
  }
}

function readColumnTargets(
  worksheet: import('exceljs').Worksheet,
  currentInstanceIds: ReadonlySet<string>,
): { columns: Array<{ columnNumber: number; cardId: string }>; warnings: string[] } {
  const columns: Array<{ columnNumber: number; cardId: string }> = []
  const warnings: string[] = []
  const seenCardIds = new Set<string>()
  for (let columnNumber = FIRST_DATA_COLUMN; columnNumber <= worksheet.columnCount; columnNumber += 1) {
    const cardId = readString(worksheet.getCell(1, columnNumber).value)
    if (!cardId) continue
    if (seenCardIds.has(cardId)) {
      throw new CardDataWorkbookError(`Workbook contains duplicate card column ${cardId}`)
    }
    seenCardIds.add(cardId)
    if (cardId === BLUEPRINT_CARD_ID || currentInstanceIds.has(cardId)) {
      columns.push({ columnNumber, cardId })
    } else {
      warnings.push(`Instance ${cardId} is no longer present and was skipped`)
    }
  }
  if (!columns.some(column => column.cardId === BLUEPRINT_CARD_ID)) {
    throw new CardDataWorkbookError('Workbook is missing the Blueprint column')
  }
  return { columns, warnings }
}

function encodeCellValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined || value === null) return ''
  const serialized = JSON.stringify(value)
  return serialized === undefined ? '' : serialized
}

function decodeCellValue(value: unknown, sample: unknown, address: string): CardStoredValue {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') {
    if (Array.isArray(sample) || (sample !== null && typeof sample === 'object')) {
      try {
        const parsed = JSON.parse(value) as unknown
        if (isStoredValue(parsed)) return parsed
      } catch {
        // Fall through to the same useful validation error below.
      }
      throw new CardDataWorkbookError(`Cell ${address} must contain valid JSON`)
    }
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  throw new CardDataWorkbookError(`Cell ${address} contains an unsupported value`)
}

function isStoredValue(value: unknown): value is CardStoredValue {
  if (typeof value === 'string') return true
  if (Array.isArray(value)) return value.every(isStoredValue)
  if (!value || typeof value !== 'object') return false
  return Object.values(value).every(isStoredValue)
}

function normalizeFormula(formula: string): string {
  return formula.replace(/^=/, '').replace(/\$/g, '').replace(/\s+/g, '').toUpperCase()
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function setCell(
  worksheet: import('exceljs').Worksheet,
  rowNumber: number,
  columnNumber: number,
  value: string,
): void {
  worksheet.getCell(rowNumber, columnNumber).value = value
}

function getColumnLetter(columnNumber: number): string {
  let value = columnNumber
  let result = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}
