import type { CardBlock, CardDocument } from '../../../entities/card/model'
import type { CardPipelineIssue } from '../../card-rendering/cardPipelineIssue'
import type { ProjectFontRegistry } from '../model/projectFontRegistry'
import type { ProjectInformation } from '../model/projectMetadata'
import type {
  ProjectCustomBlockManifest,
  ProjectCustomBlockManifestCatalog,
  ProjectCustomBlockPackageIssue,
} from '../model/projectCustomBlocks'
import type { ProjectIconSeries } from '../model/projectIcons'
import type { ResolvedProjectDictionary } from '../model/projectDictionary'
import type { FileSystemService } from './fileSystemService'
import { buildProjectCustomBlockManifest, buildProjectCustomBlockRoot } from './buildProjectCustomBlockManifest'
import { exportProjectCustomBlockPackage } from './projectCustomBlock'
import {
  analyzeProjectCustomBlockResources,
  materializeProjectCustomBlockResources,
  type MaterializedProjectCustomBlockResources,
  type ProjectCustomBlockResourceAnalysis,
} from './projectCustomBlockResources'
import { materializeProjectCustomBlockExport } from './materializeProjectCustomBlockExport'

export type PreparedProjectCustomBlockExport = {
  manifest: ProjectCustomBlockManifest
  block: CardBlock
  resourceAnalysis: ProjectCustomBlockResourceAnalysis
  previewHostSize?: { width: string, height: string }
}

export type ProjectCustomBlockCandidate = PreparedProjectCustomBlockExport & {
  resources: MaterializedProjectCustomBlockResources
}

export type ProjectCustomBlockExportResult =
  | { status: 'exported', outputPath: string, manifest: ProjectCustomBlockManifest, issues: readonly ProjectCustomBlockPackageIssue[] }
  | { status: 'cancelled' }
  | { status: 'blocked', reason: 'binding', issue: CardPipelineIssue }

type CustomBlockExportFileSystem = Pick<FileSystemService,
  'pickSavePath' | 'readBinaryFile' | 'readDirectoryEntries' | 'fileExists' | 'writeBinaryFile'>
  & Partial<Pick<FileSystemService, 'writeFile'>>

export async function prepareProjectCustomBlockExport(options: {
  document: CardDocument
  rootBlockId: string
  name: string
  blockKey: string
  exposedFieldKeys: readonly string[]
  projectRootPath: string
  project?: Readonly<ProjectInformation> | null
  dictionary?: Readonly<ResolvedProjectDictionary> | null
  projectFonts?: ProjectFontRegistry
  projectIconSeries?: readonly ProjectIconSeries[]
  customBlockManifestCatalog?: ProjectCustomBlockManifestCatalog
  fs: Pick<FileSystemService, 'readDirectoryEntries' | 'fileExists'>
}): Promise<PreparedProjectCustomBlockExport | { blocked: CardPipelineIssue }> {
  const materialized = materializeProjectCustomBlockExport({
    document: options.document,
    rootBlockId: options.rootBlockId,
    environment: { project: options.project, dictionary: options.dictionary },
  })
  const bindingIssue = materialized.issues[0]
  if (bindingIssue) return { blocked: bindingIssue }

  const block = buildProjectCustomBlockRoot(materialized.root, options.exposedFieldKeys)
  const manifest = await buildProjectCustomBlockManifest({
    root: block,
    key: options.blockKey,
    name: options.name,
    exposedFieldKeys: options.exposedFieldKeys,
  })
  const resourceAnalysis = await analyzeProjectCustomBlockResources({
    root: block,
    projectRootPath: options.projectRootPath,
    fs: options.fs,
    projectFonts: options.projectFonts,
    projectIconSeries: options.projectIconSeries,
    customBlockManifestCatalog: options.customBlockManifestCatalog,
  })
  return {
    manifest,
    block,
    resourceAnalysis,
    previewHostSize: { width: options.document.width, height: options.document.height },
  }
}

export async function buildProjectCustomBlockCandidate(options: {
  prepared: PreparedProjectCustomBlockExport
  selectedResourceIds?: ReadonlySet<string>
  projectRootPath: string
  projectFonts?: ProjectFontRegistry
  projectIconSeries?: readonly ProjectIconSeries[]
  customBlockManifestCatalog?: ProjectCustomBlockManifestCatalog
  fs: Pick<FileSystemService, 'readDirectoryEntries' | 'readBinaryFile'>
}): Promise<ProjectCustomBlockCandidate> {
  const resources = await materializeProjectCustomBlockResources({
    analysis: options.prepared.resourceAnalysis,
    selectedIds: options.selectedResourceIds ?? options.prepared.resourceAnalysis.defaultSelectedIds,
    projectRootPath: options.projectRootPath,
    fs: options.fs,
    projectFonts: options.projectFonts,
    projectIconSeries: options.projectIconSeries,
    customBlockManifestCatalog: options.customBlockManifestCatalog,
  })
  return { ...options.prepared, resources }
}

export async function exportPreparedProjectCustomBlock(options: {
  prepared: PreparedProjectCustomBlockExport
  selectedResourceIds?: ReadonlySet<string>
  projectRootPath: string
  projectFonts?: ProjectFontRegistry
  projectIconSeries?: readonly ProjectIconSeries[]
  customBlockManifestCatalog?: ProjectCustomBlockManifestCatalog
  fs: CustomBlockExportFileSystem
}): Promise<ProjectCustomBlockExportResult> {
  const blockKey = options.prepared.manifest.packageId.replace(/^block:/i, '') || 'custom-block'
  const outputPath = await options.fs.pickSavePath({
    defaultPath: `${blockKey}.ocblock`,
    fileTypeName: 'OpenCard custom block',
    extensions: ['ocblock'],
  })
  if (!outputPath) return { status: 'cancelled' }
  const candidate = await buildProjectCustomBlockCandidate(options)
  const writtenPath = await exportProjectCustomBlockPackage({
    fs: options.fs,
    manifest: candidate.manifest,
    block: candidate.block,
    files: candidate.resources.files,
    declaredResourceDependencies: candidate.resources.selectedCandidates
      .filter(resource => !resource.automatic)
      .map(resource => resource.id),
    outputPath,
  })
  return {
    status: 'exported',
    outputPath: writtenPath,
    manifest: candidate.manifest,
    issues: candidate.resources.issues,
  }
}

export async function exportProjectCustomBlock(options: {
  document: CardDocument
  rootBlockId: string
  name: string
  blockKey: string
  exposedFieldKeys: readonly string[]
  selectedResourceIds?: ReadonlySet<string>
  projectRootPath: string
  project?: Readonly<ProjectInformation> | null
  dictionary?: Readonly<ResolvedProjectDictionary> | null
  projectFonts?: ProjectFontRegistry
  projectIconSeries?: readonly ProjectIconSeries[]
  customBlockManifestCatalog?: ProjectCustomBlockManifestCatalog
  fs: CustomBlockExportFileSystem
}): Promise<ProjectCustomBlockExportResult> {
  const prepared = await prepareProjectCustomBlockExport(options)
  if ('blocked' in prepared) return { status: 'blocked', reason: 'binding', issue: prepared.blocked }
  return await exportPreparedProjectCustomBlock({ ...options, prepared })
}
