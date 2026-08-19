import { describe, expect, it } from 'vitest'
import { validateCardSchemaField } from './schemaDiagnostics'
import type { EditorPropertyDefinition } from './schema'

describe('card schema diagnostics', () => {
  it('allows storage while diagnosing required, color, path, and CSS length values', () => {
    expect(validateCardSchemaField('', { fieldType: 'string', required: true })).toMatchObject({
      ok: false, diagnostics: [{ code: 'required', path: [] }],
    })
    expect(validateCardSchemaField('not a color!', { fieldType: 'color' })).toMatchObject({
      ok: false, diagnostics: [{ code: 'invalid-color', path: [] }],
    })
    expect(validateCardSchemaField('../outside.exe', {
      fieldType: 'filePath', filter: { target: 'file', extensions: ['png'] },
    })).toMatchObject({ ok: false, diagnostics: [{ code: 'invalid-file-path', path: [] }] })
    expect(validateCardSchemaField('wide-ish', { fieldType: 'string' }, { cssLength: true }))
      .toMatchObject({ ok: false, diagnostics: [{ code: 'invalid-css-length', path: [] }] })
  })

  it('validates objectType array elements and reports their index', () => {
    const result = validateCardSchemaField([
      { block: { id: 'a' }, location: { id: 'l' } },
      { invalid: true },
    ], { fieldType: 'object', objectType: 'RootChild', isArray: true })
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'invalid-object', path: [1] }],
    })
  })

  it('reports indexes for invalid scalar array elements', () => {
    const result = validateCardSchemaField(['1', 'oops'], { fieldType: 'number[]' } as unknown as EditorPropertyDefinition)
    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'conversion-failed', path: [1] }],
    })
  })
})
