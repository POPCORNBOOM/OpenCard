import { join } from '@tauri-apps/api/path'
import { resolveAppStorageRoot } from '../../../shared/storage/appStoragePaths'
import {
  createUserCustomBlockCatalogEntry,
  USER_CUSTOM_BLOCK_CATALOG_EXTENSION,
  USER_CUSTOM_BLOCK_CATALOG_SUFFIX,
  USER_CUSTOM_BLOCK_DIRECTORY_NAME,
  type UserCustomBlockCatalogEntry,
  type UserCustomBlockCatalogSnapshot,
} from '../model/userCustomBlockCatalog'
import { readProjectCustomBlockPackage } from './projectCustomBlock'
import { fileSystemService, type FileSystemService } from './fileSystemService'

export interface UserCustomBlockCatalogPathService {
  appStorageDir(): Promise<string>
  join(...paths: string[]): Promise<string>
}

const defaultPathService: UserCustomBlockCatalogPathService = {
  appStorageDir: resolveAppStorageRoot,
  join,
}

function describeError(value: unknown): string {
  return value instanceof Error ? value.message : String(value)
}

function isCustomBlockFile(entry: { isFile: boolean; name: string }): boolean {
  return entry.isFile && entry.name.toLocaleLowerCase().endsWith(USER_CUSTOM_BLOCK_CATALOG_SUFFIX)
}

function safeCustomBlockFileName(blockKey: string): string {
  const safe = blockKey.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '')
  return `${safe || 'custom-block'}${USER_CUSTOM_BLOCK_CATALOG_SUFFIX}`
}

export class UserCustomBlockCatalogService {
  constructor(
    private readonly fs: FileSystemService = fileSystemService,
    private readonly paths: UserCustomBlockCatalogPathService = defaultPathService,
  ) {}

  async loadCatalog(): Promise<UserCustomBlockCatalogSnapshot> {
    const root = await this.resolveUserRoot()
    await this.fs.createDirectory(root)
    const blocks: UserCustomBlockCatalogEntry[] = []
    const warnings: UserCustomBlockCatalogSnapshot['warnings'] = []
    const identities = new Set<string>()
    const entries = (await this.fs.readDirectory(root))
      .filter(isCustomBlockFile)
      .sort((left, right) => left.name.localeCompare(right.name))

    for (const entry of entries) {
      const path = await this.paths.join(root, entry.name)
      try {
        const customBlock = await readProjectCustomBlockPackage(this.fs, path)
        const identity = customBlock.manifest.customBlockKey.toLocaleLowerCase()
        if (identities.has(identity)) {
          warnings.push({ path, reason: `Duplicate custom block Key: ${customBlock.manifest.customBlockKey}` })
          continue
        }
        identities.add(identity)
        blocks.push(createUserCustomBlockCatalogEntry(customBlock.manifest, path))
      } catch (cause) {
        warnings.push({ path, reason: describeError(cause) })
      }
    }

    blocks.sort((left, right) => left.name.localeCompare(right.name))
    return { blocks, warnings }
  }

  async pickUserCustomBlock(title: string): Promise<string | null> {
    return await this.fs.pickFile({
      title,
      fileTypeName: 'OpenCard Custom Block',
      extensions: [USER_CUSTOM_BLOCK_CATALOG_EXTENSION],
    })
  }

  async importUserCustomBlock(sourcePath: string): Promise<string> {
    const customBlock = await readProjectCustomBlockPackage(this.fs, sourcePath)
    const catalog = await this.loadCatalog()
    const existing = catalog.blocks.find(block => (
      block.customBlockKey.toLocaleLowerCase() === customBlock.manifest.customBlockKey.toLocaleLowerCase()
    ))

    const root = await this.resolveUserRoot()
    const sourceBytes = await this.fs.readBinaryFile(sourcePath)
    if (existing) {
      await this.fs.writeBinaryFile(existing.path, sourceBytes)
      return existing.path
    }

    const baseName = safeCustomBlockFileName(customBlock.manifest.customBlockKey)
    let candidateName = baseName
    let candidatePath = await this.paths.join(root, candidateName)
    let suffix = 2
    while (await this.fs.fileExists(candidatePath)) {
      candidateName = `${baseName.slice(0, -USER_CUSTOM_BLOCK_CATALOG_SUFFIX.length)} (${suffix})${USER_CUSTOM_BLOCK_CATALOG_SUFFIX}`
      candidatePath = await this.paths.join(root, candidateName)
      suffix += 1
    }
    await this.fs.writeBinaryFile(candidatePath, sourceBytes)
    return candidatePath
  }

  private async resolveUserRoot(): Promise<string> {
    return await this.paths.join(await this.paths.appStorageDir(), USER_CUSTOM_BLOCK_DIRECTORY_NAME)
  }
}

export const userCustomBlockCatalogService = new UserCustomBlockCatalogService()
