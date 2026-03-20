import { open } from '@tauri-apps/plugin-dialog'
import {
  readTextFile,
  writeTextFile,
  readDir,
  mkdir,
  remove,
  rename,
  exists,
  type DirEntry
} from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'

export interface FileSystemService {
  // 项目管理
  openProject(): Promise<string | null>

  // 文件操作
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  deleteFile(path: string): Promise<void>
  renameFile(oldPath: string, newPath: string): Promise<void>
  fileExists(path: string): Promise<boolean>

  // 目录操作
  readDirectory(path: string, recursive?: boolean): Promise<DirEntry[]>
  createDirectory(path: string): Promise<void>

  // 文件监听
  startWatching(path: string): Promise<void>
  stopWatching(): Promise<void>
}

class FileSystemServiceImpl implements FileSystemService {
  async openProject(): Promise<string | null> {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择项目文件夹'
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

    // 递归读取目录
    const result: DirEntry[] = []

    async function readRecursive(dirPath: string, basePath: string = '') {
      const entries = await readDir(dirPath)

      for (const entry of entries) {
        const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name
        result.push({
          ...entry,
          name: relativePath
        })

        if (entry.isDirectory) {
          const fullPath = `${dirPath}/${entry.name}`
          await readRecursive(fullPath, relativePath)
        }
      }
    }

    await readRecursive(path)
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
