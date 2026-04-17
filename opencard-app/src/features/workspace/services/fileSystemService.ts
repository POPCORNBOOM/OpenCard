/**
 * 模块说明：
 * - 封装 Tauri 文件系统 API 提供统一文件服务接口
 * 职责边界：
 * - 只负责 IO 适配 不处理路径合法性业务规则
 */
import { open } from '@tauri-apps/plugin-dialog'
import {
  readTextFile,
  writeTextFile,
  readDir,
  mkdir,
  remove,
  rename,
  exists,
  type DirEntry,
} from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'

export interface FileSystemService {
  openProject(): Promise<string | null>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  deleteFile(path: string): Promise<void>
  renameFile(oldPath: string, newPath: string): Promise<void>
  fileExists(path: string): Promise<boolean>
  readDirectory(path: string, recursive?: boolean): Promise<DirEntry[]>
  readDirectoryEntries(path: string, depth?: number, basePath?: string): Promise<DirEntry[]>
  createDirectory(path: string): Promise<void>
  startWatching(path: string): Promise<void>
  stopWatching(): Promise<void>
}

class FileSystemServiceImpl implements FileSystemService {
  async openProject(): Promise<string | null> {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择项目文件夹',
    })

    return selected as string | null
  }

  async readFile(path: string): Promise<string> {
    return await readTextFile(path)
  }

  async writeFile(path: string, content: string): Promise<void> {
    await writeTextFile(path, content)
  }

  async deleteFile(path: string): Promise<void> {
    await remove(path, { recursive: true })
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    await rename(oldPath, newPath)
  }

  async fileExists(path: string): Promise<boolean> {
    return await exists(path)
  }

  async readDirectory(path: string, recursive: boolean = false): Promise<DirEntry[]> {
    if (!recursive) {
      return await readDir(path)
    }

    return await this.readDirectoryEntries(path, Number.POSITIVE_INFINITY)
  }

  async readDirectoryEntries(path: string, depth: number = 1, basePath: string = ''): Promise<DirEntry[]> {
    const maxDepth = Number.isFinite(depth) ? Math.max(1, Math.floor(depth)) : Number.POSITIVE_INFINITY
    const result: DirEntry[] = []

    async function readRecursive(dirPath: string, currentBasePath: string, currentDepth: number) {
      const entries = await readDir(dirPath)

      for (const entry of entries) {
        const relativePath = currentBasePath ? `${currentBasePath}/${entry.name}` : entry.name
        result.push({
          ...entry,
          name: relativePath,
        })

        if (entry.isDirectory && currentDepth < maxDepth) {
          const fullPath = `${dirPath}/${entry.name}`
          await readRecursive(fullPath, relativePath, currentDepth + 1)
        }
      }
    }

    await readRecursive(path, basePath, 1)
    return result
  }

  async createDirectory(path: string): Promise<void> {
    await mkdir(path, { recursive: true })
  }

  async startWatching(path: string): Promise<void> {
    await invoke('watch_directory', { path })
  }

  async stopWatching(): Promise<void> {
    await invoke('stop_watching')
  }
}

export const fileSystemService = new FileSystemServiceImpl()
