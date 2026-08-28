import { describe, expect, it, vi } from 'vitest'
import { createCardPipelineIssue } from '../cardPipelineIssue'
import { createCardViewportComparisonDiagnostics } from './cardViewportComparisonDiagnostics'

function issue(id: string) {
  return createCardPipelineIssue({
    type: 'card-designer.rich-text.invalid-html',
    location: {
      documentId: id, instanceId: null, faceKey: 'front',
      owner: { kind: 'face', id }, fieldKey: 'content',
    },
  })
}

describe('cardViewportComparisonDiagnostics', () => {
  it('merges both sides and removes only the replaced surface', () => {
    const report = vi.fn()
    const diagnostics = createCardViewportComparisonDiagnostics(report)
    diagnostics.replace('before', [issue('before')])
    diagnostics.replace('after', [issue('after')])
    expect(report).toHaveBeenLastCalledWith([issue('before'), issue('after')])
    diagnostics.remove('before')
    expect(report).toHaveBeenLastCalledWith([issue('after')])
  })
})
