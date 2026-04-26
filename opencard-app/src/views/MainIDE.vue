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
    <MainIdeTopBar :project-name="projectName" :current-theme="currentTheme"
      :can-export-active-card="canExportActiveCard" @toggle-theme="toggleTheme" @open-playground="openPlayground"
      @export-active-card2x="exportActiveCard2x" @export-all-card-views="exportAllCardViews" />

    <div class="main-container">
      <MainIdeSidebarShell :active-view="activeView" @update:active-view="activeView = $event">
        <template #files>
          <OcButton @click="openProject" variant="primary" size="lg" block>
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
        </template>
      </MainIdeSidebarShell>

      <EditorWorkbenchFrame :sessions="sessions" :active-session-id="activeSessionId ?? null"
        :has-active-session="Boolean(activeSession)"
        :surface-mode="activeSession?.editorId === 'card-designer' ? 'immersive' : 'padded'"
        @select-session="activateSession" @close-session="closeFile" @open-project="openProject"
      >
        <component :is="currentEditorComponent" :key="currentEditorKey" ref="currentEditorRef"
          v-bind="currentEditorProps" @save="handleEditorSave"
          @update-viewport-transform="handleViewportTransformUpdate" />
      </EditorWorkbenchFrame>
    </div>

    <OcBar as="footer" kind="status" border="top">
      <template #start>
        <OcChip v-if="projectPath" icon="status.folderOpen" icon-tone="muted" truncate max-width="full">
          {{ projectPath }}
        </OcChip>
        <OcChip v-if="isWatching" tone="info" icon="status.watching" icon-tone="primary">
          {{ t('status.watching') }}
        </OcChip>
      </template>
      <template #end>
        <OcChip v-if="activeSession" :icon="currentLanguageIcon" :icon-tone="currentLanguageIconTone">
          {{ currentLanguage }}
        </OcChip>
      </template>
    </OcBar>

    <!-- 隐藏的导出渲染器 -->
    <div v-if="showExportRenderer" style="position: fixed; top: -9999px; left: -9999px;">
      <CardRenderer v-if="exportCardDoc" ref="exportRendererRef" :document="exportCardDoc" />
    </div>

    <FloatingMenuHost />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '../features/workspace/store/projectStore'
import { useEditorSessionStore } from '../features/workspace/store/editorSessionStore'
import MonacoEditor from '../components/editors/MonacoEditor.vue'
import NodeTree from '../components/ui/NodeTree.vue'
import FloatingMenuHost from '../components/ui/FloatingMenuHost.vue'
import { OcBar, OcButton, OcChip } from '../components/base'
import MainIdeTopBar from '../features/ide-shell/components/MainIdeTopBar.vue'
import MainIdeSidebarShell from '../features/ide-shell/components/MainIdeSidebarShell.vue'
import EditorWorkbenchFrame from '../features/ide-shell/components/EditorWorkbenchFrame.vue'
import type { NodeTreeDropPayload, NodeTreeRenamePayload, NodeTreeTogglePayload } from '../shared/ui/tree/tree.types'
import { getOcTheme, setOcTheme, type OcThemeId } from '../shared/ui/foundation'
import CardRenderer from '../components/card/CardRenderer.vue'
import { editorRegistry } from '../features/editor-runtime/registry/editorRegistry'
import { resolveFileType } from '../features/workspace/model/fileTypes'
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
const currentTheme = ref<OcThemeId>(getOcTheme())
const openedFilesTreeExpanded = ref(false)
const projectTreeExpanded = ref(true)
const timelineTreeExpanded = ref(false)
const exportRendererRef = ref<InstanceType<typeof CardRenderer>>()
const currentEditorRef = ref<CurrentEditorRef | null>(null)

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
  updateSessionUiState,
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

const currentLanguageIcon = computed(() => {
  if (!activeSession.value) return 'misc.code'
  return resolveFileType(activeSession.value.path).icon ?? 'misc.code'
})

const currentLanguageIconTone = computed(() => {
  if (!activeSession.value) return 'muted'
  return resolveFileType(activeSession.value.path).iconTone ?? 'muted'
})

const currentEditorComponent = computed(() => {
  if (!activeSession.value) return null
  const editor = editorRegistry.getEditor(activeSession.value.editorId)
  return editor?.component ?? MonacoEditor
})

const currentEditorKey = computed(() => {
  if (!activeSession.value) return 'none'
  return [
    activeSession.value.id,
    activeSession.value.path,
    activeSession.value.editorId,
  ].join('|')
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
    const baseProps = {
      filePath: activeSession.value.path,
      modelValue: activeSession.value.draftContent,
      'onUpdate:modelValue': (v: string) => { updateDraftContent(activeSession.value!.id, v) },
    }

    if (editor.id === 'card-designer') {
      return {
        ...baseProps,
        viewportTransform: activeSession.value.uiState?.cardDesigner?.viewportTransform,
      }
    }

    return baseProps
  }
  return {
    modelValue: activeSession.value.draftContent,
    'onUpdate:modelValue': (v: string) => { updateDraftContent(activeSession.value!.id, v) },
    language: currentLanguage.value
  }
})

function handleViewportTransformUpdate(value: { x: number; y: number; scale: number }) {
  const session = activeSession.value
  if (!session || session.editorId !== 'card-designer') {
    return
  }

  updateSessionUiState(session.id, {
    cardDesigner: {
      viewportTransform: value,
    },
  })
}

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

function openPlayground() {
  window.location.search = '?view=playground'
}

function toggleTheme() {
  const nextTheme: OcThemeId = currentTheme.value === 'dark' ? 'light' : 'dark'
  currentTheme.value = nextTheme
  setOcTheme(nextTheme)
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

.main-container {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
