import type { CardBlock, CardDocument, CardFaceKey } from '../../../entities/card/model'
import { isBlockContainer } from '../../../entities/card/tree'
import {
  resolveReferences,
  type ResolveReferencesOptions,
} from '../../card-rendering/resolveCardBindings'
import type { CardPipelineIssue } from '../../card-rendering/cardPipelineIssue'

export type MaterializeProjectCustomBlockExportResult = {
  root: CardBlock
  faceKey: CardFaceKey
  issues: readonly CardPipelineIssue[]
}

type LocatedRoot = {
  block: CardBlock
  faceKey: CardFaceKey
}

function locateBlock(document: CardDocument, blockId: string): LocatedRoot | null {
  const visit = (block: CardBlock, faceKey: CardFaceKey): LocatedRoot | null => {
    if (block.id === blockId) return { block, faceKey }
    if (!isBlockContainer(block)) return null
    for (const child of block.children) {
      const found = visit(child.block, faceKey)
      if (found) return found
    }
    return null
  }

  for (const [faceKey, face] of Object.entries(document.faces) as [CardFaceKey, CardDocument['faces'][CardFaceKey]][]) {
    for (const child of face.children) {
      const found = visit(child.block, faceKey)
      if (found) return found
    }
  }
  return null
}

function collectSubtreeDepths(root: CardBlock): Map<string, number> {
  const depths = new Map<string, number>()
  const visit = (block: CardBlock, depth: number): void => {
    depths.set(block.id, depth)
    if (!isBlockContainer(block)) return
    for (const child of block.children) visit(child.block, depth + 1)
  }
  visit(root, 0)
  return depths
}

export function materializeProjectCustomBlockExport(options: {
  document: CardDocument
  rootBlockId: string
  environment?: Pick<ResolveReferencesOptions, 'project' | 'dictionary'>
}): MaterializeProjectCustomBlockExportResult {
  const located = locateBlock(options.document, options.rootBlockId)
  if (!located) throw new Error(`Custom block export root not found: ${options.rootBlockId}`)
  const subtreeDepths = collectSubtreeDepths(located.block)
  const shouldResolveOwner: NonNullable<ResolveReferencesOptions['shouldResolveOwner']> = owner =>
    owner.anchorBlockId !== null && subtreeDepths.has(owner.anchorBlockId)
  const sharedOptions = {
    ...options.environment,
    shouldResolveOwner,
  }
  const validation = resolveReferences(options.document, sharedOptions)
  const materialized = resolveReferences(options.document, {
    ...sharedOptions,
    preserveReference: ({ owner, reference }) => {
      if (!owner.anchorBlockId) return false
      const depth = subtreeDepths.get(owner.anchorBlockId)
      if (depth === undefined) return false
      if (reference.kind === 'current-block') return true
      return reference.kind === 'parent' && reference.parentDepth <= depth
    },
  })
  const resolvedRoot = locateBlock(materialized.document, options.rootBlockId)
  if (!resolvedRoot) throw new Error(`Materialized custom block export root not found: ${options.rootBlockId}`)
  return {
    root: resolvedRoot.block,
    faceKey: resolvedRoot.faceKey,
    issues: validation.issues,
  }
}
