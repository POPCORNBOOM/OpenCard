import type { CardBlock } from '../../../entities/card/model'
import { parseAdditionalFieldDefinitions } from '../../../entities/card/schema'
import {
  computeProjectCustomBlockInterfaceHash,
  type ProjectCustomBlockManifest,
  type ProjectCustomBlockPublicField,
} from '../model/projectCustomBlocks'
import { analyzeProjectCustomBlockExport } from './projectCustomBlockExportAnalyzer'

function cloneExportRoot(root: CardBlock): CardBlock {
  const cloned = structuredClone(root)
  const visit = (block: CardBlock): void => {
    const rawDefinitions = block.additionalFieldDefinition
    if (rawDefinitions !== undefined) {
      const definitions = parseAdditionalFieldDefinitions(rawDefinitions)
      if (Object.keys(definitions).length > 0) block.additionalFieldDefinition = definitions
      else delete block.additionalFieldDefinition
    }
    if (block.type !== 'simple-container-block' && block.type !== 'flow-container-block') return
    delete block.packaged
    for (const child of block.children) visit(child.block)
  }
  visit(cloned)
  return cloned
}

export async function buildProjectCustomBlockManifest(options: {
  root: CardBlock
  key: string
  name?: string
  description?: string
  exposedFieldKeys?: readonly string[]
}): Promise<ProjectCustomBlockManifest> {
  const analysis = analyzeProjectCustomBlockExport(options.root)
  const exposed = new Set(options.exposedFieldKeys ?? [])
  const rootDefinitions = parseAdditionalFieldDefinitions(options.root.additionalFieldDefinition)
  for (const fieldKey of exposed) {
    if (!rootDefinitions[fieldKey]) throw new Error(`Custom block public field is not defined on the root: ${fieldKey}`)
  }
  const publicFields: ProjectCustomBlockPublicField[] = analysis.fields
    .filter(field => exposed.has(field.key))
    .map(({ key, fieldType, title }) => ({
      key,
      fieldType,
      ...(title ? { title } : {}),
      ...(typeof (options.root as unknown as Record<string, unknown>)[key] === 'string'
        ? { defaultValue: (options.root as unknown as Record<string, string>)[key] }
        : {}),
    }))
  const interfaceHash = await computeProjectCustomBlockInterfaceHash(publicFields, analysis.resize)
  return {
    type: 'opencard-custom-block',
    schemaVersion: '1',
    key: options.key,
    name: options.name?.trim() || options.root.name?.trim() || options.key,
    ...(options.description?.trim() ? { description: options.description.trim() } : {}),
    interfaceHash,
    root: cloneExportRoot(options.root),
    publicFields,
    resize: analysis.resize,
  }
}
