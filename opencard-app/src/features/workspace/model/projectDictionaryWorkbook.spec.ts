import { describe, expect, it } from 'vitest'
import {
  exportProjectDictionaryWorkbook,
  importProjectDictionaryWorkbook,
} from './projectDictionaryWorkbook'

describe('project dictionary workbook', () => {
  it('exports stable language identities and inherited formulas', async () => {
    const bytes = await exportProjectDictionaryWorkbook({
      base: { title: 'Default', body: 'Body' },
      languages: { en_US: { title: 'English' } },
    }, { key: 'Key', base: 'Base' })
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(bytes)
    const sheet = workbook.getWorksheet('Dictionary')!

    expect(sheet.getRow(1).hidden).toBe(true)
    expect(sheet.getCell('B1').value).toBe('$base')
    expect(sheet.getCell('C1').value).toBe('en_US')
    expect(sheet.getCell('C3').value).toBe('English')
    expect(sheet.getCell('C4').formula).toBe('$B4')
    expect(workbook.getWorksheet('_OpenCard')!.state).toBe('veryHidden')
  })

  it('imports updates plus new records and language columns without deleting omitted data', async () => {
    const current = {
      active: 'en_US',
      base: { title: 'Default', untouched: 'Keep' },
      languages: { en_US: { title: 'English', untouched: 'Keep EN' } },
    }
    const bytes = await exportProjectDictionaryWorkbook(current, { key: 'Key', base: 'Base' })
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(bytes)
    const sheet = workbook.getWorksheet('Dictionary')!
    sheet.getCell('B3').value = 'Changed'
    sheet.getCell('C3').value = null
    sheet.getCell('A5').value = 'new_record'
    sheet.getCell('B5').value = 'New base'
    sheet.getCell('D2').value = 'fr_FR'
    sheet.getCell('D3').value = 'Francais'
    sheet.getCell('D5').value = 'Nouveau'
    const modified = await workbook.xlsx.writeBuffer()

    const result = await importProjectDictionaryWorkbook(new Uint8Array(modified), current)
    expect(result.addedRecords).toEqual(['new_record'])
    expect(result.addedLanguages).toEqual(['fr_FR'])
    expect(result.dictionary).toEqual({
      active: 'en_US',
      base: { title: 'Changed', untouched: 'Keep', new_record: 'New base' },
      languages: {
        en_US: { untouched: 'Keep EN' },
        fr_FR: { title: 'Francais', new_record: 'Nouveau' },
      },
    })
  })

  it('rejects unsupported formulas and duplicate record keys', async () => {
    const bytes = await exportProjectDictionaryWorkbook({ base: { title: 'Default' } }, { key: 'Key', base: 'Base' })
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(bytes)
    const sheet = workbook.getWorksheet('Dictionary')!
    sheet.getCell('B3').value = { formula: 'SUM(1, 2)', result: 3 }
    await expect(importProjectDictionaryWorkbook(
      new Uint8Array(await workbook.xlsx.writeBuffer()),
      { base: { title: 'Default' } },
    )).rejects.toThrow('Unsupported formula in B3')

    sheet.getCell('B3').value = 'Default'
    sheet.getCell('A4').value = 'TITLE'
    await expect(importProjectDictionaryWorkbook(
      new Uint8Array(await workbook.xlsx.writeBuffer()),
      { base: { title: 'Default' } },
    )).rejects.toThrow('Duplicate record key')
  })
})
