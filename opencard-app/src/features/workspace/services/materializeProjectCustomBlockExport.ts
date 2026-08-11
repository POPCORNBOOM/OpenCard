import type { CardBlock, CardDocument, CardFaceKey } from '../../../entities/card/model'
import { findCardBlockInDocument, visitCardBlockTree } from '../../../entities/card/tree'
import {
  resolveReferences,
  type ResolveReferencesOptions,
} from '../../card-rendering/resolveCardBindings'
import type { CardPipelineIssue } from '../../card-rendering/cardPipelineIssue'
import {
  expandCustomBlocks,
  type CustomBlockExpansionIssue,
  type CustomBlockRuntimeCatalog,
} from '../../card-rendering/expandCustomBlocks'

export type MaterializeProjectCustomBlockExportResult = {
  root: CardBlock
  faceKey: CardFaceKey
  issues: readonly CardPipelineIssue[]
  expansionIssues: readonly CustomBlockExpansionIssue[]
  resourceOwners: ReadonlyMap<string, string>
}

function collectSubtreeDepths(root: CardBlock): Map<string, number> {
  const depths = new Map<string, number>()
  visitCardBlockTree(root, (block, depth) => depths.set(block.id, depth))
  return depths
}

export function materializeProjectCustomBlockExport(options: {
  document: CardDocument
  rootBlockId: string
  environment?: Pick<ResolveReferencesOptions, 'project' | 'dictionary'>
  customBlockCatalog?: CustomBlockRuntimeCatalog
}): MaterializeProjectCustomBlockExportResult {
  const located = findCardBlockInDocument(options.document, options.rootBlockId)
  if (!located) throw new Error(`Custom block export root not found: ${options.rootBlockId}`)
  const sourceSubtreeIds = new Set(collectSubtreeDepths(located.block).keys())
  const expanded = expandCustomBlocks(options.document, options.customBlockCatalog)
  const expandedRoot = findCardBlockInDocument(expanded.document, options.rootBlockId)
  if (!expandedRoot) throw new Error(`Expanded custom block export root not found: ${options.rootBlockId}`)
  const subtreeDepths = collectSubtreeDepths(expandedRoot.block)
  const shouldResolveOwner: NonNullable<ResolveReferencesOptions['shouldResolveOwner']> = owner =>
    owner.anchorBlockId !== null && subtreeDepths.has(owner.anchorBlockId)
  const sharedOptions = {
    ...options.environment,
    shouldResolveOwner,
  }
  const validation = resolveReferences(expanded.document, sharedOptions)
  const materialized = resolveReferences(expanded.document, {
    ...sharedOptions,
    preserveReference: ({ owner, reference }) => {
      if (!owner.anchorBlockId) return false
      const depth = subtreeDepths.get(owner.anchorBlockId)
      if (depth === undefined) return false
      if (reference.kind === 'current-block') return true
      return reference.kind === 'parent' && reference.parentDepth <= depth
    },
  })
  const resolvedRoot = findCardBlockInDocument(materialized.document, options.rootBlockId)
  if (!resolvedRoot) throw new Error(`Materialized custom block export root not found: ${options.rootBlockId}`)
  return {
    root: resolvedRoot.block,
    faceKey: resolvedRoot.faceKey,
    issues: validation.issues,
    expansionIssues: expanded.issues.filter(issue => sourceSubtreeIds.has(issue.blockId)),
    resourceOwners: expanded.resourceOwners,
  }
}
