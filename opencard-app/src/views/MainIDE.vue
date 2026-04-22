<!--
  使用说明：
  - 作为 IDE 壳层页面挂载项目树 编辑器区 状态栏与导出入口
  - 依赖 workspace store 与 editor session store 提供真相状态

  职责边界：
  - 负责页面布局 编排与交互意图转发
  - 不沉淀文件系统规则与会话生命周期规则

  主要输出事件：
  - 无 页面组件通过内部编排调用 store/composable
-->
<template>
  <div class="ide-layout">
    <!-- 顶部菜单栏 -->
    <div class="menu-bar">
      <OcToolbar class="menu-items" kind="menu" aria-label="Main menu">
        <OcToolButton kind="menu" :label="t('app.menu.file')" :disabled="true" />
        <OcToolButton kind="menu" :label="t('app.menu.edit')" :disabled="true" />
        <OcToolButton kind="menu" :label="t('app.menu.view')" :disabled="true" />
        <OcToolButton kind="menu" :label="t('app.menu.help')" :disabled="true" />
        <OcToolButton kind="menu" label="UI Kit" @click="openUiKitShowcase" />
        <OcToolButton kind="menu" :label="t('app.menu.export2x')" :disabled="!canExportActiveCard" @click="exportActiveCard2x" />
        <OcToolButton kind="menu" :label="t('app.menu.exportAll')" :disabled="!canExportActiveCard" @click="exportAllCardViews" />
      </OcToolbar>
      <div class="window-title">OpenCard</div>
    </div>

    <div class="main-container">
      <!-- 左侧活动栏 -->
      <div class="activity-bar">
        <OcToolbar class="activity-icons" kind="sidebar" aria-label="Activity bar">
          <OcToolButton
            class="activity-icon"
            kind="sidebar"
            icon-only
            :active="activeView === 'files'"
            :title="t('sidebar.files')"
            :aria-label="t('sidebar.files')"
            @click="activeView = 'files'"
          >
            <AppIcon name="app.files" tone="primary" />
          </OcToolButton>
          <OcToolButton
            class="activity-icon"
            kind="sidebar"
            icon-only
            :active="activeView === 'git'"
            :title="t('sidebar.git')"
            :aria-label="t('sidebar.git')"
            @click="activeView = 'git'"
          >
            <AppIcon name="app.git" tone="danger" />
          </OcToolButton>
          <OcToolButton
            class="activity-icon"
            kind="sidebar"
            icon-only
            :active="activeView === 'publish'"
            :title="t('sidebar.publish')"
            :aria-label="t('sidebar.publish')"
            @click="activeView = 'publish'"
          >
            <AppIcon name="app.publish" tone="warning" />
          </OcToolButton>
        </OcToolbar>
      </div>

      <!-- 左侧边栏 -->
      <OcPanelSection v-if="activeView" class="sidebar" header-class="sidebar-header" body-class="sidebar-content"
        :scroll-body="true">
        <template #title>
          <span v-if="activeView === 'files'">{{ t('sidebar.files') }}</span>
          <span v-else-if="activeView === 'git'">{{ t('sidebar.git') }}</span>
          <span v-else-if="activeView === 'publish'">{{ t('sidebar.publish') }}</span>
        </template>
        <template #default>
          <!-- 文件浏览器 -->
          <div v-if="activeView === 'files'">
            <OcButton @click="openProject" class="open-folder-btn" variant="primary">
              {{ t('sidebar.openProject') }}
            </OcButton>
            <NodeTree v-model:expanded="openedFilesTreeExpanded" :nodes="openedFileNodes"
              :title="t('sidebar.openedEditors')" :selected-keys="openedEditorSelectedKeys"
              @update:selected-keys="handleOpenedEditorsSelect" />
            <NodeTree v-if="projectPath" :nodes="fileTree" :title="projectName" v-model:expanded="projectTreeExpanded"
              :allowed-drop-positions="getFileTreeAllowedDropPositions" :can-drop="canMoveEntryByDrop"
              @node-drop="handleFileTreeDrop" @node-rename="handleFileTreeRename"
              @node-dblclick="node => handleOpenFile(node.key)" @node-toggle="handleNodeToggle"
              :selected-keys="selectedFileKeys" @update:selected-keys="handleFileTreeSelect" />
            <NodeTree v-model:expanded="timelineTreeExpanded" :nodes="fileTree" :title="t('sidebar.timeline')" />
          </div>

          <!-- 版本管理 -->
          <div v-else-if="activeView === 'git'">
            <p class="placeholder placeholder--empty">{{ t('panels.gitPlaceholder') }}</p>
          </div>

          <!-- 发布 -->
          <div v-else-if="activeView === 'publish'">
            <p class="placeholder placeholder--empty">{{ t('panels.publishPlaceholder') }}</p>
          </div>
        </template>
      </OcPanelSection>

      <!-- 编辑器区域 -->
      <div class="editor-container">
        <OcTabBar v-if="sessions.length > 0" class="editor-tabs" :aria-label="t('sidebar.openedEditors')">
          <OcTab
            v-for="session in sessions"
            :key="session.id"
            :label="session.name"
            :title="session.name"
            :active="activeSessionId === session.id"
            :dirty="Boolean(session.isDirty)"
            :closable="true"
            :close-aria-label="`Close ${session.name}`"
            @select="activateSession(session.id)"
            @close="closeFile(session.id)"
          />
        </OcTabBar>
        <div class="editor-content">
          <div v-if="!activeSession" class="welcome-screen">
            <h1>{{ t('app.welcome.title') }}</h1>
            <p class="welcome-subtitle">{{ t('app.welcome.subtitle') }}</p>
          </div>
          <component v-else :is="currentEditorComponent" ref="currentEditorRef" v-bind="currentEditorProps"
            @save="handleEditorSave" />
        </div>
      </div>

      <!-- 右侧预览面板 
      <div class="preview-panel" v-if="showPreview && previewCardDoc">
        <div class="preview-header">
          <span>{{ t('panels.cardPreview') }}</span>
          <AppIcon name="app.close" @click="showPreview = false" />
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
          <AppIcon name="status.folderOpen" /> {{ projectPath }}
        </span>
        <span v-if="isWatching" class="status-watching">
          <AppIcon name="status.watching" /> {{ t('status.watching') }}
        </span>
      </div>
      <div class="status-right">
        <span v-if="activeSession">{{ currentLanguage }}</span>
      </div>
    </div>

    <!-- 隐藏的导出渲染器 -->
    <div v-if="showExportRenderer" style="position: fixed; top: -9999px; left: -9999px;">
      <CardRenderer v-if="exportCardDoc" ref="exportRendererRef" :document="exportCardDoc" />
    </div>

    <FloatingMenuHost />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '../features/workspace/store/projectStore'
import { useEditorSessionStore } from '../features/workspace/store/editorSessionStore'
import MonacoEditor from '../components/editors/MonacoEditor.vue'
import NodeTree from '../components/ui/NodeTree.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import FloatingMenuHost from '../components/ui/FloatingMenuHost.vue'
import OcButton from '../components/base/OcButton.vue'
import OcPanelSection from '../components/base/OcPanelSection.vue'
import OcTab from '../components/base/OcTab.vue'
import OcTabBar from '../components/base/OcTabBar.vue'
import OcToolButton from '../components/base/OcToolButton.vue'
import OcToolbar from '../components/base/OcToolbar.vue'
import type { NodeTreeDropPayload, NodeTreeRenamePayload, NodeTreeTogglePayload } from '../shared/ui/tree/tree.types'
import CardRenderer from '../components/card/CardRenderer.vue'
import { editorRegistry } from '../features/editor-runtime/registry/editorRegistry'
import { resolveFileType } from '../features/workspace/model/fileTypes'
import {
  prepareDocumentForRender,
  type CardDocument,
} from '../entities/card/model'
import { useIdeExport } from '../features/ide-shell/composables/useIdeExport'
import { useIdeFileTree } from '../features/ide-shell/composables/useIdeFileTree'

const { t } = useI18n()
type CurrentEditorRef = {
  save?: () => Promise<void> | void
  undo?: () => Promise<void> | void
  redo?: () => Promise<void> | void
  canUndo?: boolean
  canRedo?: boolean
}

const {
  projectPath,
  indexedEntries,
  isWatching,
  openProject: openProjectFn,
  isDirectoryExpanded,
  readDirectoryEntries,
  getFileTreeAllowedDropPositions,
  canMoveEntryByDrop,
  moveEntryByDrop,
  renameEntry,
  setDirectoryExpanded,
} = useProjectStore()

const activeView = ref<'files' | 'git' | 'publish' | null>('files')
const openedFilesTreeExpanded = ref(false)
const projectTreeExpanded = ref(true)
const timelineTreeExpanded = ref(false)
const exportRendererRef = ref<InstanceType<typeof CardRenderer>>()
const currentEditorRef = ref<CurrentEditorRef | null>(null)
const showPreview = ref(false)
const previewCardDoc = ref<CardDocument | null>(null)

const {
  sessions,
  activeSessionId,
  activeSession,
  openedFileNodes,
  openFile: openEditorSession,
  openPreviewFile,
  activateSession,
  activatePath,
  updateDraftContent,
  closeSession,
  saveActiveSession,
  remapSessionPaths,
} = useEditorSessionStore()

const activeSessionPath = computed(() => activeSession.value?.path ?? null)

const {
  canExportActiveCard,
  showExportRenderer,
  exportCardDoc,
  exportActiveCard2x,
  exportAllCardViews,
} = useIdeExport({
  activeSession,
  exportRendererRef,
  translate: t,
})

const {
  fileTree,
  selectedFileKeys,
  openedEditorSelectedKeys,
  handleOpenedEditorsSelect,
  handleFileTreeSelect,
  findTreeNodeByKey,
} = useIdeFileTree({
  projectPath,
  indexedEntries,
  openedFileNodes,
  activeSessionPath,
  isDirectoryExpanded,
  activatePath,
  openPreviewFile,
})

const projectName = computed(() => {
  if (!projectPath.value) return ''
  return projectPath.value.split(/[/\\]/).pop() || ''
})

const currentLanguage = computed(() => {
  if (!activeSession.value) return ''
  return resolveFileType(activeSession.value.path).language ?? 'plaintext'
})

const currentEditorComponent = computed(() => {
  if (!activeSession.value) return null
  const editor = editorRegistry.getEditor(activeSession.value.editorId)
  return editor?.component ?? MonacoEditor
})

// 根据编辑器类型传不同的 props
// 方案 B 编辑器（如 CardDesignEditor）只需要 filePath
// 旧式编辑器（如 MonacoEditor）还需要 modelValue + language
const currentEditorProps = computed(() => {
  if (!activeSession.value) {
    return {}
  }

  const fileType = resolveFileType(activeSession.value.path)
  const editor = editorRegistry.getEditor(fileType.editorId)
  if (editor && editor.id !== 'monaco') {
    return {
      filePath: activeSession.value.path,
      modelValue: activeSession.value.draftContent,
      'onUpdate:modelValue': (v: string) => { updateDraftContent(activeSession.value!.id, v) },
    }
  }
  return {
    modelValue: activeSession.value.draftContent,
    'onUpdate:modelValue': (v: string) => { updateDraftContent(activeSession.value!.id, v) },
    language: currentLanguage.value
  }
})

// 监听内容变化，自动更新预览
watch(() => activeSession.value?.draftContent ?? '', (newContent) => {
  if (!newContent) {
    showPreview.value = false
    previewCardDoc.value = null
    return
  }

  const fileType = resolveFileType(activeSession.value?.path ?? '')
  if (!fileType.previewable) {
    showPreview.value = false
    previewCardDoc.value = null
    return
  }

  try {
    const cardDoc = prepareDocumentForRender(JSON.parse(newContent) as CardDocument)
    previewCardDoc.value = cardDoc
    showPreview.value = true
  } catch (error) {
    // JSON 解析失败，隐藏预览
    showPreview.value = false
    previewCardDoc.value = null
  }
})

async function handleFileTreeDrop(payload: NodeTreeDropPayload) {
  const result = await moveEntryByDrop(payload)
  if (!result.ok) {
    if (result.reason !== 'same-path') {
      console.error('移动文件失败:', result.reason)
    }
    return
  }

  remapSessionPaths(result.fromPath, result.toPath)
  selectedFileKeys.value = []
}

async function handleFileTreeRename({ node, name }: NodeTreeRenamePayload) {
  const result = await renameEntry(node.key, name)
  if (!result.ok) {
    if (result.reason !== 'same-path') {
      console.error('重命名文件失败:', result.reason)
    }
    return
  }

  remapSessionPaths(result.fromPath, result.toPath)
  const renamedNode = findTreeNodeByKey(fileTree.value, result.toPath)
  selectedFileKeys.value = renamedNode ? [renamedNode.key] : []
}

async function openProject() {
  await openProjectFn()

}

async function handleOpenFile(path: string) {
  try {
    await openEditorSession(path)
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

async function handleEditorSave() {
  if (!activeSession.value) {
    return
  }

  try {
    await saveActiveSession()
  } catch (error) {
    console.error('同步编辑器保存结果失败:', error)
  }
}

async function triggerCurrentEditorSave() {
  const currentPath = activeSession.value?.path
  if (!currentPath) {
    return
  }

  const editor = editorRegistry.getEditor(activeSession.value.editorId)

  if (editor?.id !== 'monaco' && currentEditorRef.value?.save) {
    await currentEditorRef.value.save()
    return
  }

  await saveActiveSession()
}

function isActiveCardDesignerEditor() {
  const editorId = activeSession.value?.editorId
  if (!editorId) {
    return false
  }

  return editorRegistry.getEditor(editorId)?.id === 'card-designer'
}

async function triggerCurrentEditorUndo() {
  if (!isActiveCardDesignerEditor()) {
    return
  }

  if (currentEditorRef.value?.canUndo === false || !currentEditorRef.value?.undo) {
    return
  }

  await currentEditorRef.value.undo()
}

async function triggerCurrentEditorRedo() {
  if (!isActiveCardDesignerEditor()) {
    return
  }

  if (currentEditorRef.value?.canRedo === false || !currentEditorRef.value?.redo) {
    return
  }

  await currentEditorRef.value.redo()
}

async function handleGlobalKeydown(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey)) {
    return
  }

  const key = event.key.toLowerCase()
  if (key === 's') {
    event.preventDefault()
    await triggerCurrentEditorSave()
    return
  }

  if (key === 'z') {
    if (!isActiveCardDesignerEditor()) {
      return
    }

    event.preventDefault()
    if (event.shiftKey) {
      await triggerCurrentEditorRedo()
      return
    }

    await triggerCurrentEditorUndo()
    return
  }

  if (key === 'y') {
    if (!isActiveCardDesignerEditor()) {
      return
    }

    event.preventDefault()
    await triggerCurrentEditorRedo()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})

function openUiKitShowcase() {
  window.location.search = '?view=ui-kit'
}

function closeFile(sessionId: string) {
  closeSession(sessionId)
}
</script>

<style scoped>
.ide-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--oc-bg-base);
  color: var(--oc-text-primary);
}

.menu-bar {
  height: 35px;
  background: var(--oc-bg-app-chrome);
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-bottom: 1px solid var(--oc-border-strong);
}

.menu-items {
  min-width: 0;
}

.window-title {
  flex: 1;
  text-align: center;
  font-size: 12px;
  color: var(--oc-text-muted);
}

.main-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.activity-bar {
  width: 48px;
  background: var(--oc-bg-sidebar);
  border-right: 1px solid var(--oc-border-strong);
}

.activity-icons {
  padding: 10px 0;
}

.sidebar {
  width: 250px;
  background: var(--oc-bg-panel);
  border-right: 1px solid var(--oc-border-strong);
}

.sidebar-header {
  padding: 0 15px;
  min-height: 35px;
}

.sidebar-content {
  padding: 10px;
}

.open-folder-btn {
  width: 100%;
  border: none;
  border-radius: 2px;
  font-size: 12px;
}

.open-folder-btn:hover {
  border-color: transparent;
}

.editor-container {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.editor-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.preview-panel {
  width: 450px;
  background: var(--oc-bg-base);
  border-left: 1px solid var(--oc-border-strong);
  display: flex;
  flex-direction: column;
}

.preview-header {
  padding: 0 15px;
  min-height: 35px;
}

.preview-header i {
  cursor: pointer;
  padding: 4px;
}

.preview-header i:hover {
  background: var(--oc-bg-hover);
}

.preview-content {
  flex: 1;
}

.welcome-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--oc-text-muted);
}

.welcome-screen h1 {
  font-size: 48px;
  font-weight: 300;
  margin-bottom: 20px;
}

.welcome-subtitle,
.placeholder--empty {
  color: var(--oc-text-dim);
  font-size: var(--oc-body-size);
  text-align: center;
  padding: 20px;
}

.status-bar {
  height: 22px;
  background: var(--oc-accent);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  font-size: 12px;
  color: var(--oc-accent-contrast);
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
