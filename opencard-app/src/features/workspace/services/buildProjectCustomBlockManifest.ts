import type { CardBlock } from '../../../entities/card/model'
import {
  computeProjectCustomBlockInterfaceHash,
  type ProjectCustomBlockManifest,
  type ProjectCustomBlockPublicField,
} from '../model/projectCustomBlocks'
import { analyzeProjectCustomBlockExport } from './projectCustomBlockExportAnalyzer'

function cloneExportRoot(root: CardBlock): CardBlock {
  const cloned = structuredClone(root)
  const visit = (block: CardBlock): void => {
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
