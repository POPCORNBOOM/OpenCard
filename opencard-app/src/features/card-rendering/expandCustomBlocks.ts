import type { CardBlock, CardDocument } from '../../entities/card/model'
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

export type CustomBlockExpansionIssue = { blockId: string; message: string }

function clone<T>(value: T): T {
  return structuredClone(value)
}

export function expandCustomBlocks(
  document: CardDocument,
  catalog: CustomBlockRuntimeCatalog | undefined,
): { document: CardDocument; issues: CustomBlockExpansionIssue[] } {
  if (!catalog || catalog.size === 0) return { document, issues: [] }
  const activeCatalog = catalog
  const next = clone(document)
  const issues: CustomBlockExpansionIssue[] = []

  function expand(block: CardBlock, ancestors: Set<string>): CardBlock {
    if (block.type !== 'custom-block') {
      if (block.type === 'simple-container-block') {
        block.children = block.children.map(child => ({ ...child, block: expand(child.block, ancestors) }))
      }
      if (block.type === 'flow-container-block') {
        block.children = block.children.map(child => ({ ...child, block: expand(child.block, ancestors) }))
      }
      return block
    }
    const key = block.source.startsWith('block:') ? block.source.slice(6) : ''
    const entry = activeCatalog.get(key.toLocaleLowerCase())
    if (!entry) {
      issues.push({ blockId: block.id, message: `Custom block package not found: ${key}` })
      return block
    }
    if (ancestors.has(key.toLocaleLowerCase())) {
      issues.push({ blockId: block.id, message: `Custom block cycle detected: ${key}` })
      return block
    }
    if (block.interfaceHash !== entry.manifest.interfaceHash) {
      issues.push({ blockId: block.id, message: `Custom block interface mismatch: ${key}` })
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
    return expand(root, nextAncestors)
  }

  for (const face of Object.values(next.faces)) {
    face.children = face.children.map(child => ({ ...child, block: expand(child.block, new Set()) }))
  }
  return { document: next, issues }
}
