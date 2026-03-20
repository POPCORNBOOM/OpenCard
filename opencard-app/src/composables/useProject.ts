import { ref, onUnmounted } from 'vue'
import { fileSystemService } from '../services/fileSystemService'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { DirEntry } from '@tauri-apps/plugin-fs'

export function useProject() {
  const projectPath = ref<string>('')
  const files = ref<DirEntry[]>([])
  const isWatching = ref(false)

  let unlistenFn: UnlistenFn | null = null

  // 打开项目
  async function openProject() {
    const path = await fileSystemService.openProject()
    if (path) {
      projectPath.value = path
      await loadFiles()
      await startWatching()
    }
    return path
  }

  // 加载文件列表
  async function loadFiles() {
    if (!projectPath.value) return
    try {
      const entries = await fileSystemService.readDirectory(projectPath.value, true)
      console.log('Loaded files:', entries) // 调试输出
      files.value = entries
    } catch (error) {
      console.error('加载文件失败:', error)
    }
  }

  // 读取文件
  async function readFile(path: string) {
    // 如果是完整路径，直接使用；否则拼接
    const fullPath = path.includes(projectPath.value) ? path : `${projectPath.value}/${path}`
    return await fileSystemService.readFile(fullPath)
  }

  // 保存文件
  async function saveFile(relativePath: string, content: string) {
    const fullPath = `${projectPath.value}/${relativePath}`
    await fileSystemService.writeFile(fullPath, content)
  }

  // 创建文件夹
  async function createFolder(relativePath: string) {
    const fullPath = `${projectPath.value}/${relativePath}`
    await fileSystemService.createDirectory(fullPath)
    await loadFiles()
  }

  // 删除文件
  async function deleteFile(relativePath: string) {
    const fullPath = `${projectPath.value}/${relativePath}`
    await fileSystemService.deleteFile(fullPath)
    await loadFiles()
  }

  // 开始监听文件变化
  async function startWatching() {
    if (!projectPath.value || isWatching.value) return

    try {
      // 监听文件变化事件
      unlistenFn = await listen('file-changed', () => {
        loadFiles() // 自动刷新
      })

      await fileSystemService.startWatching(projectPath.value)
      isWatching.value = true
    } catch (error) {
      console.error('启动监听失败:', error)
    }
  }

  // 停止监听
  async function stopWatching() {
    if (unlistenFn) {
      unlistenFn()
      unlistenFn = null
    }
    await fileSystemService.stopWatching()
    isWatching.value = false
  }

  // 组件卸载时清理
  onUnmounted(() => {
    if (unlistenFn) {
      unlistenFn()
    }
  })

  return {
    // 状态
    projectPath,
    files,
    isWatching,

    // 方法
    openProject,
    loadFiles,
    readFile,
    saveFile,
    createFolder,
    deleteFile,
    startWatching,
    stopWatching
  }
}
