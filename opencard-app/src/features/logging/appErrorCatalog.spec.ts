import { describe, expect, it } from 'vitest'
import errorCodeDocument from '../../../../docs/错误码.md?raw'
import {
  APP_ERROR_CATALOG,
  createAppErrorReport,
  getAppErrorMeaning,
  isAppErrorReport,
} from './appErrorCatalog'

describe('appErrorCatalog', () => {
  it('uses searchable codes with complete localized meanings and solutions', () => {
    for (const [code, definition] of Object.entries(APP_ERROR_CATALOG)) {
      expect(code).toMatch(/^OC-E[1-6]\d{3}$/)
      expect(definition.area.trim()).not.toBe('')
      expect(definition.meaning['zh-CN'].trim()).not.toBe('')
      expect(definition.meaning['en-US'].trim()).not.toBe('')
      expect(definition.solution.trim()).not.toBe('')
    }
  })

  it('keeps the query document synchronized with every runtime definition', () => {
    for (const [code, definition] of Object.entries(APP_ERROR_CATALOG)) {
      expect(errorCodeDocument).toContain(`\`${code}\``)
      expect(errorCodeDocument).toContain(definition.meaning['zh-CN'])
      expect(errorCodeDocument).toContain(definition.solution)
    }
  })

  it('resolves localized meanings and recognizes structured reports', () => {
    expect(getAppErrorMeaning('OC-E2003', 'zh-CN')).toBe('无法打开文件')
    expect(getAppErrorMeaning('OC-E2003', 'en-US')).toBe('Could not open the file')

    const report = createAppErrorReport('OC-E2003', { path: 'missing.opencard' })
    expect(isAppErrorReport(report)).toBe(true)
    expect(report).toMatchObject({ code: 'OC-E2003', details: { path: 'missing.opencard' } })
  })
})
