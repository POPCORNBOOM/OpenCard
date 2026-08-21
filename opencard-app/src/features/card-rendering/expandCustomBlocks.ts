import type { CardBlock, CardDocument, CardFaceKey } from '../../entities/card/model'
import { toRaw } from 'vue'
import type { ProjectCustomBlockResizePolicy } from '../workspace/model/projectCustomBlocks'
import type {
  ProjectResourceEnvironment,
  ProjectResourceScopeMap,
} from '../workspace/services/projectResourceEnvironment'
import { projectResourceScopeIdentity } from '../workspace/services/projectResourceEnvironment'
import { visitCardBlockTree } from '../../entities/card/tree'
import type { RenderReadyCardBlock, RenderReadyCardDocument, RenderReadyCustomBlock } from './render.types'

export type CustomBlockRuntimeEntry = {
  readonly manifest: {
    readonly packageId: string
    readonly publicFieldKeys: readonly string[]
    readonly resize: Readonly<ProjectCustomBlockResizePolicy>
  }
  readonly block: CardBlock
  readonly environment: ProjectResourceEnvironment
  readonly dependencies: CustomBlockRuntimeCatalog
  readonly hasResourceErrors?: boolean
}

export type CustomBlockRuntimeCatalog = ReadonlyMap<string, CustomBlockRuntimeEntry>

export type CustomBlockExpansionIssue = {
  blockId: string
  faceKey: CardFaceKey
  reason: 'missing' | 'cycle'
  packageId: string
}

export type CustomBlockExpansionHost = {
  packageId: string
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

function scopeStrings(
  block: CardBlock,
  environment: ProjectResourceEnvironment,
  scopes: Map<string, ProjectResourceEnvironment>,
): void {
  visitCardBlockTree(block, candidate => {
    for (const [fieldKey, value] of Object.entries(candidate)) {
      if (typeof value === 'string') {
        scopes.set(projectResourceScopeIdentity(candidate.id, fieldKey), environment)
      }
    }
  })
}

export function expandCustomBlocks(
  document: CardDocument,
  catalog: CustomBlockRuntimeCatalog | undefined,
  hostEnvironment?: ProjectResourceEnvironment,
  initialResourceScopes?: ProjectResourceScopeMap,
): {
  document: CardDocument
  issues: CustomBlockExpansionIssue[]
  hosts: ReadonlyMap<string, CustomBlockExpansionHost>
  resourceScopes: ProjectResourceScopeMap
} {
  const activeCatalog: CustomBlockRuntimeCatalog = catalog ?? new Map()
  const issues: CustomBlockExpansionIssue[] = []
  const hosts = new Map<string, CustomBlockExpansionHost>()
  const resourceScopes = new Map<string, ProjectResourceEnvironment>(initialResourceScopes)

  function expand(
    block: CardBlock,
    scopedCatalog: CustomBlockRuntimeCatalog,
    ancestors: Set<string>,
    faceKey: CardFaceKey,
    currentEnvironment: ProjectResourceEnvironment | undefined,
  ): CardBlock {
    if (block.type !== 'custom-block') {
      if (block.type === 'simple-container-block') {
        const children = block.children.map(child => ({
          ...child,
          block: expand(child.block, scopedCatalog, ancestors, faceKey, currentEnvironment),
        }))
        return children.some((child, index) => child.block !== block.children[index]!.block)
          ? { ...block, children }
          : block
      }
      if (block.type === 'flow-container-block') {
        const children = block.children.map(child => ({
          ...child,
          block: expand(child.block, scopedCatalog, ancestors, faceKey, currentEnvironment),
        }))
        return children.some((child, index) => child.block !== block.children[index]!.block)
          ? { ...block, children }
          : block
      }
      return block
    }

    const packageId = block.packageId
    const identity = packageId.toLocaleLowerCase()
    const referenceEnvironment = resourceScopes.get(projectResourceScopeIdentity(block.id, 'packageId'))
      ?? currentEnvironment
    const effectiveCatalog = referenceEnvironment?.customBlockCatalog ?? scopedCatalog
    const entry = effectiveCatalog.get(identity)
    if (!entry) {
      issues.push({ blockId: block.id, faceKey, reason: 'missing', packageId })
      return block
    }
    if (ancestors.has(identity)) {
      issues.push({ blockId: block.id, faceKey, reason: 'cycle', packageId })
      return block
    }

    hosts.set(block.id, {
      packageId,
      faceKey,
      hasResourceErrors: entry.hasResourceErrors === true || entry.environment.issues.length > 0,
    })
    const inheritedScopes = new Map<string, ProjectResourceEnvironment>()
    for (const fieldKey of [...entry.manifest.publicFieldKeys, 'width', 'height']) {
      const inherited = resourceScopes.get(projectResourceScopeIdentity(block.id, fieldKey))
        ?? currentEnvironment
        ?? hostEnvironment
      if (inherited) inheritedScopes.set(fieldKey, inherited)
    }
    const root = clone(entry.block) as CardBlock
    namespaceDescendantIds(root, block.id)
    scopeStrings(root, entry.environment, resourceScopes)

    for (const fieldKey of entry.manifest.publicFieldKeys) {
      if (!Object.prototype.hasOwnProperty.call(block, fieldKey)) continue
      ;(root as Record<string, unknown>)[fieldKey] = (block as Record<string, unknown>)[fieldKey]
      const inherited = inheritedScopes.get(fieldKey)
      if (inherited) resourceScopes.set(projectResourceScopeIdentity(root.id, fieldKey), inherited)
    }
    if (!entry.manifest.resize.widthLocked && block.width !== undefined) {
      root.width = block.width
      const inherited = inheritedScopes.get('width')
      if (inherited) resourceScopes.set(projectResourceScopeIdentity(root.id, 'width'), inherited)
    }
    if (!entry.manifest.resize.heightLocked && block.height !== undefined) {
      root.height = block.height
      const inherited = inheritedScopes.get('height')
      if (inherited) resourceScopes.set(projectResourceScopeIdentity(root.id, 'height'), inherited)
    }

    const nextAncestors = new Set(ancestors)
    nextAncestors.add(identity)
    return expand(root, entry.dependencies, nextAncestors, faceKey, entry.environment)
  }

  const faces = Object.fromEntries((Object.entries(document.faces) as [CardFaceKey, CardDocument['faces'][CardFaceKey]][])
    .map(([faceKey, face]) => [faceKey, {
      ...face,
      children: face.children.map(child => ({
        ...child,
        block: expand(child.block, activeCatalog, new Set(), faceKey, hostEnvironment),
      })),
    }])) as CardDocument['faces']

  return {
    document: { ...document, faces },
    issues,
    hosts,
    resourceScopes,
  }
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
      packageId: host.packageId,
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
