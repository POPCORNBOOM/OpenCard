import type { CardBlock, CardDocument, CardFaceKey } from '../../entities/card/model'
import { toRaw } from 'vue'
import { getProjectCustomBlockPublicFieldKeys, type ProjectCustomBlockSizeEditPolicy } from '../workspace/services/projectCustomBlockPublicFields'
import type {
  ProjectResourceEnvironment,
  ProjectResourceScopeMap,
} from '../workspace/services/projectResourceEnvironment'
import { projectResourceScopeIdentity } from '../workspace/services/projectResourceEnvironment'
import { visitCardBlockTree } from '../../entities/card/tree'
import type { RenderReadyCardBlock, RenderReadyCardDocument, RenderReadyCustomBlock } from './render.types'
import { resolveProjectCustomBlockSizeEditPolicy } from '../workspace/services/projectCustomBlockPublicFields'
import { projectCustomBlockDefinitionIdentity } from '../workspace/services/projectCustomBlockDefinition'

export type CustomBlockRuntimeEntry = {
  readonly manifest: {
    readonly packageId: string
    readonly publicFieldKeys: readonly string[]
  }
  readonly block: CardBlock
  readonly sizeEditPolicy?: ProjectCustomBlockSizeEditPolicy
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
  customBlockKey: string
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

    const customBlockKey = block.customBlockKey ?? ''
    const identity = customBlockKey.toLocaleLowerCase()
    const referenceEnvironment = resourceScopes.get(projectResourceScopeIdentity(block.id, 'customBlockKey'))
      ?? currentEnvironment
    const effectiveCatalog = referenceEnvironment?.customBlockCatalog ?? scopedCatalog
    const legacyCatalogIdentity = identity.includes('@block:')
      ? `${identity.slice(0, identity.indexOf('@block:'))}/${identity.slice(identity.indexOf('@block:') + '@block:'.length)}`
      : identity
    let entry = effectiveCatalog.get(identity) ?? effectiveCatalog.get(legacyCatalogIdentity)
    if (!entry) {
      const at = identity.indexOf('@block:')
      const packageKey = at > 0 ? identity.slice(0, at) : undefined
      const blockKey = at > 0 ? identity.slice(at + '@block:'.length) : identity.replace(/^block:/, '')
      const definitionEnvironment = packageKey
        ? referenceEnvironment?.packageEnvironments?.get(packageKey)
        : referenceEnvironment
      const definitionEntry = definitionEnvironment?.customBlockDefinitions?.get(blockKey)
      if (definitionEntry) {
        entry = {
          manifest: {
            packageId: projectCustomBlockDefinitionIdentity(definitionEntry.definition.key, packageKey),
            publicFieldKeys: definitionEntry.definition.publicFieldKeys,
          },
          block: definitionEntry.definition.root,
          sizeEditPolicy: resolveProjectCustomBlockSizeEditPolicy(definitionEntry.definition.root),
          environment: definitionEnvironment!,
          dependencies: new Map(),
        }
      }
    }
    if (!entry) {
      issues.push({ blockId: block.id, faceKey, reason: 'missing', packageId: customBlockKey })
      return block
    }
    if (ancestors.has(identity)) {
      issues.push({ blockId: block.id, faceKey, reason: 'cycle', packageId: customBlockKey })
      return block
    }

    hosts.set(block.id, {
      customBlockKey,
      faceKey,
      hasResourceErrors: entry.hasResourceErrors === true || entry.environment.issues.length > 0,
    })
    const publicFieldKeys = getProjectCustomBlockPublicFieldKeys({
      manifest: entry.manifest, block: entry.block,
    })
    const inheritedScopes = new Map<string, ProjectResourceEnvironment>()
    for (const fieldKey of publicFieldKeys) {
      const inherited = resourceScopes.get(projectResourceScopeIdentity(block.id, fieldKey))
        ?? currentEnvironment
        ?? hostEnvironment
      if (inherited) inheritedScopes.set(fieldKey, inherited)
    }
    const root = clone(entry.block) as CardBlock
    namespaceDescendantIds(root, block.id)
    scopeStrings(root, entry.environment, resourceScopes)
    for (const fieldKey of publicFieldKeys) {
      if (!Object.prototype.hasOwnProperty.call(block, fieldKey)) continue
      ;(root as Record<string, unknown>)[fieldKey] = (block as Record<string, unknown>)[fieldKey]
      const inherited = inheritedScopes.get(fieldKey)
      if (inherited) resourceScopes.set(projectResourceScopeIdentity(root.id, fieldKey), inherited)
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
