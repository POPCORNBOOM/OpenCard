import { describe, expect, it } from 'vitest'
import type { CardDocument } from '../../entities/card/model'
import type { CdeDataTableFaceGroup, CdeDataTableColumn } from './useCdeDataTableModel'
import {
  exportCardDataWorkbook,
  importCardDataWorkbook,
} from './cardDataWorkbook'

function createDocument(): CardDocument {
  return {
    type: 'card-document',
    schemaVersion: '2',
    id: 'document-1',
    name: 'Export test',
    version: '1.0.0',
    width: '540',
    height: '850',
    faces: {
      front: { type: 'card-face', id: 'front', background: '#fff', children: [] },
      back: { type: 'card-face', id: 'back', background: '#000', children: [] },
    },
    instances: [{
      type: 'card-instance',
      id: 'instance-1',
      name: 'Instance 1',
      amount: '1',
      data: { 'block-1': { content: 'Override' } },
    }],
  }
}

function createColumns(): CdeDataTableColumn[] {
  return [
    { key: '__blueprint__', kind: 'blueprint', title: 'Blueprint', exported: true },
    { key: 'instance-1', kind: 'instance', title: 'Instance 1', exported: true },
  ]
}

function createFaceGroups(): CdeDataTableFaceGroup[] {
  return [{
    key: 'front',
    title: 'Front',
    blocks: [{
      key: 'block-1',
      title: 'Title Block',
      type: 'text-block',
      depth: 0,
      fields: [{
        key: 'content',
        title: 'Content',
        definition: { fieldType: 'string', title: 'Content' },
        deletable: false,
        cells: [
          { identity: 'blueprint', cardId: '__blueprint__', value: 'Blueprint', readonly: false, inherited: false, overridden: false },
          { identity: 'instance', cardId: 'instance-1', value: 'Override', readonly: false, inherited: false, overridden: true },
        ],
      }],
    }],
  }]
}

describe('card data workbook', () => {
  it('exports hidden identity metadata and an inherit formula', async () => {
    const document = createDocument()
    const bytes = await exportCardDataWorkbook({
      document,
      columns: createColumns(),
      faceGroups: createFaceGroups(),
      exportInstanceIds: ['instance-1'],
      labels: { face: 'Face', block: 'Block', field: 'Field' },
    })
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(bytes)
    const worksheet = workbook.getWorksheet('Card Data')!

    expect(worksheet.getRow(1).hidden).toBe(true)
    expect(worksheet.getColumn(1).hidden).toBe(true)
    expect(worksheet.getCell('A3').value).toBe('block-1')
    expect(worksheet.getCell('B3').value).toBe('content')
    expect(worksheet.getCell('C3').value).toBe('Front')
    expect(worksheet.getCell('F1').value).toBe('__blueprint__')
    expect(worksheet.getCell('G1').value).toBe('instance-1')
    expect(worksheet.getCell('G3').value).toBe('Override')
    expect(workbook.getWorksheet('_OpenCard')!.state).toBe('veryHidden')
  })

  it('imports exact Blueprint references as reset operations', async () => {
    const document = createDocument()
    const bytes = await exportCardDataWorkbook({
      document,
      columns: createColumns(),
      faceGroups: [{
        ...createFaceGroups()[0]!,
        blocks: [{
          ...createFaceGroups()[0]!.blocks[0]!,
          fields: [{
            ...createFaceGroups()[0]!.blocks[0]!.fields[0]!,
            cells: [createFaceGroups()[0]!.blocks[0]!.fields[0]!.cells[0]!, {
              identity: 'instance',
              cardId: 'instance-1',
              value: 'Blueprint',
              readonly: false,
              inherited: true,
              overridden: false,
            }],
          }],
        }],
      }],
      exportInstanceIds: ['instance-1'],
      labels: { face: 'Face', block: 'Block', field: 'Field' },
    })
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(bytes)
    expect(workbook.getWorksheet('Card Data')!.getCell('G3').formula).toBe('$F3')
    const result = await importCardDataWorkbook(bytes, document, createFaceGroups())
    expect(result.warnings).toEqual([])
    expect(result.updates).toContainEqual({
      cardId: 'instance-1',
      blockId: 'block-1',
      fieldKey: 'content',
      reset: true,
    })
  })

  it('rejects imports for another document', async () => {
    const document = createDocument()
    const bytes = await exportCardDataWorkbook({
      document,
      columns: createColumns(),
      faceGroups: createFaceGroups(),
      exportInstanceIds: ['instance-1'],
      labels: { face: 'Face', block: 'Block', field: 'Field' },
    })
    document.id = 'different-document'
    await expect(importCardDataWorkbook(bytes, document, createFaceGroups()))
      .rejects.toThrow('Workbook belongs to a different card document')
  })

  it('rejects formulas other than the generated Blueprint reference', async () => {
    const document = createDocument()
    const bytes = await exportCardDataWorkbook({
      document,
      columns: createColumns(),
      faceGroups: createFaceGroups(),
      exportInstanceIds: ['instance-1'],
      labels: { face: 'Face', block: 'Block', field: 'Field' },
    })
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(bytes)
    workbook.getWorksheet('Card Data')!.getCell('G3').value = {
      formula: 'SUM(F3)',
      result: 'Blueprint',
    }
    const modified = await workbook.xlsx.writeBuffer()

    await expect(importCardDataWorkbook(new Uint8Array(modified), document, createFaceGroups()))
      .rejects.toThrow('Unsupported formula in G3')
  })

  it('rejects duplicate hidden card identities', async () => {
    const document = createDocument()
    const bytes = await exportCardDataWorkbook({
      document,
      columns: createColumns(),
      faceGroups: createFaceGroups(),
      exportInstanceIds: ['instance-1'],
      labels: { face: 'Face', block: 'Block', field: 'Field' },
    })
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(bytes)
    workbook.getWorksheet('Card Data')!.getCell('H1').value = 'instance-1'
    const modified = await workbook.xlsx.writeBuffer()

    await expect(importCardDataWorkbook(new Uint8Array(modified), document, createFaceGroups()))
      .rejects.toThrow('Workbook contains duplicate card column instance-1')
  })
})
