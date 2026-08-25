import type { CardBlock } from '../../../entities/card/model'
import { parseStoredCardBlock } from '../../../entities/card/storage'
import { visitCardBlockTree } from '../../../entities/card/tree'
import { normalizeKeySlug } from '../../../shared/model/keySlug'
import { parseProjectCustomBlockRegistryText } from '../model/projectCustomBlockRegistry'
import { PROJECT_CUSTOM_BLOCK_REGISTRY_FILE_NAME } from '../model/projectStructure'
import type { FileSystemService } from './fileSystemService'

export const PROJECT_CUSTOM_BLOCK_DEFINITION_TYPE = 'opencard-custom-block'
export const PROJECT_CUSTOM_BLOCK_DEFINITION_EXTENSION = 'ocblock'
export const PROJECT_CUSTOM_BLOCK_DEFINITION_SUFFIX = '.ocblock'
export const PROJECT_CUSTOM_BLOCK_DEFINITION_DIRECTORY = '.opencard/blocks'

export type ProjectCustomBlockDefinition = {
  type: typeof PROJECT_CUSTOM_BLOCK_DEFINITION_TYPE
  key: string
  name: string
  root: CardBlock
  publicFieldKeys: readonly string[]
  declaredResourceDependencies: readonly string[]
}

export type ProjectCustomBlockDefinitionIssue = {
  code: 'invalid-definition' | 'invalid-root' | 'duplicate-key'
  path: string
  message: string
}

export type ProjectCustomBlockDefinitionReadResult = {
  definition: ProjectCustomBlockDefinition | null
  issues: readonly ProjectCustomBlockDefinitionIssue[]
}

export type ProjectCustomBlockDefinitionCatalogEntry = {
  definition: ProjectCustomBlockDefinition
  path: string
  resourceRootPath: string
  issues?: readonly ProjectCustomBlockDefinitionIssue[]
  unavailable?: boolean
}

export type ProjectCustomBlockDefinitionIdentity = `block:${string}` | `${string}@block:${string}`

export type ResolvedProjectCustomBlockDefinition = {
  identity: ProjectCustomBlockDefinitionIdentity
  definition: ProjectCustomBlockDefinition
  path: string
  resourceRootPath: string
}

export function projectCustomBlockDefinitionIdentity(
  key: string,
  packageKey?: string,
): ProjectCustomBlockDefinitionIdentity {
  const normalizedKey = normalizeKeySlug(key) ?? key.trim().toLocaleLowerCase()
  const normalizedPackage = packageKey ? normalizeKeySlug(packageKey) : null
  return (normalizedPackage
    ? `${normalizedPackage}@block:${normalizedKey}`
    : `block:${normalizedKey}`) as ProjectCustomBlockDefinitionIdentity
}

export function resolveProjectCustomBlockDefinitionCatalog(
  catalog: ReadonlyMap<string, ProjectCustomBlockDefinitionCatalogEntry>,
  identity: string,
  packageKey?: string,
): ResolvedProjectCustomBlockDefinition | null {
  const normalizedIdentity = identity.trim().toLocaleLowerCase()
  const key = normalizedIdentity.startsWith('block:')
    ? normalizedIdentity.slice('block:'.length)
    : normalizedIdentity
  const entry = catalog.get(key) ?? null
  if (!entry || entry.unavailable) return null
  return {
    identity: projectCustomBlockDefinitionIdentity(entry.definition.key, packageKey),
    definition: entry.definition,
    path: entry.path,
    resourceRootPath: entry.resourceRootPath,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeKey(value: unknown, fallback: string): string | null {
  return normalizeKeySlug(typeof value === 'string' ? value : fallback)
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  const identities = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    const normalized = item.trim()
    const identity = normalized.toLocaleLowerCase()
    if (!normalized || identities.has(identity)) continue
    identities.add(identity)
    result.push(normalized)
  }
  return result
}

function normalizeDefinition(value: unknown, fallbackKey: string): ProjectCustomBlockDefinitionReadResult {
  const issues: ProjectCustomBlockDefinitionIssue[] = []
  if (!isRecord(value) || value.type !== PROJECT_CUSTOM_BLOCK_DEFINITION_TYPE) {
    return {
      definition: null,
      issues: [{ code: 'invalid-definition', path: 'type', message: 'Custom block definition type is invalid' }],
    }
  }

  const key = normalizeKey(value.key, fallbackKey)
  if (!key) {
    return {
      definition: null,
      issues: [{ code: 'invalid-definition', path: 'key', message: 'Custom block Key is invalid' }],
    }
  }

  const root = parseStoredCardBlock(value.root)
  if (!root || root.type === 'custom-block') {
    return {
      definition: null,
      issues: [...issues, { code: 'invalid-root', path: 'root', message: 'Custom block root is unavailable' }],
    }
  }

  const ids = new Set<string>()
  let generatedId = 0
  visitCardBlockTree(root, (block, _depth, location) => {
    if (!block.id.trim() || ids.has(block.id)) block.id = `custom-block-${++generatedId}`
    ids.add(block.id)
    if (location) {
      if (!location.id.trim() || ids.has(location.id)) location.id = `custom-location-${++generatedId}`
      ids.add(location.id)
    }
  })

  const publicFieldKeys = normalizeStringList(value.publicFieldKeys)
  for (const key of ['name', 'notes']) {
    if (!publicFieldKeys.some(candidate => candidate.toLocaleLowerCase() === key)) publicFieldKeys.unshift(key)
  }
  return {
    definition: {
      type: PROJECT_CUSTOM_BLOCK_DEFINITION_TYPE,
      key,
      name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : key,
      root,
      publicFieldKeys,
      declaredResourceDependencies: normalizeStringList(value.declaredResourceDependencies),
    },
    issues,
  }
}

function definitionKeyFromPath(path: string): string {
  const fileName = path.replace(/\\/g, '/').split('/').pop() ?? 'custom-block'
  return fileName.replace(/\.ocblock$/i, '')
}

export function parseProjectCustomBlockDefinitionText(
  content: string,
  fallbackKey: string,
 ): ProjectCustomBlockDefinitionReadResult {
  try {
    return normalizeDefinition(JSON.parse(content), fallbackKey)
  } catch (cause) {
    return {
      definition: null,
      issues: [{
        code: 'invalid-definition',
        path: 'json',
        message: cause instanceof Error ? cause.message : 'Custom block definition JSON is unreadable',
      }],
    }
  }
}

export async function readProjectCustomBlockDefinition(
  fs: Pick<FileSystemService, 'readFile'>,
  path: string,
): Promise<ProjectCustomBlockDefinitionReadResult> {
  try {
    return normalizeDefinition(await fs.readFile(path).then(JSON.parse), definitionKeyFromPath(path))
  } catch (cause) {
    return {
      definition: null,
      issues: [{
        code: 'invalid-definition',
        path,
        message: cause instanceof Error ? cause.message : 'Custom block definition JSON is unreadable',
      }],
    }
  }
}

export function serializeProjectCustomBlockDefinition(definition: ProjectCustomBlockDefinition): string {
  return `${JSON.stringify(definition, null, 2)}\n`
}

export async function writeProjectCustomBlockDefinition(
  fs: Pick<FileSystemService, 'createDirectory' | 'writeFile'>,
  projectRootPath: string,
  definition: ProjectCustomBlockDefinition,
): Promise<string> {
  const key = normalizeKeySlug(definition.key)
  if (!key) throw new Error('Invalid custom block Key')
  const root = projectRootPath.replace(/[\\/]+$/, '')
  const directory = `${root}/${PROJECT_CUSTOM_BLOCK_DEFINITION_DIRECTORY}`
  const path = `${directory}/${key}${PROJECT_CUSTOM_BLOCK_DEFINITION_SUFFIX}`
  await fs.createDirectory(directory)
  await fs.writeFile(path, serializeProjectCustomBlockDefinition({ ...definition, key }))
  return path
}

export async function discoverProjectCustomBlockDefinitions(
  fs: Pick<FileSystemService, 'readDirectoryEntries' | 'readFile'>,
  projectRootPath: string,
): Promise<Map<string, ProjectCustomBlockDefinitionCatalogEntry>> {
  const root = projectRootPath.replace(/[\\/]+$/, '')
  const blocksRoot = `${root}/${PROJECT_CUSTOM_BLOCK_DEFINITION_DIRECTORY}`
  let registry: ReturnType<typeof parseProjectCustomBlockRegistryText> = null
  try {
    registry = parseProjectCustomBlockRegistryText(await fs.readFile(`${root}/${PROJECT_CUSTOM_BLOCK_REGISTRY_FILE_NAME}`))
  } catch {
    registry = null
  }
  const registeredNames = new Map((registry?.blocks ?? []).map(entry => [
    entry.key.toLocaleLowerCase(), entry.name,
  ]))
  const entries = await fs.readDirectoryEntries(blocksRoot, 1)
  const files = entries.filter(entry => entry.isFile && !entry.isSymlink
    && entry.name.toLocaleLowerCase().endsWith(PROJECT_CUSTOM_BLOCK_DEFINITION_SUFFIX))
  const catalog = new Map<string, ProjectCustomBlockDefinitionCatalogEntry>()
  for (const entry of files) {
    const path = `${blocksRoot}/${entry.name.replace(/\\/g, '/')}`
    const result = await readProjectCustomBlockDefinition(fs, path)
    if (!result.definition) continue
    const identity = result.definition.key.toLocaleLowerCase()
    if (catalog.has(identity)) {
      const previous = catalog.get(identity)!
      catalog.set(identity, {
        ...previous,
        issues: [...(previous.issues ?? []), {
          code: 'duplicate-key',
          path,
          message: `Duplicate custom block Key: ${result.definition.key}`,
        }],
      })
      continue
    }
    catalog.set(identity, {
      definition: { ...result.definition, name: registeredNames.get(identity) ?? result.definition.name },
      path,
      resourceRootPath: root,
      ...(result.issues.length > 0 ? { issues: result.issues } : {}),
    })
  }
  return catalog
}
