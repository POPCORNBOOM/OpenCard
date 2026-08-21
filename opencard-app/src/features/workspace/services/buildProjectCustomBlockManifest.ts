import type { CardBlock } from '../../../entities/card/model'
import { visitCardBlockTree } from '../../../entities/card/tree'
import { parseAdditionalFieldDefinitions } from '../../../entities/card/schema'
import {
  createProjectCustomBlockPackageId,
  normalizeProjectCustomBlockVersion,
  PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS,
  PROJECT_CUSTOM_BLOCK_DEFAULT_VERSION,
  type ProjectCustomBlockManifest,
  type ProjectCustomBlockResizePolicy,
} from '../model/projectCustomBlocks'
import { analyzeProjectCustomBlockExport } from './projectCustomBlockExportAnalyzer'

export function buildProjectCustomBlockRoot(root: CardBlock): CardBlock {
  const cloned = structuredClone(root)
  visitCardBlockTree(cloned, block => {
    const rawDefinitions = block.additionalFieldDefinition
    if (rawDefinitions !== undefined) {
      const definitions = parseAdditionalFieldDefinitions(rawDefinitions)
      if (Object.keys(definitions).length > 0) block.additionalFieldDefinition = definitions
      else delete block.additionalFieldDefinition
    }
    if (block.type === 'simple-container-block' || block.type === 'flow-container-block') delete block.packaged
  })
  return cloned
}

export async function buildProjectCustomBlockManifest(options: {
  root: CardBlock
  publisherKey: string
  blockKey: string
  version?: string
  name?: string
  description?: string
  exposedFieldKeys?: readonly string[]
  resize?: ProjectCustomBlockResizePolicy
}): Promise<ProjectCustomBlockManifest> {
  const packageId = createProjectCustomBlockPackageId(options.publisherKey, options.blockKey)
  if (!packageId) throw new Error('Invalid custom block Package ID')
  const version = normalizeProjectCustomBlockVersion(options.version ?? PROJECT_CUSTOM_BLOCK_DEFAULT_VERSION)
  if (!version) throw new Error('Invalid custom block version')
  const analysis = analyzeProjectCustomBlockExport(options.root)
  const exposed = new Set(options.exposedFieldKeys ?? [])
  const exposableKeys = new Set(analysis.fields.map(field => field.key))
  for (const fieldKey of exposed) {
    if (!exposableKeys.has(fieldKey)) {
      throw new Error(`Custom block public field is not available on the root: ${fieldKey}`)
    }
  }
  const publicFieldKeys = [
    ...PROJECT_CUSTOM_BLOCK_ALWAYS_PUBLIC_FIELD_KEYS,
    ...analysis.fields.filter(field => exposed.has(field.key)).map(field => field.key),
  ]
  return {
    type: 'opencard-custom-block',
    packageId,
    version,
    name: options.name?.trim() || options.root.name?.trim() || options.blockKey,
    ...(options.description?.trim() ? { description: options.description.trim() } : {}),
    publicFieldKeys,
    resize: options.resize ?? analysis.resize,
  }
}
