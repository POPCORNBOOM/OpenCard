import type { CardFaceKey } from '../../entities/card/model'
import type { ProjectRemoteResourcePolicy } from '../workspace/model/projectMetadata'
import { isRemoteResourceAllowed } from '../editor-runtime/services/editorResource'
import { createCardPipelineIssue, type CardPipelineIssue } from './cardPipelineIssue'
import type { RenderReadyCardBlock, RenderReadyCardDocument } from './render.types'

const PORTABLE_FONT_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong',
])

export function validateRenderResources(
  document: RenderReadyCardDocument,
  policy: ProjectRemoteResourcePolicy | undefined,
  instanceId: string | null,
): CardPipelineIssue[] {
  const issues: CardPipelineIssue[] = []
  for (const faceKey of ['front', 'back'] as const) {
    for (const child of document.faces[faceKey].children) {
      validateBlock(child.block, '', document.id, instanceId, faceKey, policy, issues)
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
  }
  if (block.type === 'simple-container-block' || block.type === 'flow-container-block') {
    for (const child of block.children) {
      validateBlock(child.block, blockPath, documentId, instanceId, faceKey, policy, issues)
    }
  }
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

function joinBlockPath(parentPath: string, blockName: string): string {
  if (!blockName) return parentPath
  return parentPath ? `${parentPath}.${blockName}` : blockName
}
