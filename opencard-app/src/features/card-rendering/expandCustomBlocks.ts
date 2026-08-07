import type { CardBlock, CardDocument, CardFaceKey } from '../../entities/card/model'
import type { ProjectCustomBlockPublicField, ProjectCustomBlockResizePolicy } from '../workspace/model/projectCustomBlocks'

export type CustomBlockRuntimeCatalog = ReadonlyMap<string, {
  readonly manifest: {
    readonly key: string
    readonly interfaceHash: string
    readonly root: unknown
    readonly publicFields: readonly ProjectCustomBlockPublicField[]
    readonly resize: Readonly<ProjectCustomBlockResizePolicy>
  }
}>

export type CustomBlockExpansionIssue = { blockId: string; faceKey: CardFaceKey; reason: 'missing' | 'cycle' | 'interface-mismatch'; source: string }

function clone<T>(value: T): T {
  return structuredClone(value)
}

export function expandCustomBlocks(
  document: CardDocument,
  catalog: CustomBlockRuntimeCatalog | undefined,
): { document: CardDocument; issues: CustomBlockExpansionIssue[] } {
  const activeCatalog: CustomBlockRuntimeCatalog = catalog ?? new Map()
  const next = clone(document)
  const issues: CustomBlockExpansionIssue[] = []

  function expand(block: CardBlock, ancestors: Set<string>, faceKey: CardFaceKey): CardBlock {
    if (block.type !== 'custom-block') {
      if (block.type === 'simple-container-block') {
        block.children = block.children.map(child => ({ ...child, block: expand(child.block, ancestors, faceKey) }))
      }
      if (block.type === 'flow-container-block') {
        block.children = block.children.map(child => ({ ...child, block: expand(child.block, ancestors, faceKey) }))
      }
      return block
    }
    const key = block.source.startsWith('block:') ? block.source.slice(6) : ''
    const entry = activeCatalog.get(key.toLocaleLowerCase())
    if (!entry) {
      issues.push({ blockId: block.id, faceKey, reason: 'missing', source: block.source })
      return block
    }
    if (ancestors.has(key.toLocaleLowerCase())) {
      issues.push({ blockId: block.id, faceKey, reason: 'cycle', source: block.source })
      return block
    }
    if (block.interfaceHash !== entry.manifest.interfaceHash) {
      issues.push({ blockId: block.id, faceKey, reason: 'interface-mismatch', source: block.source })
      return block
    }
    const root = clone(entry.manifest.root) as CardBlock
    root.id = block.id
    root.name = block.name
    root.notes = block.notes
    for (const field of entry.manifest.publicFields) {
      if (Object.prototype.hasOwnProperty.call(block, field.key)) {
        ;(root as Record<string, unknown>)[field.key] = (block as Record<string, unknown>)[field.key]
      } else if (field.defaultValue !== undefined) {
        ;(root as Record<string, unknown>)[field.key] = field.defaultValue
      }
    }
    if (!entry.manifest.resize.widthLocked && block.width !== undefined) root.width = block.width
    if (!entry.manifest.resize.heightLocked && block.height !== undefined) root.height = block.height
    const nextAncestors = new Set(ancestors)
    nextAncestors.add(key.toLocaleLowerCase())
    return expand(root, nextAncestors, faceKey)
  }

  for (const [faceKey, face] of Object.entries(next.faces) as [CardFaceKey, CardDocument['faces'][CardFaceKey]][]) {
    face.children = face.children.map(child => ({ ...child, block: expand(child.block, new Set(), faceKey) }))
  }
  return { document: next, issues }
}
