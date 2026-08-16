import { applyInstance } from '../../entities/card/instance'
import type { CardDocument, CardInstanceRecord } from '../../entities/card/model'
import type { CardPipelineIssue } from './cardPipelineIssue'
import { parseRenderDocument } from './renderParser'
import type { RenderReadyCardDocument } from './render.types'
import { resolveReferences } from './resolveCardBindings'
import type { ProjectInformation } from '../workspace/model/projectMetadata'
import type { ProjectRemoteResourcePolicy } from '../workspace/model/projectMetadata'
import type { ProjectIconCatalog } from '../workspace/services/projectIconCatalog'
import { expandCustomBlocks, wrapExpandedCustomBlocks, type CustomBlockRuntimeCatalog } from './expandCustomBlocks'
import { createCardPipelineIssue } from './cardPipelineIssue'
import {
  createCardRenderResourceContext,
  type CardRenderResourceContext,
} from './cardRenderResources'
import { prepareRichText, type PreparedRichTextCatalog } from './prepareRichText'

function findCustomBlockHostId(
  issue: CardPipelineIssue,
  hosts: ReadonlyMap<string, unknown>,
): string | null {
  const candidateIds = [issue.location.blockId, issue.location.owner.id].filter(
    (value): value is string => Boolean(value),
  )
  for (const id of candidateIds) {
    if (hosts.has(id)) return id
    const separator = id.indexOf('::')
    if (separator > 0) {
      const hostId = id.slice(0, separator)
      if (hosts.has(hostId)) return hostId
    }
  }
  return null
}

export type RenderPipelineResult = {
  document: RenderReadyCardDocument
  issues: CardPipelineIssue[]
  richText?: PreparedRichTextCatalog
}

export type RenderPipelineContext = {
  project?: Readonly<ProjectInformation> | null
  dictionary?: Readonly<Record<string, string>> | null
  customBlockCatalog?: CustomBlockRuntimeCatalog
}

export type CardRenderEnvironment = RenderPipelineContext & {
  remoteResourcePolicy?: ProjectRemoteResourcePolicy
  projectIconCatalog: ProjectIconCatalog
  resolveFontFamily?: (references: string) => string
}

export type CardRenderRequest = {
  document: CardDocument
  instance: CardInstanceRecord | null
  resourceRootPath: string | null
  environment: Readonly<CardRenderEnvironment>
}

export type PreparedCardRender = RenderPipelineResult & {
  resources: CardRenderResourceContext
}

export function prepareCardRender(request: CardRenderRequest): PreparedCardRender {
  const result = runRenderPipeline(request.document, request.instance, request.environment)
  return {
    ...result,
    resources: createCardRenderResourceContext({
      resourceRootPath: request.resourceRootPath,
      remoteResourcePolicy: request.environment.remoteResourcePolicy,
      customBlockCatalog: request.environment.customBlockCatalog,
      projectIconCatalog: request.environment.projectIconCatalog,
      resolveFontFamily: request.environment.resolveFontFamily,
      richText: result.richText,
    }),
  }
}

function runRenderPipeline(
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
  const richText = prepareRichText({
    document: resolved.document,
    currentCard: instance,
    project: context.project,
    dictionary: context.dictionary,
    customBlockCatalog: context.customBlockCatalog,
  })
  const parsed = parseRenderDocument(resolved.document, {
    instanceId: instance?.id ?? null,
  })

  const expansionIssues = expanded.issues.map(issue => createCardPipelineIssue({
    type: 'card-designer.custom-block.unavailable',
    location: {
      documentId: projected.id,
      instanceId: instance?.id ?? null,
      faceKey: issue.faceKey,
      owner: { kind: 'block', id: issue.blockId },
      blockId: issue.blockId,
      fieldKey: 'source',
    },
  }))
  const unavailableHosts = new Map(expanded.issues.map(issue => [issue.blockId, true]))
  const visibleIssues: CardPipelineIssue[] = []
  const internalHosts = new Map<string, CardPipelineIssue>()
  for (const issue of [...resolved.issues, ...parsed.issues, ...richText.issues]) {
    if (findCustomBlockHostId(issue, unavailableHosts)) continue
    const hostId = findCustomBlockHostId(issue, expanded.hosts)
    if (!hostId) {
      visibleIssues.push(issue)
      continue
    }
    const key = `${issue.location.faceKey ?? ''}\u0000${hostId}`
    if (internalHosts.has(key)) continue
    internalHosts.set(key, createCardPipelineIssue({
      type: 'card-designer.custom-block.content-error',
      location: {
        documentId: projected.id,
        instanceId: instance?.id ?? null,
        faceKey: issue.location.faceKey,
        owner: { kind: 'block', id: hostId },
        blockId: hostId,
        fieldKey: 'content',
      },
    }))
  }

  const pipelineIssues = [
    ...expansionIssues,
    ...visibleIssues,
    ...internalHosts.values(),
    ...[...expanded.hosts.entries()].flatMap(([hostId, host]) => host.hasResourceErrors
      ? [createCardPipelineIssue({
        type: 'card-designer.custom-block.resource-error',
        location: {
          documentId: projected.id,
          instanceId: instance?.id ?? null,
          faceKey: host.faceKey,
          owner: { kind: 'block', id: hostId },
          blockId: hostId,
          fieldKey: 'source',
        },
      })]
      : []),
  ]

  return {
    document: wrapExpandedCustomBlocks(parsed.document, expanded.hosts),
    issues: pipelineIssues,
    richText: richText.catalog,
  }
}
