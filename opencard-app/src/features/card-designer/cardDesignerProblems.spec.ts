import { describe, expect, it } from 'vitest'
import { createCardDesignerProblems } from './cardDesignerProblems'

const translate = (key: string) => `translated:${key}`

describe('createCardDesignerProblems', () => {
  it('normalizes binding and render parser issues with stable source-based ids', () => {
    const problems = createCardDesignerProblems({
      bindingIssues: [{
        path: '$.children[0].block.text',
        token: '{{currentCard.name}}',
        code: 'FIELD_NOT_FOUND',
        reason: '字段不存在',
      }],
      renderIssues: [{
        documentId: 'card-doc',
        blockPath: '$.children[0].block',
        blockId: 'title',
        fieldKey: 'opacity',
        fieldName: 'Opacity',
        reasonCode: 'OUT_OF_RANGE',
      }],
    }, translate)

    expect(problems).toEqual([
      expect.objectContaining({
        id: 'binding:$.children[0].block.text:FIELD_NOT_FOUND:{{currentCard.name}}',
        source: 'binding',
        severity: 'warning',
        code: 'FIELD_NOT_FOUND',
        detail: '字段不存在',
        path: '$.children[0].block.text',
        token: '{{currentCard.name}}',
      }),
      expect.objectContaining({
        id: 'render-parser:card-doc:$.children[0].block:opacity:OUT_OF_RANGE',
        source: 'render-parser',
        severity: 'warning',
        code: 'OUT_OF_RANGE',
        path: '$.children[0].block',
        blockId: 'title',
        fieldKey: 'opacity',
      }),
    ])
  })

  it('returns an empty report when the pipeline has no issues', () => {
    expect(createCardDesignerProblems({ bindingIssues: [], renderIssues: [] }, translate)).toEqual([])
    expect(createCardDesignerProblems(null, translate)).toEqual([])
  })
})
