import type { CardFaceKey } from '../../entities/card/model'
import type { ProjectRemoteResourcePolicy } from '../workspace/model/projectMetadata'
import { isRemoteResourceAllowed } from '../editor-runtime/services/editorResource'
import { createCardPipelineIssue, type CardPipelineIssue } from './cardPipelineIssue'
import type { RenderReadyCardBlock, RenderReadyCardDocument } from './render.types'

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
  if (block.type === 'image-block' && isHttpsUrl(block.image)
    && !isRemoteResourceAllowed(block.image, policy)) {
    issues.push(createCardPipelineIssue({
      type: 'card-designer.resource.remote-blocked',
      location: {
        documentId,
        instanceId,
        faceKey,
        owner: { kind: 'block', id: block.id },
        blockId: block.id,
        ...(blockPath ? { blockPath } : {}),
        fieldKey: 'image',
      },
      parameters: { fieldName: 'image' },
      details: { url: block.image },
    }))
  }
  if (block.type === 'simple-container-block' || block.type === 'flow-container-block') {
    for (const child of block.children) {
      validateBlock(child.block, blockPath, documentId, instanceId, faceKey, policy, issues)
    }
  }
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
