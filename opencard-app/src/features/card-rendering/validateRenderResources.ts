import type { CardFaceKey } from '../../entities/card/model'
import { normalizeKeySlug } from '../../shared/model/keySlug'
import type { ProjectRemoteResourcePolicy } from '../workspace/model/projectMetadata'
import { isRemoteResourceAllowed } from '../editor-runtime/services/editorResource'
import {
  parseResourceReference,
  parseResourceReferenceList,
  resolveResourceReferenceText,
  type ResourceReferenceDiagnostic,
} from '../workspace/services/resourceReference'
import { resolveCardResourceEnvironment, type CardRenderResourceContext } from './cardRenderResources'
import { createCardPipelineIssue, type CardPipelineIssue } from './cardPipelineIssue'
import { joinBlockPath } from './renderBlockPath'
import type { RenderReadyCardBlock, RenderReadyCardDocument } from './render.types'

type PackageResourceIssueType = 'card-designer.resource.package-missing' | 'card-designer.resource.file-missing'

const PORTABLE_FONT_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong',
])

export function validateRenderResources(
  document: RenderReadyCardDocument,
  policy: ProjectRemoteResourcePolicy | undefined,
  instanceId: string | null,
  resources?: CardRenderResourceContext,
): CardPipelineIssue[] {
  const issues: CardPipelineIssue[] = []
  for (const faceKey of ['front', 'back'] as const) {
    for (const child of document.faces[faceKey].children) {
      validateBlock(child.block, '', document.id, instanceId, faceKey, policy, resources, issues)
    }
  }
  return issues
}

function validateBlock(
  block: RenderReadyCardBlock,
  parentPath: string,
  documentId: string,
  instanceId: string | null,
  faceKey: CardFaceKey,
  policy: ProjectRemoteResourcePolicy | undefined,
  resources: CardRenderResourceContext | undefined,
  issues: CardPipelineIssue[],
): void {
  const blockPath = joinBlockPath(parentPath, block.name)
  if (block.type === 'image-block' && isHttpsUrl(block.source)
    && !isRemoteResourceAllowed(block.source, policy)) {
    issues.push(createCardPipelineIssue({
      type: 'card-designer.resource.remote-blocked',
      location: {
        documentId,
        instanceId,
        faceKey,
        owner: { kind: 'block', id: block.id },
        blockId: block.id,
        ...(blockPath ? { blockPath } : {}),
        fieldKey: 'source',
      },
      parameters: { fieldName: 'source' },
      details: { url: block.source },
    }))
  }
  if (resources && block.type === 'image-block') {
    const diagnostic = resolvePackageReferenceDiagnostic(block.source, resources, block.id, 'source')
    if (diagnostic) {
      pushPackageResourceIssue(
        diagnostic.code === 'resource-unavailable'
          ? 'card-designer.resource.file-missing'
          : 'card-designer.resource.package-missing',
        diagnostic.reference,
        diagnostic,
        {
          documentId, instanceId, faceKey, blockId: block.id, blockPath,
          fieldKey: 'source', issues,
        },
      )
    }
    validatePackageAssetReference(block.source, resources, block.id, 'source', {
      documentId, instanceId, faceKey, blockPath, issues,
    })
  }
  if (block.type === 'text-block' || block.type === 'markdown-text-block') {
    for (const fontName of systemFontFamilies(block.fontFamily)) {
      issues.push(createCardPipelineIssue({
        type: 'card-designer.resource.system-font',
        location: {
          documentId,
          instanceId,
          faceKey,
          owner: { kind: 'block', id: block.id },
          blockId: block.id,
          ...(blockPath ? { blockPath } : {}),
          fieldKey: 'fontFamily',
        },
        parameters: { fieldName: 'fontFamily', fontName },
        token: fontName.toLocaleLowerCase(),
        details: { fontName },
      }))
    }
    if (resources) {
      for (const token of parseResourceReferenceList(block.fontFamily, 'font')) {
        const diagnostic = resolvePackageReferenceDiagnostic(token.source, resources, block.id, 'fontFamily')
        if (diagnostic) {
          pushPackageResourceIssue(
            diagnostic.code === 'resource-unavailable'
              ? 'card-designer.resource.file-missing'
              : 'card-designer.resource.package-missing',
            diagnostic.reference,
            diagnostic,
            {
              documentId, instanceId, faceKey, blockId: block.id, blockPath,
              fieldKey: 'fontFamily', issues,
            },
          )
        }
      }
    }
  }
  if (block.type === 'simple-container-block' || block.type === 'flow-container-block') {
    for (const child of block.children) {
      validateBlock(child.block, blockPath, documentId, instanceId, faceKey, policy, resources, issues)
    }
  }
}

function resolvePackageReferenceDiagnostic(
  source: string,
  resources: CardRenderResourceContext,
  blockId: string,
  fieldKey: string,
): ResourceReferenceDiagnostic | null {
  const parsed = parseResourceReference(source)
  if (parsed.reference?.scope !== 'package') return null
  const environment = resolveCardResourceEnvironment(resources, blockId, fieldKey)
  const resolved = resolveResourceReferenceText(source, {
    environment,
    hostEnvironment: resources.hostEnvironment,
    packageEnvironments: resources.packageEnvironments,
  })
  return resolved.diagnostics.find(diagnostic => (
    diagnostic.code === 'package-unavailable'
    || diagnostic.code === 'scope-unavailable'
    || diagnostic.code === 'resource-unavailable'
  )) ?? null
}

function validatePackageAssetReference(
  source: string,
  resources: CardRenderResourceContext,
  blockId: string,
  fieldKey: string,
  context: {
    documentId: string
    instanceId: string | null
    faceKey: CardFaceKey
    blockPath: string
    issues: CardPipelineIssue[]
  },
): void {
  const value = source.trim()
  const at = value.indexOf('@')
  if (at <= 0 || at !== value.lastIndexOf('@')) return
  // A resource reference is validated as a reference; only literal package asset paths reach the checks below.
  if (parseResourceReference(value).reference) return
  const packageKey = normalizeKeySlug(value.slice(0, at))
  if (!packageKey) return
  const environment = resolveCardResourceEnvironment(resources, blockId, fieldKey)
  const pkg = environment.packages?.get(packageKey.toLocaleLowerCase())
  const packageEnvironment = resources.packageEnvironments.get(packageKey.toLocaleLowerCase())
    ?? environment.packageEnvironments?.get(packageKey.toLocaleLowerCase())
  if (pkg && !pkg.unavailable && packageEnvironment) return
  const reason = !pkg
    ? 'Referenced package is not visible from the current environment'
    : pkg.unavailable
      ? 'Referenced package is unavailable'
      : 'Referenced package environment is not loaded'
  pushPackageResourceIssue('card-designer.resource.package-missing', value, {
    code: 'package-unavailable',
    reference: value,
    message: reason,
  }, {
    ...context,
    blockId,
    fieldKey,
  })
}

function pushPackageResourceIssue(
  type: PackageResourceIssueType,
  reference: string,
  diagnostic: ResourceReferenceDiagnostic,
  context: {
    documentId: string
    instanceId: string | null
    faceKey: CardFaceKey
    blockId: string
    blockPath: string
    fieldKey: string
    issues: CardPipelineIssue[]
  },
): void {
  context.issues.push(createCardPipelineIssue({
    type,
    location: {
      documentId: context.documentId,
      instanceId: context.instanceId,
      faceKey: context.faceKey,
      owner: { kind: 'block', id: context.blockId },
      blockId: context.blockId,
      ...(context.blockPath ? { blockPath: context.blockPath } : {}),
      fieldKey: context.fieldKey,
    },
    parameters: {
      fieldName: context.fieldKey,
      reference,
      ...(type === 'card-designer.resource.package-missing'
        ? { packageKey: reference.slice(0, reference.indexOf('@')) }
        : {}),
    },
    token: reference,
    details: { code: diagnostic.code, message: diagnostic.message, reference },
  }))
}

function systemFontFamilies(value: string): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const candidate of value.split(';')) {
    const name = candidate.trim().replace(/^(?:"([^"]*)"|'([^']*)')$/, '$1$2')
    const identity = name.toLocaleLowerCase()
    if (!name || identity.includes('font:') || PORTABLE_FONT_FAMILIES.has(identity) || seen.has(identity)) continue
    seen.add(identity)
    names.push(name)
  }
  return names
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}
