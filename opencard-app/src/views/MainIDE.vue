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
  <main class="shell-root ide-shell" :class="themeClass">
    <EzTitleBar
      :collapsed="effectiveSidebarCollapsed"
      brand-label="OPENCARD"
      brand-logo-src="/icon_v2.png"
      :menu-groups="titleBarMenus"
      :window-controls="windowControls"
      :collapse-tooltip="t('app.shell.collapseSidebar', 'Collapse sidebar')"
      :expand-tooltip="t('app.shell.expandSidebar', 'Expand sidebar')"
      drag-region
      @toggle-sidebar="toggleSidebarCollapsed"
      @menu-action="handleTitleBarMenuAction"
      @window-control="handleWindowControl"
    />

    <div class="shell-main" :class="{ 'shell-main-collapsed': effectiveSidebarCollapsed }" :style="shellMainStyle">
      <EzSidebar
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
            class="ide-shell__sidebar-tree"
            :data="builtinTemplateTreeData"
            :selected-keys="builtinSelectedTemplateKeys"
            role="listbox"
            selection-mode="single"
            activation-mode="none"
            @intent="handleTemplateTreeIntent"
          />
          <OcTree
            v-else-if="list.key === USER_TEMPLATES_LIST_KEY && userTemplateTreeData.rootKeys.length > 0"
            class="ide-shell__sidebar-tree"
            :data="userTemplateTreeData"
            :selected-keys="userSelectedTemplateKeys"
            role="listbox"
            selection-mode="single"
            activation-mode="none"
            @intent="handleTemplateTreeIntent"
          />
          <OcTree
            v-else-if="list.key === SETTINGS_CATEGORIES_LIST_KEY"
            class="ide-shell__sidebar-tree"
            :data="settingsCategoryTreeData"
            :selected-keys="[settingsCategoryKey]"
            role="listbox"
            selection-mode="single"
            activation-mode="none"
            @intent="handleSettingsCategoryTreeIntent"
          />
          <OcTree
            v-else-if="list.key === RECENT_PROJECTS_LIST_KEY && recentProjectTreeData.rootKeys.length > 0"
            class="ide-shell__sidebar-tree"
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
            class="ide-shell__sidebar-tree"
            :data="openedEditorTreeData"
            :actions="openedEditorActions"
            :selected-keys="openedEditorSelectedKeys"
            role="listbox"
            selection-mode="single"
            activation-mode="none"
            @intent="handleOpenedEditorTreeIntent"
          />
          <OcTree
            v-else-if="list.key === PROJECT_FILES_LIST_KEY && projectTreeData.rootKeys.length > 0"
            class="ide-shell__sidebar-tree"
            :data="projectTreeData"
            :selected-keys="selectedFileKeys"
            :expanded-keys="projectExpandedKeys"
            role="tree"
            selection-mode="single"
            activation-mode="double-click"
            @intent="handleProjectTreeIntent"
          />
          <div v-else class="shell-sidebar-empty">
            <span>{{ list.placeholder }}</span>
          </div>
        </template>
      </EzSidebar>

      <EzWorkspaceFrame
        :title="workspaceTitle"
        :actions="workspaceActions"
        lock-body-scroll
        flush-body
        @action="handleWorkspaceFrameAction"
      >
        <div class="ide-shell__workbench">
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
            :project-path="projectPath"
            @update:busy="isExportTemplateBusy = $event"
          />
          <SettingsWorkspace
            v-else-if="isSettingsMode"
            :view-model="activeSettingsCategory"
            @intent="handleSettingsIntent"
          />
          <WelcomeWorkspace
            v-else-if="isWelcomeMode"
            @new-project="openCreateProject"
            @open-project="openProject"
          />
          <ProjectEditorWorkspace v-else-if="isProjectMode" :has-active-editor="Boolean(activeSession)">
            <component
              v-if="activeSession"
              :is="currentEditorComponent"
              :key="currentEditorKey"
              ref="currentEditorRef"
              v-bind="currentEditorProps"
              @modified="handleEditorModified"
              @save="handleEditorSave"
              @update-viewport-transform="handleViewportTransformUpdate"
              @update-card-designer-layout="handleCardDesignerLayoutUpdate"
            />
          </ProjectEditorWorkspace>
        </div>
      </EzWorkspaceFrame>
    </div>

    <!-- 隐藏的导出渲染器 -->
    <div v-if="showExportRenderer" style="position: fixed; top: -9999px; left: -9999px;">
      <CardRenderer v-if="exportCardDoc" ref="exportRendererRef" :document="exportCardDoc" />
    </div>

    <FloatingMenuHost />
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '../features/workspace/store/projectStore'
import { useEditorSessionStore } from '../features/workspace/store/editorSessionStore'
import MonacoEditor from '../components/editors/MonacoEditor.vue'
import FloatingMenuHost from '../components/ui/FloatingMenuHost.vue'
import { OcTree } from '../components/standard'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent, OcTreeItem } from '../shared/ui/tree/tree.types'
import type { CardDesignerLayoutState } from '../features/editor-runtime/model/editorUiState'
import SettingsWorkspace from '../features/settings/components/SettingsWorkspace.vue'
import CreateProjectWorkspace from '../features/project-templates/components/CreateProjectWorkspace.vue'
import ExportTemplateWorkspace from '../features/project-templates/components/ExportTemplateWorkspace.vue'
import ProjectEditorWorkspace from '../features/ide-shell/components/ProjectEditorWorkspace.vue'
import WelcomeWorkspace from '../features/ide-shell/components/WelcomeWorkspace.vue'
import type { CreatedProject, ProjectTemplate, ProjectTemplateKey } from '../features/project-templates/model/projectTemplate'
import { useProjectTemplateStore } from '../features/project-templates/store/projectTemplateStore'
import { useSettingsWorkspace } from '../features/settings/composables/useSettingsWorkspace'
import { useAppSettingsStore } from '../features/settings/store/appSettingsStore'
import type { SettingsCategoryKey, SettingsIntent } from '../features/settings/model/appSettings'
import CardRenderer from '../components/card/CardRenderer.vue'
import { editorRegistry } from '../features/editor-runtime/registry/editorRegistry'
import { resolveFileType, resolveFileTypeById } from '../features/workspace/model/fileTypes'
import { useIdeExport } from '../features/ide-shell/composables/useIdeExport'
import {
  OPENED_EDITOR_CLOSE_ACTION_KEY,
  useIdeFileTree,
} from '../features/ide-shell/composables/useIdeFileTree'
import { getCurrentWindow } from '@tauri-apps/api/window'
import {
  EzSidebar,
  EzTitleBar,
  EzWorkspaceFrame,
  type EzShellButton,
  type EzShellList,
  type EzTitleBarMenuGroup,
  type EzTitleBarWindowControl,
} from '../packages/ez-vue-shell'

const { t } = useI18n()
const SIDEBAR_MIN_WIDTH = 220
const SIDEBAR_AUTO_COLLAPSE_WIDTH = 168
const PROJECT_FILES_LIST_KEY = 'project-files'
const OPENED_EDITORS_LIST_KEY = 'opened-editors'
const RECENT_PROJECTS_LIST_KEY = 'recent-projects'
const CHANGES_LIST_KEY = 'changes'
const SETTINGS_CATEGORIES_LIST_KEY = 'settings-categories'
const BUILTIN_TEMPLATES_LIST_KEY = 'builtin-templates'
const USER_TEMPLATES_LIST_KEY = 'user-templates'
const CREATE_TEMPLATE_ACTION_KEY = 'create-template'
const IMPORT_TEMPLATE_ACTION_KEY = 'import-template'
const RECENT_PROJECT_OPEN_ACTION_KEY = 'recent-project.open'
const RECENT_PROJECT_RELOCATE_ACTION_KEY = 'recent-project.relocate'
const RECENT_PROJECT_REMOVE_ACTION_KEY = 'recent-project.remove'
const themeClass = 'shell-theme-graphite'

type CurrentEditorRef = {
  save?: () => Promise<void> | void
  undo?: () => Promise<void> | void
  redo?: () => Promise<void> | void
  canUndo?: boolean
  canRedo?: boolean
}

type WorkspaceMode =
  | { type: 'welcome' }
  | { type: 'project' }
  | { type: 'create-project' }
  | { type: 'export-template' }
  | { type: 'settings'; categoryKey: SettingsCategoryKey }

const {
  projectPath,
  projectInformation,
  indexedEntries,
  chooseProjectDirectory,
  openProject: openProjectFn,
  isProjectAvailable,
  setProjectPath,
  isDirectoryExpanded,
  readDirectoryEntries,
  setDirectoryExpanded,
  resetProjectWorkspaceState,
} = useProjectStore()

const settingsStore = useAppSettingsStore()
const templateStore = useProjectTemplateStore()
const workspaceMode = ref<WorkspaceMode>({ type: 'welcome' })
const isSettingsMode = computed(() => workspaceMode.value.type === 'settings')
const isCreateProjectMode = computed(() => workspaceMode.value.type === 'create-project')
const isExportTemplateMode = computed(() => workspaceMode.value.type === 'export-template')
const isWelcomeMode = computed(() => workspaceMode.value.type === 'welcome')
const isProjectMode = computed(() => workspaceMode.value.type === 'project')
const isAuxiliaryMode = computed(() => isSettingsMode.value || isCreateProjectMode.value || isExportTemplateMode.value)
const selectedTemplateKey = ref<ProjectTemplateKey | null>(null)
const createProjectWorkspaceRef = ref<InstanceType<typeof CreateProjectWorkspace> | null>(null)
const projectActivationError = ref('')
const isActivatingProject = ref(false)
const isCreateProjectOperationBusy = ref(false)
const isExportTemplateBusy = ref(false)
const isProjectTemplateBusy = computed(() => (
  isActivatingProject.value || isCreateProjectOperationBusy.value
))
const settingsCategoryKey = computed<SettingsCategoryKey>(() =>
  workspaceMode.value.type === 'settings' ? workspaceMode.value.categoryKey : 'general'
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
const exportRendererRef = ref<InstanceType<typeof CardRenderer>>()
const currentEditorRef = ref<CurrentEditorRef | null>(null)

const {
  activeSession,
  openedEditorItems,
  openFile: openEditorSession,
  openPreviewFile,
  activateSession,
  createUntitledSession,
  updateDraftContent,
  setSessionDirtyState,
  updateSessionUiState,
  closeSession,
  detachWorkspaceSessions,
  saveActiveSession,
} = useEditorSessionStore()

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
  projectTreeData,
  projectExpandedKeys,
  openedEditorTreeData,
  selectedFileKeys,
  openedEditorSelectedKeys,
  handleOpenedEditorsSelect,
  handleFileTreeSelect,
  findProjectEntryByKey,
} = useIdeFileTree({
  projectPath,
  indexedEntries,
  openedEditorItems,
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
  return projectInformation.value.name || projectPath.value.split(/[/\\]/).pop() || ''
})

const shellMainStyle = computed(() => ({
  '--shell-sidebar-width': effectiveSidebarCollapsed.value ? '0px' : `${sidebarWidth.value}px`,
}))

const openedEditorActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  [OPENED_EDITOR_CLOSE_ACTION_KEY, {
    title: t('sidebar.closeEditor', 'Close editor'),
    icon: 'action.close',
  }],
]))

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

const windowControls = computed<EzTitleBarWindowControl[]>(() => [
  { key: 'minimize', icon: 'mdi-window-minimize', hoverTip: 'Minimize' },
  { key: 'toggle-maximize', icon: 'mdi-window-maximize', hoverTip: 'Maximize / restore' },
  { key: 'close', icon: 'mdi-close', hoverTip: 'Close', danger: true },
])

const sidebarHeadButtons = computed<EzShellButton[]>(() => {
  if (isCreateProjectMode.value || isExportTemplateMode.value) {
    return [{
      key: 'return-workspace',
      icon: 'mdi-arrow-left',
      title: t('projectTemplates.actions.back'),
      disabled: isProjectTemplateBusy.value || isExportTemplateBusy.value,
    }]
  }
  if (isSettingsMode.value) {
    return [{ key: 'return-workspace', icon: 'mdi-arrow-left', title: t('settings.actions.back', 'Back') }]
  }
  if (isWelcomeMode.value) {
    return [
      { key: 'new-project', icon: 'mdi-folder-plus-outline', title: t('app.menu.newProject') },
      { key: 'open-project', icon: 'mdi-folder-open-outline', title: t('sidebar.openProject') },
    ]
  }
  return [
    { key: 'new-open-card', icon: 'mdi-plus-box-outline', title: t('app.menu.newOpenCard') },
    {
      key: 'publish-version',
      icon: 'mdi-publish',
      title: t('app.menu.publishVersion'),
      disabled: true,
    },
  ]
})

const sidebarTailButtons = computed<EzShellButton[]>(() => {
  if (isAuxiliaryMode.value) return []
  return [{ key: 'open-settings', icon: 'mdi-cog-outline', title: t('settings.title', 'Settings') }]
})

const sidebarBodyLists = computed<EzShellList[]>(() => {
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
            icon: 'mdi-folder-plus-outline',
            hoverTip: t('projectTemplates.actions.createTemplate'),
            disabled: !projectPath.value || isProjectTemplateBusy.value || templateStore.isLoading.value,
          },
          {
            key: IMPORT_TEMPLATE_ACTION_KEY,
            icon: 'mdi-import',
            hoverTip: t('projectTemplates.actions.import'),
            disabled: isProjectTemplateBusy.value || templateStore.isLoading.value,
          },
        ],
      },
    ]
  }

  if (isExportTemplateMode.value) return []

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
      title: projectName.value || t('sidebar.files'),
      placeholder: t('sidebar.emptyProject', 'Folder is empty'),
      actions: [],
    },
    {
      key: CHANGES_LIST_KEY,
      title: t('sidebar.changes'),
      placeholder: t('sidebar.comingSoon'),
      actions: [],
    },
  ]
})

const titleBarMenus = computed<EzTitleBarMenuGroup[]>(() => [
  {
    key: 'file',
    label: t('app.menu.file'),
    items: [
      { key: 'new-project', label: t('app.menu.newProject') },
      { key: 'new-open-card', label: t('app.menu.newOpenCard') },
      { key: 'open-project', label: t('sidebar.openProject') },
      { key: 'export-project-template', label: t('templateExport.menu'), disabled: !projectPath.value },
    ],
  },
  {
    key: 'export',
    label: 'Export',
    items: [
      { key: 'export-active-card-2x', label: t('app.menu.export2x') },
      { key: 'export-all-card-views', label: t('app.menu.exportAll') },
    ],
  },
])

const workspaceTitle = computed(() => {
  if (isCreateProjectMode.value) return t('projectTemplates.title')
  if (isExportTemplateMode.value) return t('templateExport.title')
  if (isSettingsMode.value) return activeSettingsCategory.value.title
  if (isWelcomeMode.value) return 'OpenCard'
  return activeSession.value?.name || projectName.value || 'OpenCard'
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
    activeSession.value.path ?? `untitled://${activeSession.value.id}`,
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

  const fileType = resolveSessionFileType(activeSession.value)
  const filePath = activeSession.value.path ?? `untitled://${activeSession.value.id}`
  const editor = editorRegistry.getEditor(fileType.editorId)
  if (editor && editor.id !== 'monaco') {
    const baseProps = {
      filePath,
      modelValue: activeSession.value.draftContent,
      'onUpdate:modelValue': (v: string) => { updateDraftContent(activeSession.value!.id, v) },
    }

    if (editor.id === 'card-designer') {
      return {
        ...baseProps,
        viewportTransform: activeSession.value.uiState?.cardDesigner?.viewportTransform,
        cardDesignerLayout: activeSession.value.uiState?.cardDesigner?.layout,
        structureTreeSelectionBehavior:
          settingsStore.settings.value.workspace.structureTreeSelectionBehavior,
        structureTreeScrollToSelection:
          settingsStore.settings.value.workspace.structureTreeScrollToSelection,
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
    'onUpdate:modelValue': (v: string) => { updateDraftContent(activeSession.value!.id, v) },
    language: currentLanguage.value,
    themeId: settingsStore.settings.value.appearance.theme,
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
  if (workspaceMode.value.type !== 'create-project' || listKey !== USER_TEMPLATES_LIST_KEY) return
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

function handleSettingsCategoryTreeIntent(intent: OcTreeIntent): void {
  if (intent.type !== 'selection.change') return

  const categoryKey = intent.selectedKeys[0]
  if (categoryKey === 'general' || categoryKey === 'appearance' || categoryKey === 'workspace') {
    workspaceMode.value = { type: 'settings', categoryKey }
  }
}

async function handleSettingsIntent(intent: SettingsIntent): Promise<void> {
  if (intent.type === 'setting.change') {
    settingsStore.updateSetting(intent.key, intent.value)
    return
  }

  await resetProjectWorkspaceState()
}

function handleOpenedEditorTreeIntent(intent: OcTreeIntent) {
  if (intent.type === 'selection.change') {
    handleOpenedEditorsSelect(intent.selectedKeys)
    return
  }

  if (intent.type === 'action.invoke' && intent.actionKey === OPENED_EDITOR_CLOSE_ACTION_KEY) {
    closeSession(intent.key)
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

async function openProject() {
  const previousProjectPath = projectPath.value
  const openedPath = await openProjectFn()
  if (!openedPath) return

  if (previousProjectPath && projectPath.value !== previousProjectPath) {
    detachWorkspaceSessions(previousProjectPath)
  }

  settingsStore.rememberRecentProject(projectPath.value)
  workspaceMode.value = { type: 'project' }
  await ensureProjectTreeLoaded()
}

async function openRecentProject(path: string): Promise<void> {
  const previousProjectPath = projectPath.value
  if (previousProjectPath && previousProjectPath !== path) {
    detachWorkspaceSessions(previousProjectPath)
  }
  await setProjectPath(path)
  settingsStore.rememberRecentProject(projectPath.value)
  selectedRecentProjectKeys.value = []
  workspaceMode.value = { type: 'project' }
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
  workspaceMode.value = { type: 'create-project' }
  void templateStore.load().catch(() => undefined)
}

async function handleProjectCreated(project: CreatedProject): Promise<void> {
  if (isActivatingProject.value) return
  isActivatingProject.value = true
  projectActivationError.value = ''

  try {
    if (projectPath.value) {
      detachWorkspaceSessions(projectPath.value)
    }

    await setProjectPath(project.path)
    settingsStore.rememberRecentProject(project.path)
    await ensureProjectTreeLoaded()
    await openEditorSession(project.entry)
    workspaceMode.value = { type: 'project' }
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
  workspaceMode.value = { type: 'project' }
  createUntitledSession({
    fileTypeId: 'opencard',
  })
}

async function runShellCommand(actionKey: string) {
  if ((isCreateProjectMode.value && isProjectTemplateBusy.value) || isExportTemplateBusy.value) return

  if (actionKey === 'open-settings') {
    workspaceMode.value = { type: 'settings', categoryKey: 'general' }
    return
  }

  if (actionKey === 'return-workspace') {
    workspaceMode.value = projectPath.value ? { type: 'project' } : { type: 'welcome' }
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


  if (actionKey === 'export-project-template') {
    if (projectPath.value) workspaceMode.value = { type: 'export-template' }
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

async function handleWorkspaceFrameAction(actionKey: string) {
  await runShellCommand(actionKey)
}

async function handleWindowControl(actionKey: string) {
  try {
    const appWindow = getCurrentWindow()

    if (actionKey === 'minimize') {
      await appWindow.minimize()
      return
    }

    if (actionKey === 'toggle-maximize') {
      await appWindow.toggleMaximize()
      return
    }

    if (actionKey === 'close') {
      await appWindow.close()
      return
    }
  } catch (error) {
    if (actionKey === 'close') {
      window.close()
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
  void ensureProjectTreeLoaded()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('resize', handleViewportResize)
})
</script>

<style scoped>
.ide-shell {
  color: var(--color-text-primary);
}

.ide-shell__workbench {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.ide-shell__workbench > :deep(*) {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.ide-shell__sidebar-tree {
  width: 100%;
  min-width: 0;
}
</style>
