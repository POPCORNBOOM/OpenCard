import type { CardDocument } from '../../../entities/card/model'
import type { CardPipelineIssue } from '../../card-rendering/cardPipelineIssue'
import type { CustomBlockExpansionIssue, CustomBlockRuntimeCatalog } from '../../card-rendering/expandCustomBlocks'
import type { ProjectFontRegistry } from '../model/projectFontRegistry'
import type { ResolvedProjectDictionary } from '../model/projectDictionary'
import type { ProjectInformation, ProjectRemoteResourcePolicy } from '../model/projectMetadata'
import type {
  ProjectCustomBlockManifest,
  ProjectCustomBlockResourceIndex,
} from '../model/projectCustomBlocks'
import type { ProjectIconCatalog } from './projectIconCatalog'
import type { FileSystemService } from './fileSystemService'
import { buildProjectCustomBlockManifest } from './buildProjectCustomBlockManifest'
import { exportProjectCustomBlockPackage } from './projectCustomBlock'
import {
  collectProjectCustomBlockResources,
  rewriteProjectCustomBlockResourceReferences,
} from './projectCustomBlockResources'
import { materializeProjectCustomBlockExport } from './materializeProjectCustomBlockExport'

const CUSTOM_BLOCK_REMOTE_RESOURCE_TIMEOUT_MS = 15_000
const MAX_CUSTOM_BLOCK_REMOTE_RESOURCE_BYTES = 32 * 1024 * 1024

type CustomBlockExportFileSystem = Pick<
  FileSystemService,
  'pickSavePath' | 'readBinaryFile' | 'writeBinaryFile'
>

type ExportCustomBlockCatalog = ReadonlyMap<string, {
  readonly manifest: {
    readonly key: string
    readonly interfaceHash: string
    readonly resources?: ProjectCustomBlockResourceIndex
  }
  readonly files: ReadonlyMap<string, Uint8Array>
}>

export type ProjectCustomBlockExportResult =
  | { status: 'exported'; outputPath: string; manifest: ProjectCustomBlockManifest }
  | { status: 'cancelled' }
  | { status: 'blocked'; reason: 'expansion'; issue: CustomBlockExpansionIssue }
  | { status: 'blocked'; reason: 'binding'; issue: CardPipelineIssue }
  | { status: 'blocked'; reason: 'interface-mismatch'; key: string }

export async function fetchProjectCustomBlockImageBytes(
  url: string,
  fetchResponse: typeof fetch = fetch,
): Promise<Uint8Array> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CUSTOM_BLOCK_REMOTE_RESOURCE_TIMEOUT_MS)
  try {
    const response = await fetchResponse(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Custom block image download failed: ${response.status}`)
    const mime = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? ''
    if (!mime.startsWith('image/')) throw new Error('Custom block remote resource is not an image')
    const declaredLength = Number(response.headers.get('content-length') ?? '')
    if (Number.isFinite(declaredLength) && declaredLength > MAX_CUSTOM_BLOCK_REMOTE_RESOURCE_BYTES) {
      throw new Error('Custom block remote image exceeds the size limit')
    }
    if (!response.body) {
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.byteLength > MAX_CUSTOM_BLOCK_REMOTE_RESOURCE_BYTES) {
        throw new Error('Custom block remote image exceeds the size limit')
      }
      return bytes
    }
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > MAX_CUSTOM_BLOCK_REMOTE_RESOURCE_BYTES) {
        await reader.cancel()
        throw new Error('Custom block remote image exceeds the size limit')
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return bytes
  } finally {
    clearTimeout(timeout)
  }
}

export async function exportProjectCustomBlock(options: {
  document: CardDocument
  rootBlockId: string
  name: string
  key: string
  exposedFieldKeys: readonly string[]
  projectRootPath: string
  project?: Readonly<ProjectInformation> | null
  dictionary?: Readonly<ResolvedProjectDictionary> | null
  projectFonts?: ProjectFontRegistry
  projectIconCatalog?: ProjectIconCatalog
  customBlockCatalog?: ExportCustomBlockCatalog
  customBlockRuntimeCatalog?: CustomBlockRuntimeCatalog
  remoteResourcePolicy?: ProjectRemoteResourcePolicy
  fs: CustomBlockExportFileSystem
  fetchResponse?: typeof fetch
}): Promise<ProjectCustomBlockExportResult> {
  const materialized = materializeProjectCustomBlockExport({
    document: options.document,
    rootBlockId: options.rootBlockId,
    environment: { project: options.project, dictionary: options.dictionary },
    customBlockCatalog: options.customBlockRuntimeCatalog,
  })
  const expansionIssue = materialized.expansionIssues[0]
  if (expansionIssue) return { status: 'blocked', reason: 'expansion', issue: expansionIssue }
  const bindingIssue = materialized.issues[0]
  if (bindingIssue) return { status: 'blocked', reason: 'binding', issue: bindingIssue }

  const manifest = await buildProjectCustomBlockManifest({
    root: materialized.root,
    key: options.key,
    name: options.name,
    exposedFieldKeys: options.exposedFieldKeys,
  })
  const registered = options.customBlockCatalog?.get(manifest.key.toLowerCase())
  if (registered && registered.manifest.interfaceHash !== manifest.interfaceHash) {
    return { status: 'blocked', reason: 'interface-mismatch', key: manifest.key }
  }

  const resources = await collectProjectCustomBlockResources({
    root: materialized.root,
    packageKey: manifest.key,
    projectRootPath: options.projectRootPath,
    projectFonts: options.projectFonts,
    projectIconCatalog: options.projectIconCatalog,
    customBlockCatalog: options.customBlockCatalog,
    remoteResourcePolicy: options.remoteResourcePolicy,
    fs: options.fs,
    fetchBytes: url => fetchProjectCustomBlockImageBytes(url, options.fetchResponse),
  })
  if (Object.keys(resources.index).length > 0) manifest.resources = resources.index
  rewriteProjectCustomBlockResourceReferences(manifest.root, manifest.key, resources)

  const outputPath = await options.fs.pickSavePath({
    defaultPath: `${options.key}.ocblock`,
    fileTypeName: 'OpenCard custom block',
    extensions: ['ocblock'],
  })
  if (!outputPath) return { status: 'cancelled' }
  const writtenPath = await exportProjectCustomBlockPackage({
    fs: options.fs,
    manifest,
    files: resources.files,
    outputPath,
  })
  return { status: 'exported', outputPath: writtenPath, manifest }
}
