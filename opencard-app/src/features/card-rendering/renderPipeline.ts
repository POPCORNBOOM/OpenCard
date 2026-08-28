import { applyInstance } from '../../entities/card/instance'
import type { CardDocument, CardInstanceRecord } from '../../entities/card/model'
import type { ProjectInformation, ProjectRemoteResourcePolicy } from '../workspace/model/projectMetadata'
import type { ProjectIconCatalog } from '../workspace/services/projectIconCatalog'
import type { ProjectResourceEnvironment, ProjectResourceScopeMap } from '../workspace/services/projectResourceEnvironment'
import { createCardRenderResourceContext, type CardRenderResourceContext } from './cardRenderResources'
import type { CardPipelineIssue } from './cardPipelineIssue'
import { prepareRichText, type PreparedRichTextCatalog } from './prepareRichText'
import { parseRenderDocument } from './renderParser'
import type { RenderReadyCardDocument } from './render.types'
import { resolveReferences } from './resolveCardBindings'

export type RenderPipelineResult = {
  document: RenderReadyCardDocument
  issues: CardPipelineIssue[]
  richText?: PreparedRichTextCatalog
  resourceScopes?: ProjectResourceScopeMap
}

export type RenderPipelineContext = {
  project?: Readonly<ProjectInformation> | null
  dictionary?: Readonly<Record<string, string>> | null
  projectResourceEnvironment?: ProjectResourceEnvironment
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

export type PreparedCardRender = RenderPipelineResult & { resources: CardRenderResourceContext }

export function prepareCardRender(request: CardRenderRequest): PreparedCardRender {
  const projected = applyInstance(request.document, request.instance)
  const resolved = resolveReferences(projected, {
    currentCard: request.instance,
    project: request.environment.project,
    dictionary: request.environment.dictionary,
  })
  const resourceScopes: ProjectResourceScopeMap = new Map()
  const richText = prepareRichText({
    document: resolved.document,
    currentCard: request.instance,
    project: request.environment.project,
    dictionary: request.environment.dictionary,
    hostEnvironment: request.environment.projectResourceEnvironment,
    resourceScopes,
  })
  const parsed = parseRenderDocument(resolved.document, { instanceId: request.instance?.id ?? null })
  const result: RenderPipelineResult = {
    document: parsed.document,
    issues: [...resolved.issues, ...parsed.issues, ...richText.issues],
    richText: richText.catalog,
    resourceScopes,
  }
  return {
    ...result,
    resources: createCardRenderResourceContext({
      resourceRootPath: request.resourceRootPath,
      hostEnvironment: request.environment.projectResourceEnvironment,
      packageEnvironments: request.environment.projectResourceEnvironment?.packageEnvironments,
      remoteResourcePolicy: request.environment.remoteResourcePolicy,
      projectIconCatalog: request.environment.projectIconCatalog,
      resourceScopes,
      richText: richText.catalog,
      resolveFontFamily: request.environment.resolveFontFamily,
      bindingProject: request.environment.project,
      bindingDictionary: request.environment.dictionary,
    }),
  }
}
