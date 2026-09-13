import { join } from '@tauri-apps/api/path'
import type { DirEntry } from '@tauri-apps/plugin-fs'
import { resolveAppStorageRoot } from '../../../shared/storage/appStoragePaths'
import { fileSystemService, type FileSystemService } from './fileSystemService'
import { previewResourcePackage } from './resourcePackageInstaller'
import { RESOURCE_PACKAGE_EXTENSION, RESOURCE_PACKAGE_SUFFIX } from '../model/resourcePackage'
import {
  STORED_RESOURCE_PACKAGE_DIRECTORY_NAME,
  type StoredResourcePackage,
  type StoredResourcePackageSnapshot,
} from '../model/storedResourcePackage'

export interface StoredResourcePackagePathService {
  appStorageDir(): Promise<string>
  join(...paths: string[]): Promise<string>
}

const defaultPathService: StoredResourcePackagePathService = {
  appStorageDir: resolveAppStorageRoot,
  join,
}

function describeError(value: unknown): string {
  return value instanceof Error ? value.message : String(value)
}

function isPackageFile(entry: DirEntry): boolean {
  return entry.isFile && entry.name.toLocaleLowerCase().endsWith(RESOURCE_PACKAGE_SUFFIX)
}

/**
 * 软件存储里的附加包列表：导入时校验归档，创建项目时再按需装入项目。
 * 存储本身不是一个项目，校验只借用应用存储目录作为“已经装过哪些包”的检查根，
 * 而该根下永远不会有安装好的包目录，因此每次校验都是纯粹的归档检查。
 */
export class StoredResourcePackageLibraryService {
  constructor(
    private readonly fs: FileSystemService = fileSystemService,
    private readonly paths: StoredResourcePackagePathService = defaultPathService,
  ) {}

  async loadLibrary(): Promise<StoredResourcePackageSnapshot> {
    const root = await this.resolveRoot()
    await this.fs.createDirectory(root)
    const packs: StoredResourcePackage[] = []
    const warnings: StoredResourcePackageSnapshot['warnings'] = []
    for (const entry of await this.fs.readDirectory(root)) {
      if (!isPackageFile(entry)) continue
      const path = await this.paths.join(root, entry.name)
      try {
        packs.push(await this.inspect(path, root))
      } catch (cause) {
        warnings.push({ path, reason: describeError(cause) })
      }
    }
    return { packs: packs.sort((left, right) => left.name.localeCompare(right.name)), warnings }
  }

  async pickSourceFile(title: string): Promise<string | null> {
    return await this.fs.pickFile({
      title,
      fileTypeName: 'OpenCard package',
      extensions: [RESOURCE_PACKAGE_EXTENSION],
    })
  }

  /** 校验之后才写入存储，因此存进来的包一定可以装入项目。 */
  async importPackage(sourcePath: string): Promise<StoredResourcePackage> {
    const root = await this.resolveRoot()
    await this.fs.createDirectory(root)
    const inspected = await this.inspect(sourcePath, root)
    const targetPath = await this.resolveAvailablePath(root, inspected.key)
    // 归档可能很大，直接复制文件，不把整包读进前端内存。
    await this.fs.copyFile(sourcePath, targetPath)
    return { ...inspected, path: targetPath }
  }

  async removePackage(path: string): Promise<void> {
    await this.fs.deleteFile(path)
  }

  private async inspect(path: string, storeRoot: string): Promise<StoredResourcePackage> {
    const preview = await previewResourcePackage({ projectRootPath: storeRoot, sourcePath: path })
    return {
      path,
      key: preview.manifest.key,
      name: preview.manifest.name,
      version: preview.manifest.version,
    }
  }

  private async resolveAvailablePath(root: string, key: string): Promise<string> {
    let candidate = await this.paths.join(root, `${key}${RESOURCE_PACKAGE_SUFFIX}`)
    let suffix = 2
    while (await this.fs.fileExists(candidate)) {
      candidate = await this.paths.join(root, `${key}-${suffix}${RESOURCE_PACKAGE_SUFFIX}`)
      suffix += 1
    }
    return candidate
  }

  private async resolveRoot(): Promise<string> {
    return await this.paths.join(
      await this.paths.appStorageDir(),
      STORED_RESOURCE_PACKAGE_DIRECTORY_NAME,
    )
  }
}

export const storedResourcePackageLibrary = new StoredResourcePackageLibraryService()
