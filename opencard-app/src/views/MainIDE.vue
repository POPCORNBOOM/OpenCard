<template>
  <div class="ide-layout">
    <!-- 顶部菜单栏 -->
    <div class="menu-bar">
      <div class="menu-items">
        <span class="menu-item">文件</span>
        <span class="menu-item">编辑</span>
        <span class="menu-item">查看</span>
        <span class="menu-item">帮助</span>
        <span @click="debugLog('Debugging...')" class="menu-item">debug</span>
      </div>
      <div class="window-title">OpenCard</div>
    </div>

    <div class="main-container">
      <!-- 左侧活动栏 -->
      <div class="activity-bar">
        <div class="activity-icons">
          <div class="activity-icon" :class="{ active: activeView === 'files' }" @click="activeView = 'files'"
            title="文件浏览器">
            <i class="codicon codicon-files"></i>
          </div>
          <div class="activity-icon" :class="{ active: activeView === 'git' }" @click="activeView = 'git'" title="版本管理">
            <i class="codicon codicon-source-control"></i>
          </div>
          <div class="activity-icon" :class="{ active: activeView === 'publish' }" @click="activeView = 'publish'"
            title="发布">
            <i class="codicon codicon-rocket"></i>
          </div>
        </div>
      </div>

      <!-- 左侧边栏 -->
      <div class="sidebar" v-if="activeView">
        <div class="sidebar-header">
          <span v-if="activeView === 'files'">文件浏览器</span>
          <span v-else-if="activeView === 'git'">版本管理</span>
          <span v-else-if="activeView === 'publish'">发布</span>
        </div>
        <div class="sidebar-content">
          <!-- 文件浏览器 -->
          <div v-if="activeView === 'files'">
            <button @click="openProject" class="open-folder-btn">
              打开项目文件夹
            </button>
            <NodeTree :nodes="openedFiles" title="打开的编辑器" />
            <NodeTree v-if="projectPath" :nodes="fileTree" :title="projectName"
              @node-dblclick="node => handleOpenFile(node.key)"
              @node-toggle="handleNodeToggle"
              v-model:selected="selectedFiles" />
            <NodeTree :nodes="fileTree" title="时间线" />
          </div>

          <!-- 版本管理 -->
          <div v-else-if="activeView === 'git'">
            <p class="placeholder">Git 功能开发中...</p>
          </div>

          <!-- 发布 -->
          <div v-else-if="activeView === 'publish'">
            <p class="placeholder">发布功能开发中...</p>
          </div>
        </div>
      </div>

      <!-- 编辑器区域 -->
      <div class="editor-container">
        <div class="editor-tabs" v-if="openedFiles.length > 0">
          <div v-for="file in openedFiles" :key="file.key" class="editor-tab"
            :class="{ active: currentFile === file.key }" @click="currentFile = file.key">
            {{ file.name }}
            <span class="tab-close" @click.stop="closeFile(file.key)">×</span>
          </div>
        </div>
        <div class="editor-content">
          <div v-if="!currentFile" class="welcome-screen">
            <h1>OpenCard</h1>
            <p>打开项目文件夹开始编辑</p>
          </div>
          <component v-else :is="currentEditorComponent" v-bind="currentEditorProps" @save="saveCurrentFile" />
        </div>
      </div>

      <!-- 右侧预览面板 
      <div class="preview-panel" v-if="showPreview && previewCardDoc">
        <div class="preview-header">
          <span>卡牌预览</span>
          <i class="codicon codicon-close" @click="showPreview = false"></i>
        </div>
        <div class="preview-content">
          <CardRenderer ref="liveCardRendererRef" :document="previewCardDoc" />
        </div>
      </div>-->
    </div>

    <!-- 底部状态栏 -->
    <div class="status-bar">
      <div class="status-left">
        <span v-if="projectPath">
          <i class="codicon codicon-folder-opened"></i> {{ projectPath }}
        </span>
        <span v-if="isWatching" class="status-watching">
          <i class="codicon codicon-eye"></i> 监听中
        </span>
      </div>
      <div class="status-right">
        <span v-if="currentFile">{{ currentLanguage }}</span>
      </div>
    </div>

    <!-- 隐藏的卡牌渲染器 -->
    <div v-if="showCardPreview" style="position: fixed; top: -9999px; left: -9999px;">
      <CardRenderer v-if="previewCardDoc" ref="cardRendererRef" :document="previewCardDoc" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useProjectStore } from '../stores/projectStore'
import MonacoEditor from '../components/editors/MonacoEditor.vue'
import { ITreeNode } from '../components/ui/TreeNode.vue'
import NodeTree from '../components/ui/NodeTree.vue'
import type { NodeTreeTogglePayload } from '../components/ui/NodeTree.vue'
import CardRenderer from '../components/card/CardRenderer.vue'
import { editorRegistry } from '../core/Editor'
import type { CardDocument } from '../core/Card'
import { toPng } from 'dom-to-image-more'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'

type OpenedFileNode = ITreeNode & {
  metadata: {
    content: any
    isModified?: boolean
  }
}

const {
  projectPath,
  indexedEntries,
  isWatching,
  openProject: openProjectFn,
  isDirectoryExpanded,
  readDirectoryEntries,
  readFile,
  saveFile,
  setDirectoryExpanded,
} = useProjectStore()

const activeView = ref<'files' | 'git' | 'publish' | null>('files')
const openedFiles = ref<Array<OpenedFileNode>>([])
const currentFile = ref<string>('')
const currentContent = ref<string>('')

const selectedFiles = ref<Map<string, ITreeNode>>(new Map())
const cardRendererRef = ref<InstanceType<typeof CardRenderer>>()
const showCardPreview = ref(false)
const showPreview = ref(false)
const previewCardDoc = ref<CardDocument | null>(null)

const projectName = computed(() => {
  if (!projectPath.value) return ''
  return projectPath.value.split(/[/\\]/).pop() || ''
})

const currentLanguage = computed(() => {
  if (!currentFile.value) return ''
  const ext = currentFile.value.split('.').pop()
  const langMap: Record<string, string> = {
    'json': 'json',
    'opencard': 'json',  // opencard 文件也用 JSON 语法高亮
    'ts': 'typescript',
    'js': 'javascript',
    'vue': 'vue',
    'md': 'markdown',
    'txt': 'plaintext'
  }
  return langMap[ext || ''] || 'plaintext'
})

const currentEditorComponent = computed(() => {
  if (!currentFile.value) return null
  const editor = editorRegistry.getEditorByPath(currentFile.value)
  return editor?.component ?? MonacoEditor
})

// 根据编辑器类型传不同的 props
// 方案 B 编辑器（如 CardDesignEditor）只需要 filePath
// 旧式编辑器（如 MonacoEditor）还需要 modelValue + language
const currentEditorProps = computed(() => {
  const editor = editorRegistry.getEditorByPath(currentFile.value)
  if (editor && editor.id !== 'monaco') {
    return { filePath: currentFile.value }
  }
  return {
    modelValue: currentContent.value,
    'onUpdate:modelValue': (v: string) => { currentContent.value = v },
    language: currentLanguage.value
  }
})

// 监听内容变化，自动更新预览
watch(currentContent, (newContent) => {
  if (!newContent) {
    showPreview.value = false
    previewCardDoc.value = null
    return
  }

  // 检查是否是 JSON 或 opencard 文件
  const ext = currentFile.value.split('.').pop()
  if (ext !== 'json' && ext !== 'opencard') {
    showPreview.value = false
    previewCardDoc.value = null
    return
  }

  try {
    const cardDoc: CardDocument = JSON.parse(newContent)
    previewCardDoc.value = cardDoc
    showPreview.value = true
  } catch (error) {
    // JSON 解析失败，隐藏预览
    showPreview.value = false
    previewCardDoc.value = null
  }
})


const fileTree = computed(() => {
  if (!indexedEntries.value.length) return []

  const root: ITreeNode[] = []
  const map = new Map<string, ITreeNode>()

  // 先创建所有节点
  indexedEntries.value.forEach(file => {
    const relativePath = file.name
    const fullPath = `${projectPath.value}/${relativePath}`
    const parts = relativePath.split(/[/\\]/)
    const displayName = parts[parts.length - 1]

    const node: ITreeNode = {
      name: displayName,
      key: fullPath,
      isExpandable: file.isDirectory || false,
      isExpanded: file.isDirectory ? isDirectoryExpanded(fullPath) : false,
      children: file.isDirectory ? [] : undefined
    }
    map.set(relativePath, node)
  })

  // 构建树形结构
  indexedEntries.value.forEach(file => {
    const relativePath = file.name
    const node = map.get(relativePath)
    if (!node) return

    const parts = relativePath.split(/[/\\]/)
    if (parts.length === 1) {
      // 根目录文件
      root.push(node)
    } else {
      // 子文件，找到父节点
      const parentRelativePath = parts.slice(0, -1).join('/')
      const parent = map.get(parentRelativePath)
      if (parent && parent.children) {
        parent.children.push(node)
      }
    }
  })

  return root
})

async function debugLog(message: string) {
  console.log(`[DEBUG] ${message}`)

  // 渲染当前 JSON 为卡牌并保存
  if (!currentContent.value) {
    console.error('没有打开的文件')
    return
  }

  try {
    // 解析 JSON
    const cardDoc: CardDocument = JSON.parse(currentContent.value)
    console.log('解析的卡牌文档:', cardDoc)

    // 显示预览
    previewCardDoc.value = cardDoc
    showCardPreview.value = true

    // 等待 DOM 更新
    await nextTick()

    // 获取 canvas 元素
    const canvasElement = cardRendererRef.value?.getCanvasElement()
    if (!canvasElement) {
      console.error('无法获取 canvas 元素')
      return
    }

    // 转换为图片
    console.log('正在渲染图片...')
    const dataUrl = await toPng(canvasElement, {
      width: cardDoc.width,
      height: cardDoc.height,
      pixelRatio: 2 // 2x DPI
    })

    // 选择保存位置
    const savePath = await save({
      defaultPath: 'card.png',
      filters: [{
        name: 'PNG Image',
        extensions: ['png']
      }]
    })

    if (!savePath) {
      console.log('用户取消保存')
      return
    }

    // 将 base64 转换为 Uint8Array
    const base64Data = dataUrl.split(',')[1]
    const binaryData = atob(base64Data)
    const bytes = new Uint8Array(binaryData.length)
    for (let i = 0; i < binaryData.length; i++) {
      bytes[i] = binaryData.charCodeAt(i)
    }

    // 保存文件
    await writeFile(savePath, bytes)
    console.log('图片已保存到:', savePath)

    // 隐藏预览
    showCardPreview.value = false
    previewCardDoc.value = null

  } catch (error) {
    console.error('渲染失败:', error)
  }
}

async function openProject() {
  await openProjectFn()

}

async function handleOpenFile(path: string) {
  // 检查是否已打开
  debugLog(`尝试打开文件: ${path}`)
  const existing = openedFiles.value.find(f => f.key === path)
  if (existing) {
    currentFile.value = path
    currentContent.value = existing.metadata.content
    return
  }

  // 读取文件内容
  try {
    // path 已经是完整路径，直接读取
    const content = await readFile(path)
    const name = path.split(/[/\\]/).pop() || path
    openedFiles.value.push({
      key: path,
      name,
      isExpandable: false,
      metadata: { content, isModified: false }
    })
    currentFile.value = path
    currentContent.value = content
  } catch (error) {
    console.error('打开文件失败:', error)
  }
}

async function handleNodeToggle({ node, expanded }: NodeTreeTogglePayload) {
  if (!node.isExpandable) {
    return
  }

  setDirectoryExpanded(node.key, expanded)

  if (!expanded) {
    return
  }

  try {
    await readDirectoryEntries(node.key, 1)
  } catch (error) {
    console.error('加载目录失败:', error)
  }
}

function closeFile(path: string) {
  const index = openedFiles.value.findIndex(f => f.key === path)
  if (index !== -1) {
    openedFiles.value.splice(index, 1)
    if (currentFile.value === path) {
      currentFile.value = openedFiles.value[0]?.key || ''
      currentContent.value = openedFiles.value[0]?.metadata.content || ''
    }
  }
}

async function saveCurrentFile() {
  if (!currentFile.value) return

  const file = openedFiles.value.find(f => f.key === currentFile.value)
  if (!file) return

  const relativePath = file.key.replace(`${projectPath.value}/`, '')
  try {
    await saveFile(relativePath, currentContent.value)
    file.metadata.content = currentContent.value
    file.metadata.isModified = false
    console.log('文件已保存')
  } catch (error) {
    console.error('保存失败:', error)
  }
}
</script>

<style scoped>
.ide-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1e1e1e;
  color: #cccccc;
}

.menu-bar {
  height: 35px;
  background: #323233;
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-bottom: 1px solid #000;
}

.menu-items {
  display: flex;
  gap: 15px;
}

.menu-item {
  padding: 5px 10px;
  cursor: pointer;
  font-size: 13px;
}

.menu-item:hover {
  background: #2a2d2e;
}

.window-title {
  flex: 1;
  text-align: center;
  font-size: 12px;
  color: #888;
}

.main-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.activity-bar {
  width: 48px;
  background: #333333;
  border-right: 1px solid #000;
}

.activity-icons {
  display: flex;
  flex-direction: column;
  padding: 10px 0;
}

.activity-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 20px;
  position: relative;
}

.activity-icon:hover {
  background: #2a2d2e;
}

.activity-icon.active {
  background: #1e1e1e;
}

.activity-icon.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #007acc;
}

.sidebar {
  width: 250px;
  background: #252526;
  border-right: 1px solid #000;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  height: 35px;
  padding: 0 15px;
  display: flex;
  align-items: center;
  font-size: 11px;
  text-transform: uppercase;
  font-weight: bold;
  border-bottom: 1px solid #000;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.open-folder-btn {
  width: 100%;
  padding: 8px;
  background: #0e639c;
  color: white;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  font-size: 12px;
}

.open-folder-btn:hover {
  background: #1177bb;
}


.placeholder {
  color: #888;
  font-size: 12px;
  text-align: center;
  margin-top: 20px;
}

.editor-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-tabs {
  display: flex;
  background: #2d2d2d;
  border-bottom: 1px solid #000;
  overflow-x: auto;
}

.editor-tab {
  padding: 8px 15px;
  background: #2d2d2d;
  border-right: 1px solid #000;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.editor-tab:hover {
  background: #1e1e1e;
}

.editor-tab.active {
  background: #1e1e1e;
}

.tab-close {
  font-size: 18px;
  line-height: 1;
  opacity: 0.6;
}

.tab-close:hover {
  opacity: 1;
}

.editor-content {
  flex: 1;
  overflow: hidden;
}

.preview-panel {
  width: 450px;
  background: #1e1e1e;
  border-left: 1px solid #000;
  display: flex;
  flex-direction: column;
}

.preview-header {
  height: 35px;
  padding: 0 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  text-transform: uppercase;
  font-weight: bold;
  border-bottom: 1px solid #000;
  background: #252526;
}

.preview-header i {
  cursor: pointer;
  padding: 4px;
}

.preview-header i:hover {
  background: #2a2d2e;
}

.preview-content {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #2d2d2d;
}

.welcome-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
}

.welcome-screen h1 {
  font-size: 48px;
  font-weight: 300;
  margin-bottom: 20px;
}

.status-bar {
  height: 22px;
  background: #007acc;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  font-size: 12px;
  color: white;
}

.status-left,
.status-right {
  display: flex;
  gap: 15px;
}

.status-watching {
  animation: pulse 2s infinite;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}
</style>
