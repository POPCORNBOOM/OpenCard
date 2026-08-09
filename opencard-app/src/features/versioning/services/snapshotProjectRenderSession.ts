import type { CardRenderEnvironment } from '../../card-rendering/renderPipeline'
import {
  PROJECT_PROFILE_FILE_NAME,
  parseProjectMetadataText,
  toProjectInformation,
} from '../../workspace/model/projectMetadata'
import {
  PROJECT_DICTIONARY_FILE_NAME,
  parseProjectDictionaryText,
  resolveProjectDictionary,
} from '../../workspace/model/projectDictionary'
import {
  PROJECT_ICON_REGISTRY_FILE_NAME,
  parseProjectIconRegistryText,
} from '../../workspace/model/projectIconRegistry'
import {
  PROJECT_CUSTOM_BLOCK_REGISTRY_FILE_NAME,
  parseProjectCustomBlockRegistryText,
  type ProjectCustomBlockCatalog,
  type ProjectCustomBlockCatalogEntry,
} from '../../workspace/model/projectCustomBlocks'
import { resolveEditorAssetSrc } from '../../editor-runtime/services/editorResource'
import { fileSystemService, type FileSystemService } from '../../workspace/services/fileSystemService'
import { readProjectCustomBlockPackage } from '../../workspace/services/projectCustomBlock'
import {
  createProjectCustomBlockAssetSession,
  type ProjectCustomBlockAssetSession,
} from '../../workspace/services/projectCustomBlockAssetLoader'
import {
  createProjectCustomBlockFontSession,
  type ProjectCustomBlockFontSession,
} from '../../workspace/services/projectCustomBlockFontLoader'
import {
  buildProjectIconCatalog,
  EMPTY_PROJECT_ICON_CATALOG,
  projectIconIdentity,
  type ProjectIconCatalog,
} from '../../workspace/services/projectIconCatalog'

export type SnapshotProjectRenderSession = {
  environment: CardRenderEnvironment
  release: () => void
}

function snapshotPath(rootPath: string, relativePath: string): string {
  const root = rootPath.replace(/[\\/]+$/, '')
  return `${root}/${relativePath.replace(/^[\\/]+/, '').replace(/\\/g, '/')}`
}

async function readOptionalText(
  fs: Pick<FileSystemService, 'fileExists' | 'readFile'>,
  rootPath: string,
  relativePath: string,
): Promise<string | null> {
  const path = snapshotPath(rootPath, relativePath)
  return await fs.fileExists(path) ? await fs.readFile(path) : null
}

function mergeIconCatalogs(customBlocks: ProjectIconCatalog, project: ProjectIconCatalog): ProjectIconCatalog {
  const customIdentities = new Set(customBlocks.entries.map(entry => (
    projectIconIdentity(entry.seriesKey, entry.iconKey)
  )))
  return {
    series: [...customBlocks.series, ...project.series],
    entries: [
      ...customBlocks.entries,
      ...project.entries.filter(entry => !customIdentities.has(projectIconIdentity(entry.seriesKey, entry.iconKey))),
    ],
    errors: [...customBlocks.errors, ...project.errors],
  }
}

async function loadCustomBlocks(
  fs: Pick<FileSystemService, 'fileExists' | 'readFile' | 'readBinaryFile'>,
  rootPath: string,
): Promise<{
  catalog: ProjectCustomBlockCatalog
  assetSession: ProjectCustomBlockAssetSession
  fontSession: ProjectCustomBlockFontSession
}> {
  const content = await readOptionalText(fs, rootPath, PROJECT_CUSTOM_BLOCK_REGISTRY_FILE_NAME)
  const registry = content === null ? { blocks: [] } : parseProjectCustomBlockRegistryText(content)
  if (!registry) throw new Error('Invalid snapshot custom block registry')

  const catalog = new Map<string, ProjectCustomBlockCatalogEntry>()
  for (const relativePath of registry.blocks ?? []) {
    const entry = await readProjectCustomBlockPackage(fs, snapshotPath(rootPath, relativePath))
    const key = entry.manifest.key.toLowerCase()
    if (catalog.has(key)) throw new Error(`Duplicate snapshot custom block key: ${entry.manifest.key}`)
    catalog.set(key, { ...entry, archivePath: relativePath })
  }

  const assetSession = await createProjectCustomBlockAssetSession(catalog)
  try {
    const fontSession = await createProjectCustomBlockFontSession(catalog)
    const runtimeCatalog = new Map(assetSession.customBlockCatalog)
    for (const [key, runtimeEntry] of runtimeCatalog) {
      const packageEntry = catalog.get(key)
      const packageSeriesKeys = new Set(
        (packageEntry?.manifest.resources?.iconSeries ?? []).map(series => series.key.toLowerCase()),
      )
      const hasResourceErrors = fontSession.errors.some(error => error.packageKey.toLowerCase() === key)
        || assetSession.iconCatalog.errors.some(error => packageSeriesKeys.has(error.seriesKey.toLowerCase()))
      if (hasResourceErrors) runtimeCatalog.set(key, { ...runtimeEntry, hasResourceErrors: true })
    }
    return {
      catalog,
      assetSession: { ...assetSession, customBlockCatalog: runtimeCatalog },
      fontSession,
    }
  } catch (error) {
    assetSession.release()
    throw error
  }
}

export async function createSnapshotProjectRenderSession(
  rootPath: string,
  fs: Pick<FileSystemService, 'fileExists' | 'readFile' | 'readBinaryFile'> = fileSystemService,
): Promise<SnapshotProjectRenderSession> {
  const [profileContent, dictionaryContent, iconContent] = await Promise.all([
    readOptionalText(fs, rootPath, PROJECT_PROFILE_FILE_NAME),
    readOptionalText(fs, rootPath, PROJECT_DICTIONARY_FILE_NAME),
    readOptionalText(fs, rootPath, PROJECT_ICON_REGISTRY_FILE_NAME),
  ])
  const profile = profileContent === null ? null : parseProjectMetadataText(profileContent)
  const dictionary = dictionaryContent === null ? null : parseProjectDictionaryText(dictionaryContent)
  const iconRegistry = iconContent === null ? null : parseProjectIconRegistryText(iconContent)
  if (profileContent !== null && !profile) throw new Error('Invalid snapshot project profile')
  if (dictionaryContent !== null && !dictionary) throw new Error('Invalid snapshot project dictionary')
  if (iconContent !== null && !iconRegistry) throw new Error('Invalid snapshot project icon registry')

  const projectIconCatalog = iconRegistry
    ? await buildProjectIconCatalog(
        iconRegistry.iconSeries ?? [],
        source => resolveEditorAssetSrc(rootPath, source),
      )
    : EMPTY_PROJECT_ICON_CATALOG
  const customBlocks = await loadCustomBlocks(fs, rootPath)
  let released = false
  return {
    environment: {
      project: profile ? toProjectInformation(profile) : null,
      dictionary: dictionary ? resolveProjectDictionary(dictionary).values : null,
      remoteResourcePolicy: profile?.remoteResources,
      projectIconCatalog: mergeIconCatalogs(customBlocks.assetSession.iconCatalog, projectIconCatalog),
      customBlockCatalog: customBlocks.assetSession.customBlockCatalog,
    },
    release: () => {
      if (released) return
      released = true
      customBlocks.fontSession.release()
      customBlocks.assetSession.release()
    },
  }
}
