import type { CardBlock, CardDocument, CardFaceKey } from '../../entities/card/model'
import { toRaw } from 'vue'
import type { ProjectCustomBlockPublicField, ProjectCustomBlockResizePolicy } from '../workspace/model/projectCustomBlocks'

export type CustomBlockRuntimeCatalog = ReadonlyMap<string, {
  readonly manifest: {
    readonly key: string
    readonly interfaceHash: string
    readonly root: unknown
    readonly publicFields: readonly ProjectCustomBlockPublicField[]
    readonly resize: Readonly<ProjectCustomBlockResizePolicy>
  }
  readonly files?: ReadonlyMap<string, Uint8Array>
}>

export type CustomBlockExpansionIssue = { blockId: string; faceKey: CardFaceKey; reason: 'missing' | 'cycle' | 'interface-mismatch'; source: string }

function clone<T>(value: T): T {
  const raw = value && typeof value === 'object' ? toRaw(value as object) : value
  try {
    return structuredClone(raw) as T
  } catch {
    return JSON.parse(JSON.stringify(raw)) as T
  }
}

function mimeForPath(path: string): string {
  if (/\.png$/i.test(path)) return 'image/png'
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg'
  if (/\.webp$/i.test(path)) return 'image/webp'
  if (/\.gif$/i.test(path)) return 'image/gif'
  return 'application/octet-stream'
}

function bytesToDataUrl(path: string, bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return `data:${mimeForPath(path)};base64,${btoa(binary)}`
}

function resolveBundledResources(block: CardBlock, packageKey: string, files?: ReadonlyMap<string, Uint8Array>): void {
  if (block.type === 'image-block' && block.image.startsWith(`ocblock:${packageKey}/`)) {
    const archivePath = block.image.slice(`ocblock:${packageKey}/`.length)
    const bytes = files?.get(archivePath)
    if (bytes) block.image = bytesToDataUrl(archivePath, bytes)
  }
  if (block.type !== 'simple-container-block' && block.type !== 'flow-container-block') return
  for (const child of block.children) resolveBundledResources(child.block, packageKey, files)
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
): { document: CardDocument; issues: CustomBlockExpansionIssue[] } {
  const activeCatalog: CustomBlockRuntimeCatalog = catalog ?? new Map()
  const issues: CustomBlockExpansionIssue[] = []

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
    resolveBundledResources(root, entry.manifest.key, entry.files)
    namespaceDescendantIds(root, block.id)
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

  const faces = Object.fromEntries((Object.entries(document.faces) as [CardFaceKey, CardDocument['faces'][CardFaceKey]][])
    .map(([faceKey, face]) => [faceKey, {
      ...face,
      children: face.children.map(child => ({ ...child, block: expand(child.block, new Set(), faceKey) })),
    }])) as CardDocument['faces']
  return { document: { ...document, faces }, issues }
}
