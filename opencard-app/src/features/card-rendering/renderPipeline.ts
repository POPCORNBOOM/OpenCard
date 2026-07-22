import { applyInstance } from '../../entities/card/instance'
import type { CardDocument, CardInstanceRecord } from '../../entities/card/model'
import type { CardPipelineIssue } from './cardPipelineIssue'
import { parseRenderDocument } from './renderParser'
import type { RenderReadyCardDocument } from './render.types'
import { resolveReferences } from './resolveCardBindings'
import type { ProjectInformation } from '../workspace/model/projectMetadata'

export type RenderPipelineResult = {
  document: RenderReadyCardDocument
  issues: CardPipelineIssue[]
}

export type RenderPipelineContext = {
  project?: Readonly<ProjectInformation> | null
}

export function runRenderPipeline(
  document: CardDocument,
  instance: CardInstanceRecord | null,
  context: RenderPipelineContext = {},
): RenderPipelineResult {
  const projected = applyInstance(document, instance)
  const resolved = resolveReferences(projected, {
    currentCard: instance,
    project: context.project,
  })
  const parsed = parseRenderDocument(resolved.document, {
    instanceId: instance?.id ?? null,
  })

  return {
    document: parsed.document,
    issues: [...resolved.issues, ...parsed.issues],
  }
}
