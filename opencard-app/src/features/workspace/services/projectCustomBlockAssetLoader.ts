import type { CustomBlockRuntimeEntry } from '../../card-rendering/expandCustomBlocks'
import type { ProjectCustomBlockIssue } from '../model/projectCustomBlocks'
import type { FileSystemService } from './fileSystemService'
import type { ProjectImageDimensionLoader } from './projectIconCatalog'
import type { ProjectResourceEnvironment } from './projectResourceEnvironment'
import { resolveProjectCustomBlockSizeEditPolicy } from './projectCustomBlockPublicFields'
import type { ProjectCustomBlockDefinitionCatalogEntry } from './projectCustomBlockDefinition'

export type InstalledProjectCustomBlockRuntime = {
  entry: ProjectCustomBlockDefinitionCatalogEntry
  runtimeEntry: CustomBlockRuntimeEntry
  environments: readonly ProjectResourceEnvironment[]
  issues: readonly ProjectCustomBlockIssue[]
}

export async function loadProjectCustomBlockDefinitionRuntime(options: {
  fs: Pick<FileSystemService, 'readDirectoryEntries' | 'readFile' | 'fileExists'>
  entry: ProjectCustomBlockDefinitionCatalogEntry
  environment: ProjectResourceEnvironment
  loadDimensions?: ProjectImageDimensionLoader
}): Promise<InstalledProjectCustomBlockRuntime> {
  const environment = { ...options.environment, customBlockCatalog: new Map() }
  const runtimeEntry: CustomBlockRuntimeEntry = {
    manifest: {
      packageId: `block:${options.entry.definition.key}`,
      publicFieldKeys: options.entry.definition.publicFieldKeys,
    },
    block: options.entry.definition.root,
    sizeEditPolicy: resolveProjectCustomBlockSizeEditPolicy(options.entry.definition.root),
    environment,
    dependencies: new Map(),
  }
  return {
    entry: options.entry,
    runtimeEntry,
    environments: [environment],
    issues: [],
  }
}
