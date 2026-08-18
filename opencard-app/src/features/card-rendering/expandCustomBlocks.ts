import type { CardBlock, CardDocument, CardFaceKey } from '../../entities/card/model'
import { toRaw } from 'vue'
import type {
  ProjectCustomBlockResizePolicy,
  ProjectCustomBlockResourceIndex,
} from '../workspace/model/projectCustomBlocks'
import type { ProjectIconCatalog } from '../workspace/services/projectIconCatalog'
import { visitCardBlockTree } from '../../entities/card/tree'
import type { RenderReadyCardBlock, RenderReadyCardDocument, RenderReadyCustomBlock } from './render.types'

export type CustomBlockRuntimeCatalog = ReadonlyMap<string, {
  readonly manifest: {
    readonly customBlockKey: string
    readonly publicFieldKeys: readonly string[]
    readonly resize: Readonly<ProjectCustomBlockResizePolicy>
    readonly resources?: ProjectCustomBlockResourceIndex
  }
  readonly block: unknown
  readonly files?: ReadonlyMap<string, Uint8Array>
  readonly resourceUrls?: ReadonlyMap<string, string>
  readonly iconCatalog?: ProjectIconCatalog
  readonly hasResourceErrors?: boolean
}>

export type CustomBlockExpansionIssue = { blockId: string; faceKey: CardFaceKey; reason: 'missing' | 'cycle'; customBlockKey: string }
export type CustomBlockExpansionHost = {
  customBlockKey: string
  faceKey: CardFaceKey
  hasResourceErrors: boolean
}

export function customBlockResourceOwnerIdentity(blockId: string, fieldKey: string): string {
  return `${blockId}\u0000${fieldKey}`
}

function clone<T>(value: T): T {
  const raw = value && typeof value === 'object' ? toRaw(value as object) : value
  try {
    return structuredClone(raw) as T
  } catch {
    return JSON.parse(JSON.stringify(raw)) as T
  }
}

function namespaceDescendantIds(block: CardBlock, instanceId: string, root = true): void {
  if (root) block.id = instanceId
  else block.id = `${instanceId}::block:${block.id}`
  if (block.type !== 'simple-container-block' && block.type !== 'flow-container-block') return
  for (const child of block.children) {
    child.location.id = `${instanceId}::location:${child.location.id}`
    namespaceDescendantIds(child.block, instanceId, false)
  }
}

export function expandCustomBlocks(
  document: CardDocument,
  catalog: CustomBlockRuntimeCatalog | undefined,
): {
  document: CardDocument
  issues: CustomBlockExpansionIssue[]
  hosts: ReadonlyMap<string, CustomBlockExpansionHost>
  resourceOwners: ReadonlyMap<string, string>
} {
  const activeCatalog: CustomBlockRuntimeCatalog = catalog ?? new Map()
  const issues: CustomBlockExpansionIssue[] = []
  const hosts = new Map<string, CustomBlockExpansionHost>()
  const resourceOwners = new Map<string, string>()

  function expand(block: CardBlock, ancestors: Set<string>, faceKey: CardFaceKey): CardBlock {
    if (block.type !== 'custom-block') {
      if (block.type === 'simple-container-block') {
        const children = block.children.map(child => ({ ...child, block: expand(child.block, ancestors, faceKey) }))
        return children.some((child, index) => child.block !== block.children[index].block)
          ? { ...block, children }
          : block
      }
      if (block.type === 'flow-container-block') {
        const children = block.children.map(child => ({ ...child, block: expand(child.block, ancestors, faceKey) }))
        return children.some((child, index) => child.block !== block.children[index].block)
          ? { ...block, children }
          : block
      }
      return block
    }
    const key = block.customBlockKey
    const entry = activeCatalog.get(key.toLowerCase())
    if (!entry) {
      issues.push({ blockId: block.id, faceKey, reason: 'missing', customBlockKey: key })
      return block
    }
    if (ancestors.has(key.toLowerCase())) {
      issues.push({ blockId: block.id, faceKey, reason: 'cycle', customBlockKey: key })
      return block
    }
    hosts.set(block.id, {
      customBlockKey: key,
      faceKey,
      hasResourceErrors: entry.hasResourceErrors === true,
    })
    const root = clone(entry.block) as CardBlock
    namespaceDescendantIds(root, block.id)
    visitCardBlockTree(root, candidate => {
      for (const [fieldKey, value] of Object.entries(candidate)) {
        if (typeof value === 'string') resourceOwners.set(customBlockResourceOwnerIdentity(candidate.id, fieldKey), key.toLowerCase())
      }
    })
    for (const fieldKey of entry.manifest.publicFieldKeys) {
      if (Object.prototype.hasOwnProperty.call(block, fieldKey)) {
        ;(root as Record<string, unknown>)[fieldKey] = (block as Record<string, unknown>)[fieldKey]
        resourceOwners.delete(customBlockResourceOwnerIdentity(root.id, fieldKey))
      }
    }
    if (!entry.manifest.resize.widthLocked && block.width !== undefined) root.width = block.width
    if (!entry.manifest.resize.heightLocked && block.height !== undefined) root.height = block.height
    const nextAncestors = new Set(ancestors)
    nextAncestors.add(key.toLowerCase())
    return expand(root, nextAncestors, faceKey)
  }

  const faces = Object.fromEntries((Object.entries(document.faces) as [CardFaceKey, CardDocument['faces'][CardFaceKey]][])
    .map(([faceKey, face]) => [faceKey, {
      ...face,
      children: face.children.map(child => ({ ...child, block: expand(child.block, new Set(), faceKey) })),
    }])) as CardDocument['faces']
  return { document: { ...document, faces }, issues, hosts, resourceOwners }
}

export function wrapExpandedCustomBlocks(
  document: RenderReadyCardDocument,
  hosts: ReadonlyMap<string, CustomBlockExpansionHost>,
): RenderReadyCardDocument {
  const wrap = (block: RenderReadyCardBlock): RenderReadyCardBlock => {
    let content = block
    if (block.type === 'simple-container-block') {
      content = {
        ...block,
        children: block.children.map(child => ({ ...child, block: wrap(child.block) })),
      }
    } else if (block.type === 'flow-container-block') {
      content = {
        ...block,
        children: block.children.map(child => ({ ...child, block: wrap(child.block) })),
      }
    }
    const host = hosts.get(block.id)
    if (!host) return content
    return {
      ...content,
      type: 'custom-block',
      customBlockKey: host.customBlockKey,
      content,
    } satisfies RenderReadyCustomBlock
  }
  return {
    ...document,
    faces: Object.fromEntries((Object.entries(document.faces) as [CardFaceKey, RenderReadyCardDocument['faces'][CardFaceKey]][])
      .map(([faceKey, face]) => [faceKey, {
        ...face,
        children: face.children.map(child => ({ ...child, block: wrap(child.block) })),
      }])) as RenderReadyCardDocument['faces'],
  }
}
