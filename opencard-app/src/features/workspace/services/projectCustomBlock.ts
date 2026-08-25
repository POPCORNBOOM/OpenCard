import {
  parseProjectCustomBlockDefinitionText,
  readProjectCustomBlockDefinition,
  serializeProjectCustomBlockDefinition,
  writeProjectCustomBlockDefinition,
  type ProjectCustomBlockDefinition,
  type ProjectCustomBlockDefinitionCatalogEntry,
  type ProjectCustomBlockDefinitionIssue,
} from './projectCustomBlockDefinition'
import type { FileSystemService } from './fileSystemService'

export type ProjectCustomBlockDefinitionReadResult = {
  definition: ProjectCustomBlockDefinition | null
  issues: readonly ProjectCustomBlockDefinitionIssue[]
}

export async function readProjectCustomBlockDefinitionFile(
  fs: Pick<FileSystemService, 'readFile'>,
  sourcePath: string,
): Promise<ProjectCustomBlockDefinitionReadResult> {
  return await readProjectCustomBlockDefinition(fs, sourcePath)
}

export function parseProjectCustomBlockDefinitionFile(
  content: string,
  fallbackKey: string,
): ProjectCustomBlockDefinitionReadResult {
  return parseProjectCustomBlockDefinitionText(content, fallbackKey)
}

export async function writeProjectCustomBlockDefinitionFile(
  fs: Pick<FileSystemService, 'createDirectory' | 'writeFile'>,
  projectRootPath: string,
  definition: ProjectCustomBlockDefinition,
): Promise<string> {
  return await writeProjectCustomBlockDefinition(fs, projectRootPath, definition)
}

export function serializeProjectCustomBlockDefinitionFile(
  definition: ProjectCustomBlockDefinition,
): string {
  return serializeProjectCustomBlockDefinition(definition)
}

export type ProjectCustomBlockCatalogEntry = ProjectCustomBlockDefinitionCatalogEntry
