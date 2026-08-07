import { applyInstance } from '../../entities/card/instance'
import type { CardDocument, CardInstanceRecord } from '../../entities/card/model'
import type { CardPipelineIssue } from './cardPipelineIssue'
import { parseRenderDocument } from './renderParser'
import type { RenderReadyCardDocument } from './render.types'
import { resolveReferences } from './resolveCardBindings'
import type { ProjectInformation } from '../workspace/model/projectMetadata'
import type { ProjectRemoteResourcePolicy } from '../workspace/model/projectMetadata'
import type { ProjectIconCatalog } from '../workspace/services/projectIconCatalog'
import { expandCustomBlocks, type CustomBlockRuntimeCatalog } from './expandCustomBlocks'
import { createCardPipelineIssue } from './cardPipelineIssue'

export type RenderPipelineResult = {
  document: RenderReadyCardDocument
  issues: CardPipelineIssue[]
}

export type RenderPipelineContext = {
  project?: Readonly<ProjectInformation> | null
  dictionary?: Readonly<Record<string, string>> | null
  customBlockCatalog?: CustomBlockRuntimeCatalog
}

export type CardRenderEnvironment = RenderPipelineContext & {
  remoteResourcePolicy?: ProjectRemoteResourcePolicy
  projectIconCatalog: ProjectIconCatalog
}

export function runRenderPipeline(
  document: CardDocument,
  instance: CardInstanceRecord | null,
  context: RenderPipelineContext = {},
): RenderPipelineResult {
  const projected = applyInstance(document, instance)
  const expanded = expandCustomBlocks(projected, context.customBlockCatalog)
  const resolved = resolveReferences(expanded.document, {
    currentCard: instance,
    project: context.project,
    dictionary: context.dictionary,
  })
  const parsed = parseRenderDocument(resolved.document, {
    instanceId: instance?.id ?? null,
  })

  return {
    document: parsed.document,
    issues: [
      ...expanded.issues.map(issue => createCardPipelineIssue({
        type: 'card-designer.render-parse.conversion-failed',
        location: {
          documentId: projected.id,
          instanceId: instance?.id ?? null,
          faceKey: issue.faceKey,
          owner: { kind: 'block', id: issue.blockId },
          blockId: issue.blockId,
          fieldKey: 'source',
        },
        parameters: { value: `${issue.reason}:${issue.source}` },
      })),
      ...resolved.issues,
      ...parsed.issues,
    ],
  }
}
