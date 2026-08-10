import type { CardBlock, CardDocument, CardFaceKey } from '../../entities/card/model'
import { toRaw } from 'vue'
import type { ProjectCustomBlockPublicField, ProjectCustomBlockResizePolicy } from '../workspace/model/projectCustomBlocks'
import type { RenderReadyCardBlock, RenderReadyCardDocument, RenderReadyCustomBlock } from './render.types'

export type CustomBlockRuntimeCatalog = ReadonlyMap<string, {
  readonly manifest: {
    readonly key: string
    readonly interfaceHash: string
    readonly root: unknown
    readonly publicFields: readonly ProjectCustomBlockPublicField[]
    readonly resize: Readonly<ProjectCustomBlockResizePolicy>
  }
  readonly files?: ReadonlyMap<string, Uint8Array>
  readonly resourceUrls?: ReadonlyMap<string, string>
  readonly hasResourceErrors?: boolean
}>

export type CustomBlockExpansionIssue = { blockId: string; faceKey: CardFaceKey; reason: 'missing' | 'cycle' | 'interface-mismatch'; source: string }
export type CustomBlockExpansionHost = {
  source: string
  interfaceHash: string
  faceKey: CardFaceKey
  hasResourceErrors: boolean
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
): { document: CardDocument; issues: CustomBlockExpansionIssue[]; hosts: ReadonlyMap<string, CustomBlockExpansionHost> } {
  const activeCatalog: CustomBlockRuntimeCatalog = catalog ?? new Map()
  const issues: CustomBlockExpansionIssue[] = []
  const hosts = new Map<string, CustomBlockExpansionHost>()

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
    const key = block.source.startsWith('block:') ? block.source.slice(6) : ''
    const entry = activeCatalog.get(key.toLowerCase())
    if (!entry) {
      issues.push({ blockId: block.id, faceKey, reason: 'missing', source: block.source })
      return block
    }
    if (ancestors.has(key.toLowerCase())) {
      issues.push({ blockId: block.id, faceKey, reason: 'cycle', source: block.source })
      return block
    }
    if (block.interfaceHash !== entry.manifest.interfaceHash) {
      issues.push({ blockId: block.id, faceKey, reason: 'interface-mismatch', source: block.source })
      return block
    }
    hosts.set(block.id, {
      source: block.source,
      interfaceHash: block.interfaceHash,
      faceKey,
      hasResourceErrors: entry.hasResourceErrors === true,
    })
    const root = clone(entry.manifest.root) as CardBlock
    namespaceDescendantIds(root, block.id)
    if (block.name !== undefined) root.name = block.name
    if (block.notes !== undefined) root.notes = block.notes
    if (block.visible !== undefined) root.visible = block.visible
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
    nextAncestors.add(key.toLowerCase())
    return expand(root, nextAncestors, faceKey)
  }

  const faces = Object.fromEntries((Object.entries(document.faces) as [CardFaceKey, CardDocument['faces'][CardFaceKey]][])
    .map(([faceKey, face]) => [faceKey, {
      ...face,
      children: face.children.map(child => ({ ...child, block: expand(child.block, new Set(), faceKey) })),
    }])) as CardDocument['faces']
  return { document: { ...document, faces }, issues, hosts }
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
      source: host.source,
      interfaceHash: host.interfaceHash,
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
