import {
  createCardFace,
  type CardDocument,
} from '../../../entities/card/model'
import { fillDefaults } from '../../../entities/card/schema'
import { prepareCardRender, type PreparedCardRender } from '../../card-rendering/renderPipeline'
import type { ProjectCustomBlockPackageIssue } from '../model/projectCustomBlocks'
import type { FileSystemService } from './fileSystemService'
import type { ProjectCustomBlockCandidate } from './exportProjectCustomBlock'
import {
  createProjectCustomBlockArchive,
  installProjectCustomBlockPackageFromBytes,
} from './projectCustomBlock'
import { loadInstalledProjectCustomBlockRuntime } from './projectCustomBlockAssetLoader'
import { createProjectCustomBlockFontSession } from './projectCustomBlockFontLoader'
import { createProjectCustomBlockInstance } from './createProjectCustomBlockInstance'
import { loadProjectResourceEnvironment } from './projectResourceEnvironment'

export type ProjectCustomBlockCandidatePreview = {
  render: PreparedCardRender
  packageIssues: readonly ProjectCustomBlockPackageIssue[]
  release: () => Promise<void>
}

function createPreviewDocument(
  candidate: ProjectCustomBlockCandidate,
  overrides: Readonly<Record<string, unknown>>,
): CardDocument {
  const host = createProjectCustomBlockInstance(candidate, { id: 'custom-block-export-preview' })
  Object.assign(host, overrides)
  const front = createCardFace({
    id: 'custom-block-export-preview-front',
    background: 'transparent',
    children: [{
      block: host,
      location: {
        id: 'custom-block-export-preview-location',
        type: 'simple-container-location',
        anchor: 'lt',
        x: '0px',
        y: '0px',
      },
    }],
  })
  return fillDefaults('card-document', {
    type: 'card-document',
    id: 'custom-block-export-preview-document',
    name: candidate.manifest.name,
    faces: {
      front,
      back: createCardFace({ id: 'custom-block-export-preview-back', background: 'transparent' }),
    },
    instances: [],
  }) as unknown as CardDocument
}

export async function createProjectCustomBlockCandidatePreview(options: {
  candidate: ProjectCustomBlockCandidate
  overrides: Readonly<Record<string, unknown>>
  sourceProjectRootPath: string
  fs: Pick<FileSystemService,
    'createDirectory' | 'writeFile' | 'writeBinaryFile' | 'readFile' | 'readBinaryFile'
    | 'readDirectoryEntries' | 'fileExists' | 'renameFile' | 'deleteFile'>
  createId?: () => string
}): Promise<ProjectCustomBlockCandidatePreview> {
  const id = (options.createId ?? (() => crypto.randomUUID()))()
  const sourceRoot = options.sourceProjectRootPath.replace(/[\\/]+$/, '')
  const temporaryRoot = `${sourceRoot}/.opencard/.custom-block-preview/${id}`
  const archive = createProjectCustomBlockArchive(
    options.candidate.manifest,
    options.candidate.block,
    options.candidate.resources.files,
  )
  let released = false
  let fontSession: Awaited<ReturnType<typeof createProjectCustomBlockFontSession>> | null = null
  try {
    const installed = await installProjectCustomBlockPackageFromBytes({
      fs: options.fs,
      projectRootPath: temporaryRoot,
      bytes: archive,
      sourcePath: `${options.candidate.manifest.packageId}.ocblock`,
    })
    const installationPath = `${temporaryRoot}/${installed.installationPath}`
    const loaded = await loadInstalledProjectCustomBlockRuntime({ fs: options.fs, installationPath })
    fontSession = await createProjectCustomBlockFontSession(
      loaded.environments,
      undefined,
      path => options.fs.readBinaryFile(path),
    )
    const hostEnvironment = await loadProjectResourceEnvironment({
      fs: options.fs,
      rootPath: temporaryRoot,
      kind: 'project',
      identity: `preview-${id}`,
    })
    const catalog = new Map([[loaded.entry.manifest.packageId.toLocaleLowerCase(), loaded.runtimeEntry]])
    const render = prepareCardRender({
      document: createPreviewDocument(options.candidate, options.overrides),
      instance: null,
      resourceRootPath: temporaryRoot,
      environment: {
        project: null,
        dictionary: null,
        projectIconCatalog: hostEnvironment.iconCatalog,
        projectResourceEnvironment: { ...hostEnvironment, customBlockCatalog: catalog },
        customBlockCatalog: catalog,
      },
    })
    return {
      render,
      packageIssues: [
        ...options.candidate.resources.issues,
        ...loaded.issues,
        ...fontSession.errors.map(error => ({
          code: 'resource-unavailable' as const,
          path: error.source,
          message: 'Package font failed to load',
        })),
      ],
      release: async () => {
        if (released) return
        released = true
        fontSession?.release()
        if (await options.fs.fileExists(temporaryRoot)) {
          await options.fs.deleteFile(temporaryRoot).catch(() => undefined)
        }
      },
    }
  } catch (cause) {
    fontSession?.release()
    if (await options.fs.fileExists(temporaryRoot)) {
      await options.fs.deleteFile(temporaryRoot).catch(() => undefined)
    }
    throw cause
  }
}
