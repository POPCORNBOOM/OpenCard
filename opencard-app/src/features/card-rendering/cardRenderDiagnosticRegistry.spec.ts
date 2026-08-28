import { watch } from 'vue'
import { describe, expect, it } from 'vitest'
import { createCardRenderDiagnosticRegistry } from './cardRenderDiagnosticRegistry'
import type { CardPipelineIssue } from './cardPipelineIssue'

describe('card render diagnostic registry', () => {
  it('replaces, removes and snapshots issues by owner', () => {
    const registry = createCardRenderDiagnosticRegistry()
    const first = { type: 'card-designer.rich-text.invalid-html' } as never
    const second = { type: 'card-designer.render-parse.invalid-type' } as never

    registry.replace('surface\u0000a', [first])
    registry.replace('surface\u0000b', [second])
    expect(registry.snapshot()).toEqual([first, second])

    registry.replace('surface\u0000a', [])
    expect(registry.snapshot()).toEqual([second])
    registry.remove('surface\u0000b')
    expect(registry.snapshot()).toEqual([])
  })

  it('does not publish an equal owner snapshot again', () => {
    const registry = createCardRenderDiagnosticRegistry()
    const issue = { id: 'same', type: 'card-designer.rich-text.invalid-html' } as unknown as CardPipelineIssue
    let changes = 0
    watch(registry.issues, () => { changes += 1 }, { flush: 'sync' })

    registry.replace('surface', [])
    registry.replace('surface', [issue])
    registry.replace('surface', [{ ...issue }])

    expect(changes).toBe(1)
  })
})
