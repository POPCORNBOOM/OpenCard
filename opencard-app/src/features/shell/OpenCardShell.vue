<!--
  使用说明：
  - 作为 OpenCard 壳层页面挂载项目树 编辑器区 问题面板与导出入口
  - 依赖 workspace store 与 editor session store 提供真相状态

  职责边界：
  - 负责页面布局 编排与交互意图转发
  - 不沉淀文件系统规则与会话生命周期规则

  主要输出事件：
  - 无 页面组件通过内部编排调用 store/composable
-->
<template>
  <main class="shell-root open-card-shell" :class="themeClass">
    <ShellTitleBar
      :collapsed="effectiveSidebarCollapsed"
      brand-label="OPENCARD"
      brand-logo-src="/icon_v2.png"
      :menu-groups="titleBarMenus"
      :app-actions="titleBarAppActions"
      :window-controls="windowControls"
      :native-macos-controls="usesNativeMacosWindowControls"
      :collapse-tooltip="t('app.shell.collapseSidebar')"
      :expand-tooltip="t('app.shell.expandSidebar')"
      :drag-region="!isWindowFullscreen"
      @toggle-sidebar="toggleSidebarCollapsed"
      @menu-action="handleTitleBarMenuAction"
      @app-action="handleTitleBarAppAction"
      @window-control="handleWindowControl"
    />

    <div class="shell-main" :class="{ 'shell-main-collapsed': effectiveSidebarCollapsed }" :style="shellMainStyle">
      <ShellSidebar
        :collapsed="effectiveSidebarCollapsed"
        :width="sidebarWidth"
        :head-buttons="sidebarHeadButtons"
        :body-lists="sidebarBodyLists"
        :tail-buttons="sidebarTailButtons"
        :min-resize-width="SIDEBAR_AUTO_COLLAPSE_WIDTH"
        @head-button-clicked="runShellCommand"
        @list-button-clicked="handleSidebarListAction"
        @tail-button-clicked="runShellCommand"
        @resize="handleSidebarResize"
      >
        <template #list-content="{ list }">
          <OcTree
            v-if="list.key === BUILTIN_TEMPLATES_LIST_KEY && builtinTemplateTreeData.rootKeys.length > 0"
            class="open-card-shell__sidebar-tree"
            :data="builtinTemplateTreeData"
            :selected-keys="builtinSelectedTemplateKeys"
            role="listbox"
            selection-mode="single"
            activation-mode="none"
            @intent="handleTemplateTreeIntent"
          />
          <OcTree
            v-else-if="list.key === USER_TEMPLATES_LIST_KEY && userTemplateTreeData.rootKeys.length > 0"
            class="open-card-shell__sidebar-tree"
            :data="userTemplateTreeData"
            :selected-keys="userSelectedTemplateKeys"
            role="listbox"
            selection-mode="single"
            activation-mode="none"
            @intent="handleTemplateTreeIntent"
          />
          <OcTree
            v-else-if="list.key === SETTINGS_CATEGORIES_LIST_KEY"
            class="open-card-shell__sidebar-tree"
            :data="settingsCategoryTreeData"
            :selected-keys="[settingsCategoryKey]"
            role="listbox"
            selection-mode="single"
            activation-mode="none"
            @intent="handleSettingsCategoryTreeIntent"
          />
          <OcTree
            v-else-if="list.key === RECENT_PROJECTS_LIST_KEY && recentProjectTreeData.rootKeys.length > 0"
            class="open-card-shell__sidebar-tree"
            :data="recentProjectTreeData"
            :actions="recentProjectActions"
            :selected-keys="selectedRecentProjectKeys"
            role="listbox"
            selection-mode="single"
            activation-mode="double-click"
            @intent="handleRecentProjectTreeIntent"
          />
          <OcTree
            v-else-if="list.key === OPENED_EDITORS_LIST_KEY && openedEditorTreeData.rootKeys.length > 0"
            class="open-card-shell__sidebar-tree"
            :data="openedEditorTreeData"
            :actions="openedEditorActions"
            :selected-keys="openedEditorSelectedKeys"
            role="listbox"
            selection-mode="single"
            activation-mode="none"
            @intent="handleOpenedEditorTreeIntent"
          />
          <OcTree
            v-else-if="list.key === TEMPLATE_ENTRIES_LIST_KEY && exportTemplateEntryTreeData.rootKeys.length > 0"
            class="open-card-shell__sidebar-tree"
            :data="exportTemplateEntryTreeData"
            :actions="exportTemplateTreeActions"
            :selected-keys="[]"
            role="listbox"
            selection-mode="none"
            activation-mode="none"
            @intent="handleExportSelectionTreeIntent"
          />
          <OcTree
            v-else-if="list.key === TEMPLATE_COVERS_LIST_KEY && exportTemplateCoverTreeData.rootKeys.length > 0"
            class="open-card-shell__sidebar-tree"
            :data="exportTemplateCoverTreeData"
            :actions="exportTemplateTreeActions"
            :selected-keys="[]"
            role="listbox"
            selection-mode="none"
            activation-mode="none"
            @intent="handleExportSelectionTreeIntent"
          />
          <OcTree
            v-else-if="list.key === PROJECT_FILES_LIST_KEY && projectTreeData.rootKeys.length > 0"
            ref="projectTreeRef"
            class="open-card-shell__sidebar-tree"
            :data="isExportTemplateMode ? exportTemplateTreeData : projectTreeData"
            :actions="isExportTemplateMode ? exportTemplateTreeActions : projectEntryActions"
            :selected-keys="selectedFileKeys"
            :expanded-keys="isExportTemplateMode ? exportTemplateExpandedKeys : projectExpandedKeys"
            role="tree"
            selection-mode="single"
            :activation-mode="isExportTemplateMode ? 'none' : 'double-click'"
            @intent="isExportTemplateMode ? handleExportTemplateTreeIntent($event) : handleProjectTreeIntent($event)"
          />
          <div v-else class="shell-sidebar-empty">
            <OcButton
              v-if="list.key === PROJECT_FILES_LIST_KEY && !projectPath && !effectiveSidebarCollapsed"
              icon="status.folder-open"
              size="sm"
              variant="ghost"
              @click="openProject"
            >
              {{ list.placeholder }}
            </OcButton>
            <span v-else>{{ list.placeholder }}</span>
          </div>
        </template>
      </ShellSidebar>

      <ShellWorkspaceFrame
        :title="workspaceTitle"
        :actions="workspaceActions"
        lock-body-scroll
        flush-body
        @action="handleWorkspaceFrameAction"
      >
        <div class="open-card-shell__workspace-stack">
          <div class="open-card-shell__workbench">
            <CreateProjectWorkspace
              v-if="isCreateProjectMode"
              ref="createProjectWorkspaceRef"
              :activation-error="projectActivationError"
              :external-busy="isActivatingProject"
              :selected-key="selectedTemplateKey"
              @created="handleProjectCreated"
              @update:busy="isCreateProjectOperationBusy = $event"
              @update:selected-key="selectedTemplateKey = $event"
            />
            <ExportTemplateWorkspace
              v-else-if="isExportTemplateMode && projectPath"
              ref="exportTemplateWorkspaceRef"
              :project-path="projectPath"
              @selection-change="exportTemplateSelection = $event"
              @update:busy="isExportTemplateBusy = $event"
            />
            <SettingsWorkspace
              v-else-if="isSettingsMode"
              :view-model="activeSettingsCategory"
              :native-macos-controls="usesNativeMacosWindowControls"
              @intent="handleSettingsIntent"
            />
            <AboutWorkspace
              v-else-if="isAboutMode"
              @back="showPrimaryShellPage(getCurrentPrimaryShellPage())"
            />
            <WelcomeWorkspace
              v-else-if="isWelcomeMode"
              @new-project="openCreateProject"
              @open-project="openProject"
            />
            <WorkbenchWorkspace v-else-if="isWorkbenchMode" :has-active-editor="Boolean(activeSession)">
              <component
                v-if="activeSession"
                :is="currentEditorComponent"
                :key="currentEditorKey"
                ref="currentEditorRef"
                v-bind="currentEditorProps"
                @modified="handleEditorModified"
                @save="handleEditorSave"
                @open-file="handleOpenFile"
                @update-viewport-transform="handleViewportTransformUpdate"
                @update-card-designer-layout="handleCardDesignerLayoutUpdate"
                @update-card-designer-view="handleCardDesignerViewUpdate"
                @issue-snapshot="handleEditorIssueSnapshot(activeSession.id, $event)"
              />
            </WorkbenchWorkspace>
          </div>

          <WorkspaceBottomPanel
            :expanded="isBottomPanelExpanded"
            :active-tab="activeBottomTab"
            :issue-count="visibleIssueCount"
            :issue-severity="visibleIssueSeverity"
            :issue-tree-data="visibleIssueTreeData"
            :issue-navigation-targets="issueNavigationTargets"
            :expanded-issue-keys="expandedIssueKeys"
            :output-lines="workspaceOutputLines"
            :issues-label="t('app.problems.tab')"
            :output-label="t('app.problems.outputTab')"
            :issue-empty-label="t('app.problems.empty')"
            :output-empty-label="t('app.problems.outputEmpty')"
            :expand-label="t('app.shell.expandBottomPanel')"
            :collapse-label="t('app.shell.collapseBottomPanel')"
            :pin-label="t('app.shell.pinBottomPanel')"
            :unpin-label="t('app.shell.unpinBottomPanel')"
            @expanded-change="isBottomPanelExpanded = $event"
            @tab-change="activeBottomTab = $event"
            @issue-expansion-change="setIssueNodeExpanded"
            @issue-navigate="handleWorkspaceIssueNavigate"
          />
        </div>
      </ShellWorkspaceFrame>
    </div>

    <!-- 隐藏的导出渲染器 -->
    <div v-if="showExportRenderer" style="position: fixed; top: -9999px; left: -9999px;">
      <CardFaceRenderer
        v-if="exportCardFace"
        ref="exportRendererRef"
        :face="exportCardFace"
        :clip-to-face="true"
        :resource-root-path="activeSessionResourceRootPath"
      />
    </div>

    <div v-if="isShellFileDropActive" class="shell-file-drop-overlay" role="status" aria-live="polite">
      <OcIcon name="file.generic" size="lg" tone="opencard" />
      <span>{{ t('app.shell.dropFilesToOpen') }}</span>
    </div>

    <UnsavedEditorsDialog
      :open="isUnsavedEditorsDialogOpen"
      :intent-type="pendingCloseIntent?.type"
      :rows="unsavedEditorDecisions"
      :busy="isUnsavedCloseBusy"
      :global-error="unsavedCloseError"
      :selected-count="unsavedSelectedCount"
      :pending-count="unsavedPendingCount"
      :save-count="unsavedSaveCount"
      :discard-count="unsavedDiscardCount"
      :all-pending-selected="allUnsavedPendingSelected"
      :some-pending-selected="someUnsavedPendingSelected"
      :can-confirm="canConfirmUnsavedClose"
      @select-all="setAllUnsavedPendingSelected"
      @select-row="setUnsavedRowSelected"
      @mark-discard="markSelectedUnsavedDiscard"
      @mark-save="markSelectedUnsavedSave"
      @change-decision="resetUnsavedDecision"
      @cancel="cancelUnsavedClose"
      @confirm="confirmUnsavedClose"
    />

    <FloatingMenuHost />
  </main>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '../workspace/store/projectStore'
import {
  createDefaultOpenCardContent,
  useEditorSessionStore,
} from '../workspace/store/editorSessionStore'
import MonacoEditor from '../../components/editors/MonacoEditor.vue'
import FloatingMenuHost from '../../components/ui/FloatingMenuHost.vue'
import OcTree from '../../components/standard/OcTree.vue'
import type { OcActionMenuEntry } from '../../components/standard/OcActionMenu.vue'
import OcButton from '../../components/base/OcButton.vue'
import OcIcon from '../../components/base/OcIcon.vue'
import { getOcTheme } from '../../shared/ui/foundation'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent, OcTreeItem } from '../../shared/ui/tree/tree.types'
import type { CardDesignerLayoutState, CardDesignerViewState } from '../editor-runtime/model/editorUiState'
import SettingsWorkspace from '../settings/components/SettingsWorkspace.vue'
import CreateProjectWorkspace from '../project-templates/components/CreateProjectWorkspace.vue'
import ExportTemplateWorkspace from '../project-templates/components/ExportTemplateWorkspace.vue'
import WorkbenchWorkspace from './components/WorkbenchWorkspace.vue'
import WelcomeWorkspace from './components/WelcomeWorkspace.vue'
import AboutWorkspace from './components/AboutWorkspace.vue'
import WorkspaceBottomPanel, {
  type WorkspaceBottomTab,
} from './components/WorkspaceBottomPanel.vue'
import UnsavedEditorsDialog from './components/UnsavedEditorsDialog.vue'
import type {
  CreatedProject,
  ProjectTemplate,
  ProjectTemplateKey,
  TemplateExportSelection,
} from '../project-templates/model/projectTemplate'
import { useProjectTemplateStore } from '../project-templates/store/projectTemplateStore'
import { useSettingsWorkspace } from '../settings/composables/useSettingsWorkspace'
import { useAppSettingsStore } from '../settings/store/appSettingsStore'
import type { SettingsCategoryKey, SettingsIntent } from '../settings/model/appSettings'
import CardFaceRenderer from '../card-rendering/components/CardFaceRenderer.vue'
import { editorRegistry } from '../editor-runtime/registry/editorRegistry'
import type {
  EditorIssueSnapshot,
  EditorNavigationResult,
  SessionIssueNavigationRequest,
  SessionNavigationToken,
} from '../editor-runtime/model/editorIssue'
import { resolveFileType, resolveFileTypeById } from '../workspace/model/fileTypes'
import { useShellExport } from './composables/useShellExport'
import { useAppUpdater } from './composables/useAppUpdater'
import { useWorkspaceIssues } from './composables/useWorkspaceIssues'
import {
  useUnsavedSessionGuard,
  type UnsavedCloseIntent,
} from './composables/useUnsavedSessionGuard'
import { navigateWorkspaceIssue } from './services/workspaceIssueNavigation'
import {
  OPENED_EDITOR_CLOSE_ACTION_KEY,
  PROJECT_ENTRY_COPY_ABSOLUTE_PATH_ACTION_KEY,
  PROJECT_ENTRY_COPY_RELATIVE_PATH_ACTION_KEY,
  PROJECT_ENTRY_RENAME_ACTION_KEY,
  PROJECT_ENTRY_REVEAL_ACTION_KEY,
  isProjectEntryConfirmDeleteActionKey,
  projectEntryConfirmDeleteActionKey,
  projectEntryDeleteActionKey,
  projectEntryMoreActionKey,
  useShellFileTree,
} from './composables/useShellFileTree'
import { getCurrentWindow, type DragDropEvent } from '@tauri-apps/api/window'
import type { Event as TauriEvent } from '@tauri-apps/api/event'
import ShellSidebar from './components/ShellSidebar.vue'
import ShellTitleBar from './components/ShellTitleBar.vue'
import ShellWorkspaceFrame from './components/ShellWorkspaceFrame.vue'
import {
  classifyExternalOpenPath,
  filterSupportedExternalOpenPaths,
  listenForExternalOpenRequests,
} from './services/externalOpenService'
import { fileSystemService } from '../workspace/services/fileSystemService'
import type {
  ShellButton,
  ShellList,
  ShellTitleBarAppAction,
  ShellTitleBarMenuGroup,
  ShellTitleBarWindowControl,
} from './shell.types'
import {
  getPrimaryShellPage,
  resolveShellPageAfterProjectClose,
  type ProjectCloseDestination,
  type PrimaryShellPage,
  type ShellPage,
} from './shellPage'

const { t, locale } = useI18n()
const SIDEBAR_MIN_WIDTH = 220
const SIDEBAR_AUTO_COLLAPSE_WIDTH = 168
const PROJECT_FILES_LIST_KEY = 'project-files'
const OPENED_EDITORS_LIST_KEY = 'opened-editors'
const RECENT_PROJECTS_LIST_KEY = 'recent-projects'
const CHANGES_LIST_KEY = 'changes'
const SETTINGS_CATEGORIES_LIST_KEY = 'settings-categories'
const BUILTIN_TEMPLATES_LIST_KEY = 'builtin-templates'
const USER_TEMPLATES_LIST_KEY = 'user-templates'
const TEMPLATE_ENTRIES_LIST_KEY = 'template-entries'
const TEMPLATE_COVERS_LIST_KEY = 'template-covers'
const CREATE_TEMPLATE_ACTION_KEY = 'create-template'
const IMPORT_TEMPLATE_ACTION_KEY = 'import-template'
const RECENT_PROJECT_OPEN_ACTION_KEY = 'recent-project.open'
const RECENT_PROJECT_RELOCATE_ACTION_KEY = 'recent-project.relocate'
const RECENT_PROJECT_REMOVE_ACTION_KEY = 'recent-project.remove'
const TEMPLATE_EXCLUDE_ACTION_KEY = 'template.exclude'
const TEMPLATE_INCLUDE_ACTION_KEY = 'template.include'
const TEMPLATE_COVER_ADD_ACTION_KEY = 'template.cover.add'
const TEMPLATE_COVER_REMOVE_ACTION_KEY = 'template.cover.remove'
const TEMPLATE_ENTRY_ADD_ACTION_KEY = 'template.entry.add'
const TEMPLATE_ENTRY_REMOVE_ACTION_KEY = 'template.entry.remove'
const TEMPLATE_ENTRY_TREE_PREFIX = 'template-entry:'
const TEMPLATE_COVER_TREE_PREFIX = 'template-cover:'
const PROJECT_NEW_FILE_ACTION_KEY = 'project.new-file'
const PROJECT_NEW_OPENCARD_ACTION_KEY = 'project.new-file.opencard'
const PROJECT_NEW_PROFILE_ACTION_KEY = 'project.new-file.opencardprojectprofile'
const PROJECT_NEW_DICTIONARY_ACTION_KEY = 'project.new-file.dictionary'
const PROJECT_NEW_FOLDER_ACTION_KEY = 'project.new-folder'
const EMPTY_TREE_DATA: OcTreeData = {
  rootKeys: [],
  items: new Map(),
  children: new Map(),
}
const workspaceOutputLines: readonly string[] = []
const themeClass = 'shell-theme-graphite'

type CurrentEditorRef = {
  save?: () => Promise<void> | void
  flush?: () => Promise<void> | void
  undo?: () => Promise<void> | void
  redo?: () => Promise<void> | void
  canUndo?: boolean
  canRedo?: boolean
  navigate?: (token: SessionNavigationToken) => Promise<EditorNavigationResult> | EditorNavigationResult
}

const {
  projectPath,
  projectInformation,
  resolvedDictionary,
  indexedEntries,
  chooseProjectDirectory,
  openProject: openProjectFn,
  isProjectAvailable,
  setProjectPath,
  isDirectoryExpanded,
  readDirectoryEntries,
  setDirectoryExpanded,
  resetProjectWorkspaceState,
  createEntryWithAvailableName,
  createFile,
  trashFile,
  revealEntryInFileManager,
  getRelativeProjectPath,
  moveEntryByDrop,
  renameEntry,
} = useProjectStore()

const settingsStore = useAppSettingsStore()
const templateStore = useProjectTemplateStore()
const shellPage = ref<ShellPage>({ type: 'welcome' })
const isSettingsMode = computed(() => shellPage.value.type === 'settings')
const isCreateProjectMode = computed(() => shellPage.value.type === 'create-project')
const isExportTemplateMode = computed(() => shellPage.value.type === 'export-template')
const isAboutMode = computed(() => shellPage.value.type === 'about')
const isWelcomeMode = computed(() => shellPage.value.type === 'welcome')
const isWorkbenchMode = computed(() => shellPage.value.type === 'workbench')
const isAuxiliaryMode = computed(() => (
  isSettingsMode.value || isCreateProjectMode.value || isExportTemplateMode.value || isAboutMode.value
))

function getCurrentPrimaryShellPage(): PrimaryShellPage {
  return getPrimaryShellPage(shellPage.value)
}

function showPrimaryShellPage(page: PrimaryShellPage): void {
  shellPage.value = { type: page }
}
const selectedTemplateKey = ref<ProjectTemplateKey | null>(null)
const createProjectWorkspaceRef = ref<InstanceType<typeof CreateProjectWorkspace> | null>(null)
const exportTemplateWorkspaceRef = ref<InstanceType<typeof ExportTemplateWorkspace> | null>(null)
const exportTemplateSelection = ref<TemplateExportSelection>({
  excludedPaths: [],
  entries: [],
  entryNames: {},
  covers: [],
})
const projectActivationError = ref('')
const isActivatingProject = ref(false)
const isCreateProjectOperationBusy = ref(false)
const isExportTemplateBusy = ref(false)
const isBottomPanelExpanded = ref(false)
const isWindowFullscreen = ref(false)
const isWindowMaximized = ref(false)
const developerMode = ref(false)
const developerUpdateProgress = ref<number | null>(null)
let developerUpdateTimer: number | null = null
let restoreMaximizedAfterFullscreen = false
let isFullscreenTransitioning = false
const usesNativeMacosWindowControls = typeof navigator !== 'undefined'
  && /Macintosh|Mac OS X/.test(navigator.userAgent)
let unlistenWindowResize: (() => void) | null = null
let unlistenWindowClose: (() => void) | null = null
let unlistenExternalOpen: (() => void) | null = null
let unlistenShellFileDrop: (() => void) | null = null
const isShellFileDropActive = ref(false)
const activeBottomTab = ref<WorkspaceBottomTab>('issues')
const isProjectTemplateBusy = computed(() => (
  isActivatingProject.value || isCreateProjectOperationBusy.value
))
const settingsCategoryKey = computed<SettingsCategoryKey>(() =>
  shellPage.value.type === 'settings' ? shellPage.value.categoryKey : 'general'
)
const projectOpen = computed(() => Boolean(projectPath.value))
const { categoryTreeData: settingsCategoryTreeData, activeCategory: activeSettingsCategory } = useSettingsWorkspace({
  settings: settingsStore.settings,
  categoryKey: settingsCategoryKey,
  projectOpen,
  translate: t,
})

const sidebarCollapsed = computed(() => settingsStore.settings.value.shell.sidebarCollapsed)
const viewportWidth = ref(typeof window === 'undefined' ? 1440 : window.innerWidth)
const effectiveSidebarCollapsed = computed(() => (
  sidebarCollapsed.value || (viewportWidth.value < 960 && !isCreateProjectMode.value)
))
const sidebarWidth = computed(() => settingsStore.settings.value.shell.sidebarWidth)
const lastExpandedSidebarWidth = ref(sidebarWidth.value)
const exportRendererRef = ref<InstanceType<typeof CardFaceRenderer>>()
const currentEditorRef = ref<CurrentEditorRef | null>(null)
const projectTreeRef = ref<{ beginRename: (key: string) => Promise<void> } | null>(null)

const {
  availableUpdate,
  updateVersion,
  isChecking: isCheckingForUpdate,
  isInstalling: isInstallingUpdate,
  installProgress: updateInstallProgress,
  checkForUpdate,
  installAvailableUpdate,
  dispose: disposeAppUpdater,
} = useAppUpdater()

const {
  sessions,
  activeSession,
  openedEditorItems,
  openFile: openEditorSession,
  openPreviewFile,
  activateSession,
  createDraftSession,
  updateDraftContent,
  setSessionDirtyState,
  updateSessionUiState,
  closeSession,
  closeWorkspaceSessions,
  closeSessionsByPath,
  saveSession,
  saveActiveSession,
  remapSessionPaths,
} = useEditorSessionStore()

const {
  pendingIntent: pendingCloseIntent,
  decisions: unsavedEditorDecisions,
  isOpen: isUnsavedEditorsDialogOpen,
  isBusy: isUnsavedCloseBusy,
  globalError: unsavedCloseError,
  selectedCount: unsavedSelectedCount,
  pendingCount: unsavedPendingCount,
  saveCount: unsavedSaveCount,
  discardCount: unsavedDiscardCount,
  allPendingSelected: allUnsavedPendingSelected,
  somePendingSelected: someUnsavedPendingSelected,
  canConfirm: canConfirmUnsavedClose,
  requestClose: requestGuardedClose,
  setRowSelected: setUnsavedRowSelected,
  setAllPendingSelected: setAllUnsavedPendingSelected,
  markSelectedDiscard: markSelectedUnsavedDiscard,
  markSelectedSave: markSelectedUnsavedSave,
  resetDecision: resetUnsavedDecision,
  confirm: confirmUnsavedClose,
  cancel: cancelUnsavedClose,
} = useUnsavedSessionGuard({
  sessions,
  pickDraftDirectory: () => fileSystemService.pickDirectory(t('app.unsavedEditors.pickDraftDirectory')),
  fileExists: path => fileSystemService.fileExists(path),
  saveSession,
  completeClose: completeUnsavedClose,
})

function formatSessionTitle(session: { name: string; resourceKind: 'workspace' | 'external' | 'draft' }): string {
  if (session.resourceKind === 'external') {
    return t('sidebar.editorTitles.external', { name: session.name })
  }
  if (session.resourceKind === 'draft') {
    return t('sidebar.editorTitles.draft', { name: session.name })
  }
  return session.name
}

const localizedOpenedEditorItems = computed(() => openedEditorItems.value.map((item) => ({
  ...item,
  label: formatSessionTitle({ name: item.label, resourceKind: item.resourceKind }),
})))

function getPathDirectory(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/').replace(/\/+$/, '')
  const separatorIndex = normalizedPath.lastIndexOf('/')
  return separatorIndex > 0 ? normalizedPath.slice(0, separatorIndex) : ''
}

const activeSessionResourceRootPath = computed<string | null>(() => {
  const session = activeSession.value
  if (!session) return null
  if (session.resourceKind === 'workspace') return projectPath.value || null
  if (session.resourceKind === 'external' && session.path) return getPathDirectory(session.path) || null
  return null
})

const {
  issueTreeData,
  issueNavigationTargets,
  issueCount,
  highestIssueSeverity,
  expandedIssueKeys,
  reportSessionIssueSnapshot,
  clearAllSessionIssues,
  setIssueNodeExpanded,
} = useWorkspaceIssues({ sessions })
const visibleIssueTreeData = computed(() => isWorkbenchMode.value ? issueTreeData.value : EMPTY_TREE_DATA)
const visibleIssueCount = computed(() => isWorkbenchMode.value ? issueCount.value : 0)
const visibleIssueSeverity = computed(() => isWorkbenchMode.value ? highestIssueSeverity.value : null)

watch(locale, clearAllSessionIssues, { flush: 'sync' })
watch(projectPath, (nextPath, previousPath) => {
  if (nextPath !== previousPath) clearAllSessionIssues()
})

const {
  canExportActiveCard,
  showExportRenderer,
  exportCardFace,
  exportActiveCard2x,
  exportAllCardViews,
} = useShellExport({
  activeSession,
  exportRendererRef,
  projectInformation,
  resolvedDictionary,
  translate: t,
})

const {
  projectTreeData,
  projectExpandedKeys,
  openedEditorTreeData,
  selectedFileKeys,
  openedEditorSelectedKeys,
  handleOpenedEditorsSelect,
  handleFileTreeSelect,
  findProjectEntryByKey,
} = useShellFileTree({
  projectPath,
  indexedEntries,
  openedEditorItems: localizedOpenedEditorItems,
  activeSession,
  isDirectoryExpanded,
  activateSession,
  openPreviewFile,
})

function createTemplateTreeData(templates: readonly ProjectTemplate[]): OcTreeData {
  const items = new Map<string, OcTreeItem>()
  for (const template of templates) {
    items.set(template.key, { label: template.name, icon: 'file.opencard' })
  }
  return {
    rootKeys: templates.map((template) => template.key),
    items,
    children: new Map(),
  }
}

function recentProjectKey(path: string): string {
  return `recent-project:${path}`
}

function createRecentProjectTreeData(
  paths: readonly string[],
  availability: ReadonlyMap<string, boolean>,
): OcTreeData {
  const items = new Map<string, OcTreeItem>()
  const rootKeys = paths.map((path) => {
    const key = recentProjectKey(path)
    const isMissing = availability.get(key) === false
    items.set(key, {
      label: path.split(/[/\\]/).filter(Boolean).pop() || path,
      icon: isMissing ? 'status.folder-alert' : 'status.folder-open',
      iconTone: isMissing ? 'warning' : undefined,
      actions: [
        isMissing ? RECENT_PROJECT_RELOCATE_ACTION_KEY : RECENT_PROJECT_OPEN_ACTION_KEY,
        RECENT_PROJECT_REMOVE_ACTION_KEY,
      ],
    })
    return key
  })
  return { rootKeys, items, children: new Map() }
}

const builtinTemplateTreeData = computed(() => createTemplateTreeData(templateStore.builtinTemplates.value))
const userTemplateTreeData = computed(() => createTemplateTreeData(templateStore.userTemplates.value))
const recentProjectAvailability = ref<ReadonlyMap<string, boolean>>(new Map())
const recentProjectTreeData = computed(() => (
  createRecentProjectTreeData(
    settingsStore.settings.value.projectCreation.recentProjects,
    recentProjectAvailability.value,
  )
))
const selectedRecentProjectKeys = ref<string[]>([])

let recentProjectProbeRevision = 0
watch(
  () => settingsStore.settings.value.projectCreation.recentProjects,
  async (paths) => {
    const revision = ++recentProjectProbeRevision
    const entries = await Promise.all(paths.map(async (path) => (
      [recentProjectKey(path), await isProjectAvailable(path)] as const
    )))
    if (revision !== recentProjectProbeRevision) return
    recentProjectAvailability.value = new Map(entries)
  },
  { immediate: true },
)
const builtinSelectedTemplateKeys = computed(() =>
  selectedTemplateKey.value?.startsWith('builtin:') ? [selectedTemplateKey.value] : [],
)
const userSelectedTemplateKeys = computed(() =>
  selectedTemplateKey.value?.startsWith('user:') ? [selectedTemplateKey.value] : [],
)

watch(
  () => templateStore.templates.value,
  (templates) => {
    if (selectedTemplateKey.value && templates.some((template) => template.key === selectedTemplateKey.value)) return
    selectedTemplateKey.value = templates[0]?.key ?? null
  },
  { immediate: true },
)

const projectName = computed(() => {
  if (!projectPath.value) return ''
  return projectInformation.value?.name || projectPath.value.split(/[/\\]/).pop() || ''
})

const projectFolderName = computed(() => {
  if (!projectPath.value) return ''
  return projectPath.value.split(/[/\\]/).filter(Boolean).pop() || ''
})

const editorThemeId = computed(() => (
  settingsStore.settings.value.appearance.theme === 'system'
    ? getOcTheme()
    : settingsStore.settings.value.appearance.theme
))

function hasRootProjectFile(fileName: string): boolean {
  const expectedType = fileName === '.dictionary' ? 'opencard-dictionary' : 'opencard-project-profile'
  return indexedEntries.value.some(entry => !entry.isDirectory && (
    resolveFileType(`${projectPath.value}/${entry.name}`, projectPath.value).id === expectedType
  ))
}

const shellMainStyle = computed(() => ({
  '--shell-sidebar-width': effectiveSidebarCollapsed.value ? '0px' : `${sidebarWidth.value}px`,
}))

const openedEditorActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  [OPENED_EDITOR_CLOSE_ACTION_KEY, {
    title: t('sidebar.closeEditor', 'Close editor'),
    icon: 'action.close',
  }],
]))

const projectEntryActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => {
  const actions = new Map<string, OcTreeActionDefinition>([[PROJECT_ENTRY_RENAME_ACTION_KEY, {
    title: t('sidebar.fileActions.rename'),
    icon: 'action.edit',
  }],
  [PROJECT_ENTRY_REVEAL_ACTION_KEY, {
    title: t('sidebar.fileActions.reveal'),
    icon: 'status.folder-open',
  }],
  [PROJECT_ENTRY_COPY_RELATIVE_PATH_ACTION_KEY, {
    title: t('sidebar.fileActions.copyRelativePath'),
    icon: 'action.copy',
  }],
  [PROJECT_ENTRY_COPY_ABSOLUTE_PATH_ACTION_KEY, {
    title: t('sidebar.fileActions.copyAbsolutePath'),
    icon: 'action.copy',
  }],
  ])

  for (const [entryKey, item] of projectTreeData.value.items) {
    const moreActionKey = projectEntryMoreActionKey(entryKey)
    const deleteActionKey = projectEntryDeleteActionKey(entryKey)
    const confirmDeleteActionKey = projectEntryConfirmDeleteActionKey(entryKey)
    const children = [
      PROJECT_ENTRY_RENAME_ACTION_KEY,
      deleteActionKey,
      PROJECT_ENTRY_REVEAL_ACTION_KEY,
      PROJECT_ENTRY_COPY_RELATIVE_PATH_ACTION_KEY,
      PROJECT_ENTRY_COPY_ABSOLUTE_PATH_ACTION_KEY,
    ]
    actions.set(moreActionKey, {
      title: t('sidebar.fileActions.more'),
      icon: 'nav.more',
      children,
    })
    actions.set(deleteActionKey, {
      title: t('sidebar.fileActions.delete'),
      icon: 'action.delete',
      children: [confirmDeleteActionKey],
    })
    actions.set(confirmDeleteActionKey, {
      title: t('sidebar.fileActions.confirmDeleteFile', { fileName: item.label }),
      icon: 'action.delete',
      iconTone: 'danger',
    })
  }
  return actions
})

const recentProjectActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  [RECENT_PROJECT_OPEN_ACTION_KEY, {
    title: t('sidebar.openRecentProject'),
    icon: 'action.play',
    iconTone: 'success',
  }],
  [RECENT_PROJECT_RELOCATE_ACTION_KEY, {
    title: t('sidebar.relocateRecentProject'),
    icon: 'status.folder-open',
  }],
  [RECENT_PROJECT_REMOVE_ACTION_KEY, {
    title: t('sidebar.removeRecentProject'),
    icon: 'action.close',
  }],
]))

const exportTemplateTreeActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  [TEMPLATE_EXCLUDE_ACTION_KEY, {
    title: t('templateExport.tree.exclude'),
    icon: 'status.eye-off',
  }],
  [TEMPLATE_INCLUDE_ACTION_KEY, {
    title: t('templateExport.tree.include'),
    icon: 'status.eye',
  }],
  [TEMPLATE_COVER_ADD_ACTION_KEY, {
    title: t('templateExport.tree.addCover'),
    icon: 'action.image-plus',
  }],
  [TEMPLATE_COVER_REMOVE_ACTION_KEY, {
    title: t('templateExport.tree.removeCover'),
    icon: 'action.image-minus',
  }],
  [TEMPLATE_ENTRY_ADD_ACTION_KEY, {
    title: t('templateExport.tree.addEntry'),
    icon: 'action.file-plus',
  }],
  [TEMPLATE_ENTRY_REMOVE_ACTION_KEY, {
    title: t('templateExport.tree.removeEntry'),
    icon: 'action.file-minus',
  }],
]))

function normalizeTreePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function exportRelativePath(key: string): string {
  const root = normalizeTreePath(projectPath.value)
  const normalized = normalizeTreePath(key)
  return normalized.startsWith(`${root}/`) ? normalized.slice(root.length + 1) : normalized
}

function pathContains(parent: string, child: string): boolean {
  return child === parent || child.startsWith(`${parent}/`)
}

function isExportPathExcluded(relativePath: string): boolean {
  return relativePath === '.opencard-cache'
    || relativePath.startsWith('.opencard-cache/')
    || exportTemplateSelection.value.excludedPaths.some((excluded) => pathContains(excluded, relativePath))
}

const exportTemplateTreeData = computed<OcTreeData>(() => {
  const items = new Map<string, OcTreeItem>()
  for (const [key, item] of projectTreeData.value.items) {
    const relativePath = exportRelativePath(key)
    const isProjectFile = relativePath === '.opencardprojectprofile' || relativePath === '.dictionary'
    const isRuntimeCache = relativePath === '.opencard-cache' || relativePath.startsWith('.opencard-cache/')
    const isExcluded = isExportPathExcluded(relativePath)
    const isImage = resolveFileType(key).id === 'image'
    const isOpenCard = relativePath.toLowerCase().endsWith('.opencard')
    const actions: string[] = []

    if (!isProjectFile && !isRuntimeCache) {
      actions.push(isExcluded ? TEMPLATE_INCLUDE_ACTION_KEY : TEMPLATE_EXCLUDE_ACTION_KEY)
    }
    if (!isExcluded && isImage) {
      actions.push(exportTemplateSelection.value.covers.includes(relativePath)
        ? TEMPLATE_COVER_REMOVE_ACTION_KEY
        : TEMPLATE_COVER_ADD_ACTION_KEY)
    }
    if (!isExcluded && isOpenCard) {
      actions.push(exportTemplateSelection.value.entries.includes(relativePath)
        ? TEMPLATE_ENTRY_REMOVE_ACTION_KEY
        : TEMPLATE_ENTRY_ADD_ACTION_KEY)
    }

    items.set(key, {
      ...item,
      iconTone: isExcluded ? 'muted' : item.iconTone,
      disabled: isRuntimeCache,
      disabledReason: isRuntimeCache ? t('templateExport.tree.runtimeCache') : undefined,
      actions,
    })
  }
  return {
    rootKeys: projectTreeData.value.rootKeys,
    items,
    children: projectTreeData.value.children,
  }
})

const exportTemplateExpandedKeys = computed(() => [...projectTreeData.value.children.keys()])

function createExportSelectionTreeData(
  paths: readonly string[],
  prefix: string,
  icon: OcTreeItem['icon'],
  removeAction: string,
  labels: Readonly<Record<string, string>> = {},
): OcTreeData {
  const rootKeys = paths.map((path) => `${prefix}${path}`)
  return {
    rootKeys,
    items: new Map(paths.map((path) => [`${prefix}${path}`, {
      label: labels[path] ?? path,
      icon,
      actions: [removeAction],
    }])),
    children: new Map(),
  }
}

const exportTemplateEntryTreeData = computed(() => createExportSelectionTreeData(
  exportTemplateSelection.value.entries,
  TEMPLATE_ENTRY_TREE_PREFIX,
  'file.opencard',
  TEMPLATE_ENTRY_REMOVE_ACTION_KEY,
  exportTemplateSelection.value.entryNames,
))

const exportTemplateCoverTreeData = computed(() => createExportSelectionTreeData(
  exportTemplateSelection.value.covers,
  TEMPLATE_COVER_TREE_PREFIX,
  'file.image',
  TEMPLATE_COVER_REMOVE_ACTION_KEY,
))

const titleBarAppActions = computed<ShellTitleBarAppAction[]>(() => {
  const isPreview = import.meta.env.DEV && developerMode.value && !availableUpdate.value
  if (!availableUpdate.value && !isPreview) return []

  const progress = availableUpdate.value
    ? (isInstallingUpdate.value ? updateInstallProgress.value ?? 0 : null)
    : developerUpdateProgress.value
  const disabled = availableUpdate.value
    ? isInstallingUpdate.value
    : progress !== null && progress < 1

  return [{
    key: 'install-update',
    icon: 'action.download',
    progress,
    disabled,
    hoverTip: progress !== null
      ? t('app.updater.installingProgress', { progress: Math.round(progress * 100) })
      : isPreview
        ? t('app.updater.previewAvailable')
        : t('app.updater.available', { version: updateVersion.value }),
  }]
})

const windowControls = computed<ShellTitleBarWindowControl[]>(() => [
  {
    key: 'toggle-fullscreen',
    icon: isWindowFullscreen.value ? 'window.fullscreen-exit' : 'window.fullscreen',
    group: 'app',
    hoverTip: isWindowFullscreen.value
      ? t('app.shell.exitFullscreen')
      : t('app.shell.enterFullscreen'),
  },
  ...(!usesNativeMacosWindowControls ? [
    { key: 'minimize', icon: 'window.minimize', group: 'window', hoverTip: t('app.shell.minimize') },
    {
      key: 'toggle-maximize',
      icon: isWindowMaximized.value ? 'window.restore' : 'window.maximize',
      group: 'window',
      hoverTip: isWindowMaximized.value ? t('app.shell.restore') : t('app.shell.maximize'),
    },
    { key: 'close', icon: 'action.close', group: 'window', hoverTip: t('app.shell.close'), danger: true },
  ] satisfies ShellTitleBarWindowControl[] : []),
])

const sidebarHeadButtons = computed<ShellButton[]>(() => {
  if (isCreateProjectMode.value || isExportTemplateMode.value) {
    return [{
      key: 'return-primary-page',
      icon: 'nav.arrow-left',
      title: t('projectTemplates.actions.back'),
      disabled: isProjectTemplateBusy.value || isExportTemplateBusy.value,
    }]
  }
  if (isSettingsMode.value) {
    return [{ key: 'return-primary-page', icon: 'nav.arrow-left', title: t('settings.actions.back', 'Back') }]
  }
  if (isAboutMode.value) {
    return [{ key: 'return-primary-page', icon: 'nav.arrow-left', title: t('app.about.back') }]
  }
  if (isWelcomeMode.value) {
    return [
      { key: 'new-project', icon: 'action.folder-plus', title: t('app.menu.newProject') },
      { key: 'open-project', icon: 'status.folder-open', title: t('sidebar.openProject') },
    ]
  }
  return [
    { key: 'new-open-card', icon: 'action.file-plus', title: t('app.menu.newOpenCard') },
    {
      key: 'publish-version',
      icon: 'action.publish',
      title: t('app.menu.publishVersion'),
      disabled: true,
    },
  ]
})

const sidebarTailButtons = computed<ShellButton[]>(() => {
  if (isAuxiliaryMode.value) return []
  return [{ key: 'open-settings', icon: 'tool.settings', title: t('settings.title', 'Settings') }]
})

const sidebarBodyLists = computed<ShellList[]>(() => {
  if (isAboutMode.value) return []

  if (isSettingsMode.value) {
    return [{
      key: SETTINGS_CATEGORIES_LIST_KEY,
      title: t('settings.title', 'Settings'),
      placeholder: '',
      actions: [],
    }]
  }

  if (isCreateProjectMode.value) {
    const catalogPlaceholder = templateStore.isLoading.value
      ? t('projectTemplates.status.loading')
      : templateStore.error.value
        ? t('projectTemplates.errors.invalidCatalog')
        : t('projectTemplates.status.selectTemplate')
    return [
      {
        key: BUILTIN_TEMPLATES_LIST_KEY,
        title: t('projectTemplates.sections.builtin'),
        placeholder: catalogPlaceholder,
        actions: [],
      },
      {
        key: USER_TEMPLATES_LIST_KEY,
        title: t('projectTemplates.sections.user'),
        placeholder: templateStore.isLoading.value
          ? t('projectTemplates.status.loading')
          : t('projectTemplates.status.noUserTemplates'),
        actions: [
          {
            key: CREATE_TEMPLATE_ACTION_KEY,
            icon: 'action.folder-plus',
            hoverTip: t('projectTemplates.actions.createTemplate'),
            disabled: !projectPath.value || isProjectTemplateBusy.value || templateStore.isLoading.value,
          },
          {
            key: IMPORT_TEMPLATE_ACTION_KEY,
            icon: 'action.import',
            hoverTip: t('projectTemplates.actions.import'),
            disabled: isProjectTemplateBusy.value || templateStore.isLoading.value,
          },
        ],
      },
    ]
  }

  if (isExportTemplateMode.value) {
    return [
      {
        key: PROJECT_FILES_LIST_KEY,
        title: projectFolderName.value || t('sidebar.files'),
        placeholder: t('sidebar.emptyProject', 'Folder is empty'),
        actions: [],
        maxHeight: 'var(--oc-list-max-height-lg)',
      },
      {
        key: TEMPLATE_ENTRIES_LIST_KEY,
        title: t('projectTemplates.fields.entry'),
        placeholder: t('templateExport.noSelectedEntries'),
        actions: [],
        maxHeight: 'var(--oc-list-max-height-md)',
      },
      {
        key: TEMPLATE_COVERS_LIST_KEY,
        title: t('projectTemplates.fields.covers'),
        placeholder: t('templateExport.noSelectedCovers'),
        actions: [],
        maxHeight: 'var(--oc-list-max-height-md)',
      },
    ]
  }

  if (isWelcomeMode.value) {
    return [{
      key: RECENT_PROJECTS_LIST_KEY,
      title: t('sidebar.recentProjects'),
      placeholder: t('sidebar.noRecentProjects'),
      actions: [],
    }]
  }

  return [
    {
      key: OPENED_EDITORS_LIST_KEY,
      title: t('sidebar.openedEditors'),
      placeholder: t('sidebar.noOpenedEditors', 'No open editors'),
      actions: [],
    },
    {
      key: PROJECT_FILES_LIST_KEY,
      title: projectFolderName.value || t('sidebar.files'),
      placeholder: projectPath.value
        ? t('sidebar.emptyProject', 'Folder is empty')
        : t('sidebar.openProject', 'Open Project Folder'),
      actions: [
        {
          key: PROJECT_NEW_FILE_ACTION_KEY,
          icon: 'action.file-plus',
          hoverTip: t('sidebar.fileActions.newFile'),
          disabled: !projectPath.value,
          children: [
            {
              key: PROJECT_NEW_OPENCARD_ACTION_KEY,
              title: t('sidebar.fileActions.newOpenCard'),
              icon: 'file.opencard',
            },
            ...(!hasRootProjectFile('.opencardprojectprofile') ? [{
              key: PROJECT_NEW_PROFILE_ACTION_KEY,
              title: t('sidebar.fileActions.newProjectProfile'),
              icon: 'file.opencard-project' as const,
            }] : []),
            ...(!hasRootProjectFile('.dictionary') ? [{
              key: PROJECT_NEW_DICTIONARY_ACTION_KEY,
              title: t('sidebar.fileActions.newDictionary'),
              icon: 'data.collection' as const,
            }] : []),
          ],
        },
        {
          key: PROJECT_NEW_FOLDER_ACTION_KEY,
          icon: 'action.folder-plus',
          hoverTip: t('sidebar.fileActions.newFolder'),
          disabled: !projectPath.value,
        },
      ],
    },
    {
      key: CHANGES_LIST_KEY,
      title: t('sidebar.changes'),
      placeholder: t('sidebar.comingSoon'),
      actions: [],
    },
  ]
})

const developerModeMenuActions = computed<readonly OcActionMenuEntry[]>(() => (
  import.meta.env.DEV
    ? [{
        key: 'toggle-developer-mode',
        title: developerMode.value
          ? t('app.updater.disableDeveloperMode')
          : t('app.updater.enableDeveloperMode'),
        icon: developerMode.value ? 'action.check' : 'format.code-braces',
      }]
    : []
))

const titleBarMenus = computed<ShellTitleBarMenuGroup[]>(() => [
  {
    key: 'file',
    label: t('app.menu.file'),
    actions: [
      { key: 'new-project', title: t('app.menu.newProject'), icon: 'action.folder-plus' },
      { key: 'new-open-card', title: t('app.menu.newOpenCard'), icon: 'action.file-plus' },
      { type: 'divider', key: 'file-open-divider' },
      { key: 'open-project', title: t('sidebar.openProject'), icon: 'status.folder-open' },
      {
        key: 'close-project-folder',
        title: t('app.menu.closeProjectFolder'),
        icon: 'action.close',
        disabled: !projectPath.value,
      },
      {
        key: 'close-project-and-welcome',
        title: t('app.menu.closeProjectAndWelcome'),
        icon: 'nav.compass',
        disabled: !projectPath.value,
      },
      { type: 'divider', key: 'file-save-divider' },
      {
        key: 'save-active-editor',
        title: t('app.menu.save'),
        icon: 'action.save',
        disabled: !activeSession.value,
      },
      { type: 'divider', key: 'file-export-divider' },
      {
        key: 'export-project-template',
        title: t('templateExport.menu'),
        icon: 'action.export',
        disabled: !projectPath.value,
      },
      {
        key: 'export-active-card-2x',
        title: t('app.menu.export2x'),
        icon: 'action.export',
        disabled: !canExportActiveCard.value,
      },
      {
        key: 'export-all-card-views',
        title: t('app.menu.exportAll'),
        icon: 'action.export',
        disabled: !canExportActiveCard.value,
      },
    ],
  },
  {
    key: 'edit',
    label: t('app.menu.edit'),
    actions: [
      {
        key: 'undo-active-editor',
        title: t('app.menu.undo'),
        icon: 'action.undo',
        disabled: !isActiveCardDesignerEditor(),
      },
      {
        key: 'redo-active-editor',
        title: t('app.menu.redo'),
        icon: 'action.redo',
        disabled: !isActiveCardDesignerEditor(),
      },
      { type: 'divider', key: 'edit-settings-divider' },
      { key: 'open-settings', title: t('settings.title'), icon: 'tool.settings' },
    ],
  },
  {
    key: 'view',
    label: t('app.menu.view'),
    actions: [
      {
        key: 'show-welcome',
        title: t('app.menu.showWelcome'),
        icon: 'nav.compass',
        disabled: isWelcomeMode.value,
      },
      {
        key: 'show-workbench',
        title: t('app.menu.showWorkbench'),
        icon: 'nav.files',
        disabled: isWorkbenchMode.value,
      },
      { type: 'divider', key: 'view-page-divider' },
      {
        key: 'toggle-sidebar',
        title: sidebarCollapsed.value ? t('app.shell.expandSidebar') : t('app.shell.collapseSidebar'),
        icon: sidebarCollapsed.value ? 'nav.sidebar-expand' : 'nav.sidebar-collapse',
      },
      {
        key: 'toggle-bottom-panel',
        title: isBottomPanelExpanded.value
          ? t('app.shell.collapseBottomPanel')
          : t('app.shell.expandBottomPanel'),
        icon: isBottomPanelExpanded.value ? 'nav.chevron-down' : 'nav.chevron-up',
      },
      { type: 'divider', key: 'view-window-divider' },
      {
        key: 'toggle-fullscreen',
        title: isWindowFullscreen.value
          ? t('app.shell.exitFullscreen')
          : t('app.shell.enterFullscreen'),
        icon: isWindowFullscreen.value ? 'window.fullscreen-exit' : 'window.fullscreen',
      },
    ],
  },
  {
    key: 'help',
    label: t('app.menu.help'),
    actions: [
      {
        key: 'check-for-updates',
        title: isCheckingForUpdate.value
          ? t('app.updater.checking')
          : t('app.updater.check'),
        icon: 'action.refresh',
        disabled: isCheckingForUpdate.value || isInstallingUpdate.value,
      },
      ...developerModeMenuActions.value,
      { type: 'divider', key: 'help-about-divider' },
      {
        key: 'about-opencard',
        title: t('app.menu.aboutOpenCard'),
        icon: 'status.unknown',
      },
    ],
  },
])

const workspaceTitle = computed(() => {
  if (isCreateProjectMode.value) return t('projectTemplates.title')
  if (isExportTemplateMode.value) return t('templateExport.title')
  if (isSettingsMode.value) return activeSettingsCategory.value.title
  if (isAboutMode.value) return t('app.about.title')
  if (isWelcomeMode.value) return 'OpenCard'
  return activeSession.value
    ? formatSessionTitle(activeSession.value)
    : projectName.value || t('app.menu.workbench')
})

const workspaceActions = computed(() => [])

function resolveSessionFileType(session: { fileTypeId: string; path: string | null }) {
  const fileTypeFromId = resolveFileTypeById(session.fileTypeId)
  if (!session.path) {
    return fileTypeFromId
  }

  const fileTypeFromPath = resolveFileType(session.path)
  return fileTypeFromPath.id === session.fileTypeId
    ? fileTypeFromPath
    : fileTypeFromId
}

const currentLanguage = computed(() => {
  if (!activeSession.value) return ''
  return resolveSessionFileType(activeSession.value).language ?? 'plaintext'
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
    activeSession.value.path ?? `draft://${activeSession.value.id}`,
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

  const sessionId = activeSession.value.id
  const fileType = resolveSessionFileType(activeSession.value)
  const filePath = activeSession.value.path ?? `draft://${activeSession.value.id}`
  const editor = editorRegistry.getEditor(fileType.editorId)
  if (editor && editor.id !== 'monaco') {
    const baseProps = {
      filePath,
      modelValue: activeSession.value.draftContent,
      themeId: editorThemeId.value,
      'onUpdate:modelValue': (v: string) => { updateDraftContent(sessionId, v) },
    }

    if (editor.id === 'card-designer') {
      return {
        ...baseProps,
        fileName: activeSession.value.name,
        resourceRootPath: activeSessionResourceRootPath.value,
        viewportTransform: activeSession.value.uiState?.cardDesigner?.viewportTransform,
        cardDesignerLayout: activeSession.value.uiState?.cardDesigner?.layout,
        cardDesignerView: activeSession.value.uiState?.cardDesigner?.view,
        structureTreeSelectionBehavior:
          settingsStore.settings.value.workspace.structureTreeSelectionBehavior,
        structureTreeScrollToSelection:
          settingsStore.settings.value.workspace.structureTreeScrollToSelection,
        showSelectionPositionOnMove:
          settingsStore.settings.value.workspace.showSelectionPositionOnMove,
        showSelectionSizeOnResize:
          settingsStore.settings.value.workspace.showSelectionSizeOnResize,
      }
    }

    if (editor.id === 'image-preview') {
      return {
        ...baseProps,
        viewportTransform: activeSession.value.uiState?.imagePreview?.viewportTransform,
      }
    }

    return baseProps
  }
  return {
    modelValue: activeSession.value.draftContent,
    'onUpdate:modelValue': (v: string) => { updateDraftContent(sessionId, v) },
    language: currentLanguage.value,
    themeId: editorThemeId.value,
  }
})

function handleViewportTransformUpdate(value: { x: number; y: number; scale: number }) {
  const session = activeSession.value
  if (!session) return

  if (session.editorId === 'card-designer') {
    updateSessionUiState(session.id, {
      cardDesigner: { viewportTransform: value },
    })
  } else if (session.editorId === 'image-preview') {
    updateSessionUiState(session.id, {
      imagePreview: { viewportTransform: value },
    })
  }
}

function handleCardDesignerLayoutUpdate(value: CardDesignerLayoutState): void {
  const session = activeSession.value
  if (!session || session.editorId !== 'card-designer') return

  updateSessionUiState(session.id, {
    cardDesigner: { layout: value },
  })
}

function handleCardDesignerViewUpdate(value: CardDesignerViewState): void {
  const session = activeSession.value
  if (!session || session.editorId !== 'card-designer') return

  updateSessionUiState(session.id, {
    cardDesigner: { view: value },
  })
}

function handleEditorIssueSnapshot(sessionId: string, snapshot: EditorIssueSnapshot): void {
  reportSessionIssueSnapshot(sessionId, snapshot)
}

async function handleWorkspaceIssueNavigate(request: SessionIssueNavigationRequest): Promise<void> {
  await navigateWorkspaceIssue(request, {
    hasSession: (sessionId) => sessions.value.some((session) => session.id === sessionId),
    activateSession,
    waitForEditorMount: nextTick,
    getActiveSessionId: () => activeSession.value?.id ?? null,
    getEditorNavigator: () => currentEditorRef.value,
  })
}

async function handleProjectTreeItemToggle(itemKey: string, expanded: boolean) {
  const entry = findProjectEntryByKey(itemKey)
  if (!entry?.isDirectory) {
    return
  }

  setDirectoryExpanded(entry.key, expanded)

  if (!expanded) {
    return
  }

  try {
    await readDirectoryEntries(entry.key, 1)
  } catch (error) {
    console.error('加载目录失败:', error)
  }
}

function handleTemplateTreeIntent(intent: OcTreeIntent): void {
  if (intent.type !== 'selection.change') return
  const key = intent.selectedKeys[0] as ProjectTemplateKey | undefined
  if (key && templateStore.findTemplate(key)) selectedTemplateKey.value = key
}

function handleRecentProjectTreeIntent(intent: OcTreeIntent): void {
  if (intent.type === 'selection.change') {
    selectedRecentProjectKeys.value = intent.selectedKeys
    return
  }
  if (intent.type !== 'node.activate' && intent.type !== 'action.invoke') return
  const path = settingsStore.settings.value.projectCreation.recentProjects.find((item) => (
    recentProjectKey(item) === intent.key
  ))
  if (!path) return

  if (intent.type === 'action.invoke' && intent.actionKey === RECENT_PROJECT_REMOVE_ACTION_KEY) {
    settingsStore.forgetRecentProject(path)
    selectedRecentProjectKeys.value = selectedRecentProjectKeys.value.filter((key) => key !== intent.key)
    return
  }

  if (intent.type === 'action.invoke' && intent.actionKey === RECENT_PROJECT_RELOCATE_ACTION_KEY) {
    void relocateRecentProject(path)
    return
  }

  if (recentProjectAvailability.value.get(intent.key) === false) return

  const shouldOpen = intent.type === 'node.activate'
    || (intent.type === 'action.invoke' && intent.actionKey === RECENT_PROJECT_OPEN_ACTION_KEY)
  if (shouldOpen) void openRecentProject(path)
}

async function handleSidebarListAction(listKey: string, actionKey: string): Promise<void> {
  if (shellPage.value.type === 'workbench' && listKey === PROJECT_FILES_LIST_KEY) {
    if (actionKey === PROJECT_NEW_OPENCARD_ACTION_KEY) {
      await createProjectEntry('opencard')
      return
    }
    if (actionKey === PROJECT_NEW_PROFILE_ACTION_KEY) {
      await createProjectSpecialFile('.opencardprojectprofile')
      return
    }
    if (actionKey === PROJECT_NEW_DICTIONARY_ACTION_KEY) {
      await createProjectSpecialFile('.dictionary')
      return
    }
    if (actionKey === PROJECT_NEW_FOLDER_ACTION_KEY) {
      await createProjectEntry('folder')
      return
    }
  }

  if (shellPage.value.type !== 'create-project' || listKey !== USER_TEMPLATES_LIST_KEY) return
  if (isProjectTemplateBusy.value || templateStore.isLoading.value) return

  if (actionKey === CREATE_TEMPLATE_ACTION_KEY) {
    if (!projectPath.value) return
    await createProjectWorkspaceRef.value?.beginCreateTemplate(projectPath.value)
    return
  }

  if (actionKey === IMPORT_TEMPLATE_ACTION_KEY) {
    await createProjectWorkspaceRef.value?.beginImport()
  }
}

function getProjectEntryParentPath(): string {
  const selectedKey = selectedFileKeys.value[0]
  const selectedEntry = selectedKey ? findProjectEntryByKey(selectedKey) : null
  if (!selectedEntry) return projectPath.value
  if (selectedEntry.isDirectory) return selectedEntry.key
  const separatorIndex = selectedEntry.key.lastIndexOf('/')
  return separatorIndex < 0 ? projectPath.value : selectedEntry.key.slice(0, separatorIndex)
}

async function createProjectSpecialFile(fileName: '.opencardprojectprofile' | '.dictionary'): Promise<void> {
  if (!projectPath.value || hasRootProjectFile(fileName)) return
  await createFile(fileName, '{}')
  const path = `${projectPath.value}/${fileName}`
  selectedFileKeys.value = [path]
  await openEditorSession(path)
}

async function createProjectEntry(kind: 'folder' | 'opencard'): Promise<void> {
  if (!projectPath.value) return
  const parentPath = getProjectEntryParentPath()
  const parentEntry = findProjectEntryByKey(parentPath)
  if (parentEntry?.isDirectory) setDirectoryExpanded(parentPath, true)

  const baseName = kind === 'folder'
    ? t('sidebar.fileActions.newFolderName')
    : kind === 'opencard'
      ? t('sidebar.fileActions.newOpenCardName')
      : ''
  const content = kind === 'opencard'
    ? createDefaultOpenCardContent(baseName)
    : ''
  const path = await createEntryWithAvailableName(
    parentPath,
    baseName,
    kind === 'folder' ? 'folder' : 'file',
    content,
  )

  selectedFileKeys.value = [path]
  await nextTick()
  await projectTreeRef.value?.beginRename(path)
}

function handleSettingsCategoryTreeIntent(intent: OcTreeIntent): void {
  if (intent.type !== 'selection.change') return

  const categoryKey = intent.selectedKeys[0]
  if (categoryKey === 'general' || categoryKey === 'appearance' || categoryKey === 'workspace') {
    const returnPage = getCurrentPrimaryShellPage()
    shellPage.value = { type: 'settings', categoryKey, returnPage }
  }
}

async function handleSettingsIntent(intent: SettingsIntent): Promise<void> {
  if (intent.type === 'setting.change') {
    settingsStore.updateSetting(intent.key, intent.value)
    return
  }

  await resetProjectWorkspaceState()
}

async function flushActiveEditorForClose(sessionIds: readonly string[]): Promise<void> {
  const activeId = activeSession.value?.id
  if (!activeId || !sessionIds.includes(activeId)) return
  await currentEditorRef.value?.flush?.()
}

async function requestUnsavedClose(intent: UnsavedCloseIntent): Promise<void> {
  await flushActiveEditorForClose(intent.sessionIds)
  await requestGuardedClose(intent)
}

function getWorkspaceSessionIds(): string[] {
  return sessions.value
    .filter(session => session.resourceKind === 'workspace')
    .map(session => session.id)
}

function getSessionIdsAtPath(path: string): string[] {
  return sessions.value
    .filter(session => session.path && pathContains(path, session.path))
    .map(session => session.id)
}

async function performProjectClose(destination: ProjectCloseDestination = 'current'): Promise<void> {
  closeWorkspaceSessions()
  await setProjectPath('')
  selectedRecentProjectKeys.value = []
  shellPage.value = resolveShellPageAfterProjectClose(shellPage.value, destination)
}

async function performApplicationClose(): Promise<void> {
  await getCurrentWindow().destroy()
}

async function completeUnsavedClose(intent: UnsavedCloseIntent): Promise<void> {
  if (intent.type === 'project') {
    await performProjectClose(intent.projectDestination)
    return
  }

  if (intent.type === 'app') {
    await performApplicationClose()
    return
  }

  if (intent.type === 'trash') {
    if (!intent.path) return
    await trashFile(intent.path)
    closeSessionsByPath(intent.path)
    selectedFileKeys.value = selectedFileKeys.value.filter(key => key !== intent.path)
    return
  }

  for (const sessionId of intent.sessionIds) closeSession(sessionId)
}

async function requestApplicationClose(): Promise<void> {
  await requestUnsavedClose({
    type: 'app',
    sessionIds: sessions.value.map(session => session.id),
  })
}

async function handleOpenedEditorTreeIntent(intent: OcTreeIntent) {
  if (intent.type === 'selection.change') {
    handleOpenedEditorsSelect(intent.selectedKeys)
    return
  }

  if (intent.type === 'action.invoke' && intent.actionKey === OPENED_EDITOR_CLOSE_ACTION_KEY) {
    await requestUnsavedClose({ type: 'sessions', sessionIds: [intent.key] })
  }
}

async function handleProjectTreeIntent(intent: OcTreeIntent) {
  if (intent.type === 'selection.change') {
    await handleFileTreeSelect(intent.selectedKeys)
    return
  }

  if (intent.type === 'expansion.change') {
    await handleProjectTreeItemToggle(intent.key, intent.expanded)
    return
  }

  if (intent.type === 'rename.request') {
    await projectTreeRef.value?.beginRename(intent.key)
    return
  }

  if (intent.type === 'rename.commit') {
    const result = await renameEntry(intent.key, intent.name)
    if (result.ok) remapSessionPaths(result.fromPath, result.toPath)
    else console.warn('[workspace] Rename rejected:', result.reason)
    return
  }

  if (intent.type === 'move.request') {
    const result = await moveEntryByDrop(intent)
    if (result.ok) remapSessionPaths(result.fromPath, result.toPath)
    else console.warn('[workspace] Move rejected:', result.reason)
    return
  }

  if (intent.type === 'action.invoke') {
    const entry = findProjectEntryByKey(intent.key)
    if (!entry) return

    if (intent.actionKey === PROJECT_ENTRY_RENAME_ACTION_KEY) {
      await projectTreeRef.value?.beginRename(entry.key)
      return
    }

    if (isProjectEntryConfirmDeleteActionKey(intent.actionKey)) {
      await requestUnsavedClose({
        type: 'trash',
        sessionIds: getSessionIdsAtPath(entry.key),
        path: entry.key,
      })
      return
    }
    if (intent.actionKey === PROJECT_ENTRY_REVEAL_ACTION_KEY) {
      console.debug('[workspace-action] reveal:start', { actionKey: intent.actionKey, path: entry.key })
      try {
        await revealEntryInFileManager(entry.key)
        console.debug('[workspace-action] reveal:success', { actionKey: intent.actionKey, path: entry.key })
      } catch (error) {
        console.error('[workspace-action] reveal:failed', {
          actionKey: intent.actionKey,
          path: entry.key,
          error,
        })
      }
      return
    }
    if (intent.actionKey === PROJECT_ENTRY_COPY_RELATIVE_PATH_ACTION_KEY) {
      await navigator.clipboard.writeText(getRelativeProjectPath(entry.key))
      return
    }
    if (intent.actionKey === PROJECT_ENTRY_COPY_ABSOLUTE_PATH_ACTION_KEY) {
      await navigator.clipboard.writeText(entry.key)
    }
    return
  }

  if (intent.type !== 'node.activate') {
    return
  }

  const entry = findProjectEntryByKey(intent.key)
  if (!entry) {
    return
  }

  if (entry.isDirectory) {
    await handleProjectTreeItemToggle(entry.key, !entry.isExpanded)
    return
  }

  await handleOpenFile(entry.key)
}

function handleExportTemplateTreeIntent(intent: OcTreeIntent): void {
  if (intent.type !== 'action.invoke') return
  const relativePath = exportRelativePath(intent.key)
  if (intent.actionKey === TEMPLATE_EXCLUDE_ACTION_KEY || intent.actionKey === TEMPLATE_INCLUDE_ACTION_KEY) {
    exportTemplateWorkspaceRef.value?.togglePathIncluded(relativePath)
    return
  }
  if (intent.actionKey === TEMPLATE_COVER_ADD_ACTION_KEY || intent.actionKey === TEMPLATE_COVER_REMOVE_ACTION_KEY) {
    exportTemplateWorkspaceRef.value?.toggleCover(relativePath)
    return
  }
  if (intent.actionKey === TEMPLATE_ENTRY_ADD_ACTION_KEY || intent.actionKey === TEMPLATE_ENTRY_REMOVE_ACTION_KEY) {
    exportTemplateWorkspaceRef.value?.toggleEntry(relativePath)
  }
}

function handleExportSelectionTreeIntent(intent: OcTreeIntent): void {
  if (intent.type !== 'action.invoke') return
  if (intent.key.startsWith(TEMPLATE_ENTRY_TREE_PREFIX)) {
    exportTemplateWorkspaceRef.value?.toggleEntry(intent.key.slice(TEMPLATE_ENTRY_TREE_PREFIX.length))
    return
  }
  if (intent.key.startsWith(TEMPLATE_COVER_TREE_PREFIX)) {
    exportTemplateWorkspaceRef.value?.toggleCover(intent.key.slice(TEMPLATE_COVER_TREE_PREFIX.length))
  }
}

async function openProject() {
  const previousProjectPath = projectPath.value
  const openedPath = await openProjectFn()
  if (!openedPath) return

  if (previousProjectPath && projectPath.value !== previousProjectPath) {
    closeWorkspaceSessions()
  }

  settingsStore.rememberRecentProject(projectPath.value)
  showPrimaryShellPage('workbench')
  await ensureProjectTreeLoaded()
}

async function closeProjectFolder(destination: ProjectCloseDestination = 'current'): Promise<void> {
  if (!projectPath.value) return
  await requestUnsavedClose({
    type: 'project',
    sessionIds: getWorkspaceSessionIds(),
    projectDestination: destination,
  })
}

async function handleExternalOpenPaths(paths: readonly string[]): Promise<void> {
  for (const path of paths) {
    const normalizedPath = path.replace(/\\/g, '/')
    const kind = classifyExternalOpenPath(normalizedPath)
    if (!kind) continue

    try {
      if (kind === 'project-resource') {
        const projectDirectory = getPathDirectory(normalizedPath)
        if (!projectDirectory) continue
        await openRecentProject(projectDirectory)
        await openEditorSession(normalizedPath)
        continue
      }

      if (kind === 'card') {
        await openEditorSession(normalizedPath)
        showPrimaryShellPage('workbench')
        continue
      }

      if (kind === 'template') {
        const imported = await templateStore.importUserTemplate(normalizedPath)
        selectedTemplateKey.value = imported.key
        shellPage.value = { type: 'create-project', returnPage: getCurrentPrimaryShellPage() }
      }
    } catch (error) {
      console.error('处理外部打开请求失败:', normalizedPath, error)
    }
  }
}

function handleShellFileDropEvent(event: TauriEvent<DragDropEvent>): void {
  const payload = event.payload
  if (payload.type === 'enter') {
    isShellFileDropActive.value = filterSupportedExternalOpenPaths(payload.paths).length > 0
    return
  }
  if (payload.type === 'drop') {
    isShellFileDropActive.value = false
    const paths = filterSupportedExternalOpenPaths(payload.paths)
    if (paths.length > 0) void handleExternalOpenPaths(paths)
    return
  }
  if (payload.type === 'leave') {
    isShellFileDropActive.value = false
  }
}

async function openRecentProject(path: string): Promise<void> {
  const previousProjectPath = projectPath.value
  if (previousProjectPath && previousProjectPath !== path) {
    closeWorkspaceSessions()
  }
  await setProjectPath(path)
  settingsStore.rememberRecentProject(projectPath.value)
  selectedRecentProjectKeys.value = []
  showPrimaryShellPage('workbench')
  await ensureProjectTreeLoaded()
}

async function relocateRecentProject(missingPath: string): Promise<void> {
  const selectedPath = await chooseProjectDirectory()
  if (!selectedPath) return

  settingsStore.forgetRecentProject(missingPath)
  settingsStore.rememberRecentProject(selectedPath)
  selectedRecentProjectKeys.value = []
}

function openCreateProject(): void {
  if (isProjectTemplateBusy.value) return
  projectActivationError.value = ''
  shellPage.value = { type: 'create-project', returnPage: getCurrentPrimaryShellPage() }
  void templateStore.load().catch(() => undefined)
}

async function handleProjectCreated(project: CreatedProject): Promise<void> {
  if (isActivatingProject.value) return
  isActivatingProject.value = true
  projectActivationError.value = ''

  try {
    if (projectPath.value) {
      closeWorkspaceSessions()
    }

    await setProjectPath(project.path)
    settingsStore.rememberRecentProject(project.path)
    await ensureProjectTreeLoaded()
    await openEditorSession(project.entry)
    showPrimaryShellPage('workbench')
  } catch (error) {
    projectActivationError.value = t('projectTemplates.errors.activationFailed')
    console.error('激活新建项目失败:', error)
  } finally {
    isActivatingProject.value = false
  }
}

async function ensureProjectTreeLoaded() {
  if (!projectPath.value) {
    return
  }

  await readDirectoryEntries('', Number.POSITIVE_INFINITY)
}

function toggleSidebarCollapsed() {
  if (sidebarCollapsed.value) {
    settingsStore.updateShell({
      sidebarCollapsed: false,
      sidebarWidth: lastExpandedSidebarWidth.value,
    })
    return
  }

  lastExpandedSidebarWidth.value = Math.max(sidebarWidth.value, SIDEBAR_MIN_WIDTH)
  settingsStore.updateShell({ sidebarCollapsed: true })
}

function handleSidebarResize(width: number) {
  if (width <= SIDEBAR_AUTO_COLLAPSE_WIDTH) {
    settingsStore.updateShell({ sidebarCollapsed: true })
    return
  }

  const nextWidth = Math.max(width, SIDEBAR_MIN_WIDTH)
  lastExpandedSidebarWidth.value = nextWidth
  settingsStore.updateShell({
    sidebarCollapsed: false,
    sidebarWidth: nextWidth,
  })
}

function createUntitledOpenCard() {
  if (!projectPath.value) return
  showPrimaryShellPage('workbench')
  createDraftSession({
    fileTypeId: 'opencard',
  })
}

async function runShellCommand(actionKey: string) {
  if ((isCreateProjectMode.value && isProjectTemplateBusy.value) || isExportTemplateBusy.value) return

  if (actionKey === 'open-settings') {
    shellPage.value = {
      type: 'settings',
      categoryKey: 'general',
      returnPage: getCurrentPrimaryShellPage(),
    }
    return
  }

  if (actionKey === 'check-for-updates') {
    await checkForUpdate()
    return
  }

  if (actionKey === 'toggle-developer-mode' && import.meta.env.DEV) {
    developerMode.value = !developerMode.value
    stopDeveloperUpdatePreview()
    return
  }

  if (actionKey === 'about-opencard') {
    shellPage.value = {
      type: 'about',
      returnPage: getCurrentPrimaryShellPage(),
    }
    return
  }

  if (actionKey === 'save-active-editor') {
    await triggerCurrentEditorSave()
    return
  }

  if (actionKey === 'undo-active-editor') {
    await triggerCurrentEditorUndo()
    return
  }

  if (actionKey === 'redo-active-editor') {
    await triggerCurrentEditorRedo()
    return
  }

  if (actionKey === 'toggle-sidebar') {
    toggleSidebarCollapsed()
    return
  }

  if (actionKey === 'toggle-bottom-panel') {
    isBottomPanelExpanded.value = !isBottomPanelExpanded.value
    return
  }

  if (actionKey === 'toggle-fullscreen') {
    try {
      await toggleWindowFullscreen()
    } catch (error) {
      console.warn('切换全屏失败:', error)
    }
    return
  }

  if (actionKey === 'show-welcome') {
    showPrimaryShellPage('welcome')
    return
  }

  if (actionKey === 'show-workbench') {
    showPrimaryShellPage('workbench')
    return
  }

  if (actionKey === 'return-primary-page') {
    showPrimaryShellPage(getCurrentPrimaryShellPage())
    return
  }

  if (actionKey === 'new-project') {
    openCreateProject()
    return
  }

  if (actionKey === 'new-open-card') {
    createUntitledOpenCard()
    return
  }

  if (actionKey === 'open-project') {
    await openProject()
    return
  }

  if (actionKey === 'close-project-folder') {
    await closeProjectFolder()
    return
  }

  if (actionKey === 'close-project-and-welcome') {
    await closeProjectFolder('welcome')
    return
  }

  if (actionKey === 'export-project-template') {
    if (projectPath.value) {
      const returnPage = getCurrentPrimaryShellPage()
      exportTemplateSelection.value = { excludedPaths: [], entries: [], entryNames: {}, covers: [] }
      await ensureProjectTreeLoaded()
      shellPage.value = { type: 'export-template', returnPage }
    }
    return
  }

  if (actionKey === 'export-active-card-2x') {
    if (canExportActiveCard.value) {
      await exportActiveCard2x()
    }
    return
  }

  if (actionKey === 'export-all-card-views' && canExportActiveCard.value) {
    await exportAllCardViews()
  }
}

async function handleTitleBarMenuAction(_menuKey: string, actionKey: string) {
  await runShellCommand(actionKey)
}

function stopDeveloperUpdatePreview(): void {
  if (developerUpdateTimer !== null) window.clearInterval(developerUpdateTimer)
  developerUpdateTimer = null
  developerUpdateProgress.value = null
}

function startDeveloperUpdatePreview(): void {
  stopDeveloperUpdatePreview()
  developerUpdateProgress.value = 0
  developerUpdateTimer = window.setInterval(() => {
    const nextProgress = Math.min(1, (developerUpdateProgress.value ?? 0) + 0.04)
    developerUpdateProgress.value = nextProgress
    if (nextProgress >= 1 && developerUpdateTimer !== null) {
      window.clearInterval(developerUpdateTimer)
      developerUpdateTimer = null
    }
  }, 140)
}

async function handleTitleBarAppAction(actionKey: string): Promise<void> {
  if (actionKey !== 'install-update') return
  if (availableUpdate.value) {
    await installAvailableUpdate()
    return
  }
  if (import.meta.env.DEV && developerMode.value) startDeveloperUpdatePreview()
}

async function handleWorkspaceFrameAction(actionKey: string) {
  await runShellCommand(actionKey)
}

async function syncWindowState(): Promise<void> {
  try {
    const appWindow = getCurrentWindow()
    const [fullscreen, maximized] = await Promise.all([
      appWindow.isFullscreen(),
      appWindow.isMaximized(),
    ])
    isWindowFullscreen.value = fullscreen
    isWindowMaximized.value = maximized
  } catch {
    isWindowFullscreen.value = false
    isWindowMaximized.value = false
  }
}

async function toggleWindowFullscreen(): Promise<void> {
  if (isFullscreenTransitioning) return

  const appWindow = getCurrentWindow()
  isFullscreenTransitioning = true

  try {
    const fullscreen = await appWindow.isFullscreen()

    if (!fullscreen) {
      restoreMaximizedAfterFullscreen = await appWindow.isMaximized()
      if (restoreMaximizedAfterFullscreen) {
        await appWindow.toggleMaximize()
      }
      await appWindow.setFullscreen(true)
    } else {
      await appWindow.setFullscreen(false)
      if (restoreMaximizedAfterFullscreen && !(await appWindow.isMaximized())) {
        await appWindow.toggleMaximize()
      }
      restoreMaximizedAfterFullscreen = false
    }

    await syncWindowState()
  } catch (error) {
    if (restoreMaximizedAfterFullscreen && !(await appWindow.isMaximized().catch(() => false))) {
      await appWindow.toggleMaximize().catch(() => undefined)
    }
    restoreMaximizedAfterFullscreen = false
    await syncWindowState()
    throw error
  } finally {
    isFullscreenTransitioning = false
  }
}

async function handleWindowControl(actionKey: string) {
  try {
    if (actionKey === 'close') {
      await requestApplicationClose()
      return
    }

    const appWindow = getCurrentWindow()

    if (actionKey === 'minimize') {
      await appWindow.minimize()
      return
    }

    if (actionKey === 'toggle-fullscreen') {
      await toggleWindowFullscreen()
      return
    }

    if (actionKey === 'toggle-maximize') {
      if (await appWindow.isFullscreen()) return
      await appWindow.toggleMaximize()
      isWindowMaximized.value = await appWindow.isMaximized()
      return
    }

  } catch (error) {
    if (actionKey === 'close') {
      console.warn('关闭窗口失败:', error)
      return
    }

    console.warn('窗口控制不可用:', error)
  }
}

async function handleOpenFile(path: string) {
  try {
    await openEditorSession(path)
  } catch (error) {
    console.error('打开文件失败:', error)
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

function handleEditorModified(modified: boolean) {
  const session = activeSession.value
  if (!session) {
    return
  }

  setSessionDirtyState(session.id, modified)
}

async function triggerCurrentEditorSave() {
  if (!activeSession.value) {
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
  if (event.key === 'F11') {
    event.preventDefault()
    if (!event.repeat) {
      try {
        await toggleWindowFullscreen()
      } catch (error) {
        console.warn('切换全屏失败:', error)
      }
    }
    return
  }

  if (!(event.ctrlKey || event.metaKey)) {
    return
  }

  const key = event.key.toLowerCase()
  if (key === 'n') {
    event.preventDefault()
    createUntitledOpenCard()
    return
  }

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

function handleViewportResize(): void {
  viewportWidth.value = window.innerWidth
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('resize', handleViewportResize)
  void (async () => {
    await syncWindowState()
    try {
      unlistenWindowResize = await getCurrentWindow().onResized(() => {
        void syncWindowState()
      })
    } catch {
      unlistenWindowResize = null
    }
  })()
  void (async () => {
    try {
      unlistenWindowClose = await getCurrentWindow().onCloseRequested((event) => {
        event.preventDefault()
        void requestApplicationClose()
      })
    } catch {
      unlistenWindowClose = null
    }
  })()
  void ensureProjectTreeLoaded()
  void checkForUpdate()
  void listenForExternalOpenRequests(handleExternalOpenPaths)
    .then((unlisten) => { unlistenExternalOpen = unlisten })
    .catch(() => { unlistenExternalOpen = null })
  void (async () => {
    try {
      unlistenShellFileDrop = await getCurrentWindow().onDragDropEvent(handleShellFileDropEvent)
    } catch {
      unlistenShellFileDrop = null
    }
  })()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('resize', handleViewportResize)
  unlistenWindowResize?.()
  unlistenWindowResize = null
  unlistenWindowClose?.()
  unlistenWindowClose = null
  unlistenExternalOpen?.()
  unlistenExternalOpen = null
  unlistenShellFileDrop?.()
  unlistenShellFileDrop = null
  isShellFileDropActive.value = false
  disposeAppUpdater()
  stopDeveloperUpdatePreview()
})
</script>

<style scoped>
.open-card-shell {
  color: var(--color-text-primary);
}

.open-card-shell__workspace-stack {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  overflow: hidden;
}

.open-card-shell__workbench {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.open-card-shell__workbench > :deep(*) {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.open-card-shell__sidebar-tree {
  width: 100%;
  min-width: 0;
}

.shell-file-drop-overlay {
  position: fixed;
  inset: 8px;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--oc-space-3, 8px);
  pointer-events: none;
  border: 2px solid var(--oc-border-accent, #7c6cff);
  border-radius: var(--oc-radius-lg, 8px);
  background: color-mix(in srgb, var(--oc-bg-base, #1e1e1e) 88%, transparent);
  color: var(--oc-fg-primary, #f3f3f3);
  font-size: var(--oc-text-lg, 15px);
  font-weight: 600;
}
</style>
