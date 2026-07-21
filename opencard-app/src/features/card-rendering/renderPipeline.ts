import { applyInstance } from '../../entities/card/instance'
import type { CardDocument, CardInstanceRecord } from '../../entities/card/model'
import type { CardPipelineIssue } from './cardPipelineIssue'
import { parseRenderDocument } from './renderParser'
import type { RenderReadyCardDocument } from './render.types'
import { resolveReferences } from './resolveCardBindings'

export type RenderPipelineResult = {
  document: RenderReadyCardDocument
  issues: CardPipelineIssue[]
}

export function runRenderPipeline(
  document: CardDocument,
  instance: CardInstanceRecord | null,
): RenderPipelineResult {
  const projected = applyInstance(document, instance)
  const resolved = resolveReferences(projected, { currentCard: instance })
  const parsed = parseRenderDocument(resolved.document, {
    instanceId: instance?.id ?? null,
  })

  return {
    document: parsed.document,
    issues: [...resolved.issues, ...parsed.issues],
  }
}
