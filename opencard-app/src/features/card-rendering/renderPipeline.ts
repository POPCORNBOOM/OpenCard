import { applyInstance } from '../../entities/card/instance'
import type { CardDocument, CardInstanceRecord } from '../../entities/card/model'
import { parseRenderDocument } from './renderParser'
import type { RenderIssue, RenderReadyCardDocument } from './render.types'
import { resolveReferences, type ReferenceResolveIssue } from './resolveCardBindings'

export type RenderPipelineIssue = ReferenceResolveIssue | RenderIssue

export type RenderPipelineResult = {
  document: RenderReadyCardDocument
  bindingIssues: ReferenceResolveIssue[]
  renderIssues: RenderIssue[]
  issues: RenderPipelineIssue[]
}

export function runRenderPipeline(
  document: CardDocument,
  instance: CardInstanceRecord | null,
): RenderPipelineResult {
  const projected = applyInstance(document, instance)
  const resolved = resolveReferences(projected, { currentCard: instance })
  const parsed = parseRenderDocument(resolved.document)

  return {
    document: parsed.document,
    bindingIssues: resolved.issues,
    renderIssues: parsed.issues,
    issues: [...resolved.issues, ...parsed.issues],
  }
}
