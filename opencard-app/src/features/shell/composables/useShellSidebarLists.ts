/**
 * 模块说明：
 * - 组装侧栏的头部与尾部按钮，按当前页面生成列表描述符，再组织成侧栏分组。
 * 职责边界：
 * - 只把 shell 状态投影成侧栏描述符；不渲染侧栏、不维护侧栏布局，也不实现列表动作本身。
 */
import { computed, type ComputedRef, type Ref } from 'vue'
import type {
  OcNodeActionEvent,
  OcNodeActivateEvent,
  OcNodeCollection,
  OcNodeExpansionEvent,
  OcNodeExpansionSyncEvent,
  OcNodeExternalDropEvent,
  OcNodeMoveEvent,
  OcNodeRenameCommitEvent,
  OcNodeSelectionEvent,
} from '../../../shared/ui/node/node.types'
import type { ProjectTemplateKey } from '../../project-templates/model/projectTemplate'
import type { SettingsCategoryKey } from '../../settings/model/appSettings'
import type { StoredResourcePackageStore } from '../../workspace/store/storedResourcePackageStore'
import type { ShellPage } from '../shellPage'
import {
  IMPORT_RESOURCE_PACKAGE_ACTION_KEY,
  OPENED_EDITORS_LIST_KEY,
  PROJECT_FILES_LIST_KEY,
  PROJECT_MANAGEMENT_LIST_KEY,
  PROJECT_NEW_FILE_ACTION_KEY,
  PROJECT_NEW_FOLDER_ACTION_KEY,
  PROJECT_NEW_OPENCARD_ACTION_KEY,
  PROJECT_REVEAL_ACTION_KEY,
  RECENT_PROJECTS_LIST_KEY,
  RESOURCE_PACKAGES_LIST_KEY,
  SETTINGS_CATEGORIES_LIST_KEY,
  TEMPLATES_LIST_KEY,
  TEMPLATE_COVERS_LIST_KEY,
  TEMPLATE_ENTRIES_LIST_KEY,
  TIMELINE_LIST_KEY,
  TIMELINE_REFRESH_ACTION_KEY,
  USER_TEMPLATES_GROUP_KEY,
} from '../shellSidebarConfig'
import type { ShellButton, ShellList, ShellListGroup } from '../shell.types'

/**
 * 侧栏列表要读取的全部 shell 状态、仓储与动作处理器。
 * 这些投影本来就依赖 shell 的整块表面，因此按名字直接注入，不做二次封装。
 */
type ShellSidebarListsOptions = {
  /** i18n 翻译函数；部分侧栏文案带内置兜底。 */
  translate: (key: string, fallback?: string) => string

  /** 当前页面与互斥的页面模式标记。 */
  shellPage: Readonly<Ref<ShellPage>>
  isSettingsMode: Readonly<Ref<boolean>>
  isCreateProjectMode: Readonly<Ref<boolean>>
  isExportTemplateMode: Readonly<Ref<boolean>>
  isWelcomeMode: Readonly<Ref<boolean>>
  isAboutMode: Readonly<Ref<boolean>>
  isAuxiliaryMode: Readonly<Ref<boolean>>

  /** 页面忙碌标记，用于禁用侧栏按钮与列表动作。 */
  isProjectTemplateBusy: Readonly<Ref<boolean>>
  isExportTemplateBusy: Readonly<Ref<boolean>>
  isCommittingVersion: Readonly<Ref<boolean>>
  isInitializingRepository: Readonly<Ref<boolean>>

  /** 项目与版本库状态。 */
  projectOpen: Readonly<Ref<boolean>>
  projectPath: Readonly<Ref<string>>
  projectFolderName: Readonly<Ref<string>>
  repositoryReady: Readonly<Ref<boolean>>
  repositoryNeedsInitialization: Readonly<Ref<boolean>>

  /** 项目文件树实例；侧栏只把绑定后的 beginRename 写回这个 ref。 */
  projectTreeRef: Ref<{ beginRename: (key: string) => Promise<void> } | null>

  /** 设置页的分类树与当前分类。 */
  settingsCategoryKey: Readonly<Ref<SettingsCategoryKey>>
  settingsCategoryTreeData: Readonly<Ref<OcNodeCollection>>

  /** 新建项目页的模板与附加包。 */
  selectedTemplateKey: Readonly<Ref<ProjectTemplateKey | null>>
  templateTreeData: Readonly<Ref<OcNodeCollection>>
  resourcePackageStore: Pick<StoredResourcePackageStore, 'isLoading'>
  resourcePackageTreeData: Readonly<Ref<OcNodeCollection>>

  /** 导出模板页的目录树、已选条目与已选封面。 */
  exportTemplateTreeData: Readonly<Ref<OcNodeCollection>>
  exportTemplateExpandedKeys: Readonly<Ref<string[]>>
  exportTemplateEntryTreeData: Readonly<Ref<OcNodeCollection>>
  exportTemplateCoverTreeData: Readonly<Ref<OcNodeCollection>>

  /** 欢迎页的最近项目列表。 */
  recentProjectTreeData: Readonly<Ref<OcNodeCollection>>
  selectedRecentProjectKeys: Readonly<Ref<string[]>>

  /** 工作台的已打开编辑器、项目管理与项目文件树。 */
  openedEditorTreeData: Readonly<Ref<OcNodeCollection>>
  openedEditorSelectedKeys: Readonly<Ref<string[]>>
  projectManagementTreeData: Readonly<Ref<OcNodeCollection>>
  selectedManagementKeys: Readonly<Ref<string[]>>
  projectManagementExpandedKeys: Readonly<Ref<string[]>>
  projectTreeData: Readonly<Ref<OcNodeCollection>>
  selectedProjectEntryKeys: Readonly<Ref<string[]>>
  projectExpandedKeys: Readonly<Ref<string[]>>

  /** 工作台的版本管理列表（变更与版本图）。 */
  timelinePlaceholder: Readonly<Ref<string>>
  timelineFilePath: Readonly<Ref<string | null>>
  timelineLoading: Readonly<Ref<boolean>>
  timelineTreeData: Readonly<Ref<OcNodeCollection>>
  timelineProjectTreeData: Readonly<Ref<OcNodeCollection>>
  changesTreeData: Readonly<Ref<OcNodeCollection>>
  versionGraphExpandedKeys: Readonly<Ref<string[]>>

  /** 树与列表的动作处理器；列表描述符只引用它们。 */
  handleSettingsCategorySelectionChange: (event: OcNodeSelectionEvent) => void
  handleTemplateSelectionChange: (event: OcNodeSelectionEvent) => Promise<void>
  handleTemplateAction: (event: OcNodeActionEvent) => Promise<void>
  handleResourcePackageAction: (event: OcNodeActionEvent) => void
  handleExportTemplateAction: (event: OcNodeActionEvent) => void
  handleExportSelectionAction: (event: OcNodeActionEvent) => void
  handleRecentProjectSelectionChange: (event: OcNodeSelectionEvent) => void
  handleRecentProjectNodeActivate: (event: OcNodeActivateEvent) => void
  handleRecentProjectAction: (event: OcNodeActionEvent) => void
  handleOpenedEditorSelectionChange: (event: OcNodeSelectionEvent) => void
  handleOpenedEditorAction: (event: OcNodeActionEvent) => Promise<void>
  handleOpenedEditorAuxClick: (event: MouseEvent) => Promise<void>
  handleProjectManagementSelectionChange: (event: OcNodeSelectionEvent) => Promise<void>
  handleProjectManagementExpansionChange: (event: OcNodeExpansionEvent) => void
  handleProjectManagementAction: (event: OcNodeActionEvent) => Promise<void>
  handleProjectSelectionChange: (event: OcNodeSelectionEvent) => Promise<void>
  handleProjectExpansionChange: (event: OcNodeExpansionEvent) => Promise<void>
  handleProjectRenameCommit: (event: OcNodeRenameCommitEvent) => Promise<void>
  handleProjectMove: (event: OcNodeMoveEvent) => Promise<void>
  handleProjectExternalDrop: (event: OcNodeExternalDropEvent) => Promise<void>
  handleProjectAction: (event: OcNodeActionEvent) => Promise<void>
  handleProjectNodeActivate: (event: OcNodeActivateEvent) => Promise<void>
  handleTimelineAction: (event: OcNodeActionEvent) => Promise<void>
  handleVersionGraphExpansionChange: (event: OcNodeExpansionEvent) => void
  handleVersionGraphExpansionSync: (event: OcNodeExpansionSyncEvent) => void
}

type ShellSidebarLists = {
  sidebarTailButtons: ComputedRef<ShellButton[]>
  sidebarBodyGroups: ComputedRef<ShellListGroup[]>
}

export function useShellSidebarLists(options: ShellSidebarListsOptions): ShellSidebarLists {
  const {
    translate: t,
    shellPage,
    isSettingsMode,
    isCreateProjectMode,
    isExportTemplateMode,
    isWelcomeMode,
    isAboutMode,
    isAuxiliaryMode,
    isProjectTemplateBusy,
    isExportTemplateBusy,
    isCommittingVersion,
    isInitializingRepository,
    projectOpen,
    projectPath,
    projectFolderName,
    repositoryReady,
    repositoryNeedsInitialization,
    projectTreeRef,
    settingsCategoryKey,
    settingsCategoryTreeData,
    selectedTemplateKey,
    templateTreeData,
    resourcePackageStore,
    resourcePackageTreeData,
    exportTemplateTreeData,
    exportTemplateExpandedKeys,
    exportTemplateEntryTreeData,
    exportTemplateCoverTreeData,
    recentProjectTreeData,
    selectedRecentProjectKeys,
    openedEditorTreeData,
    openedEditorSelectedKeys,
    projectManagementTreeData,
    selectedManagementKeys,
    projectManagementExpandedKeys,
    projectTreeData,
    selectedProjectEntryKeys,
    projectExpandedKeys,
    timelinePlaceholder,
    timelineFilePath,
    timelineLoading,
    timelineTreeData,
    timelineProjectTreeData,
    changesTreeData,
    versionGraphExpandedKeys,
    handleSettingsCategorySelectionChange,
    handleTemplateSelectionChange,
    handleTemplateAction,
    handleResourcePackageAction,
    handleExportTemplateAction,
    handleExportSelectionAction,
    handleRecentProjectSelectionChange,
    handleRecentProjectNodeActivate,
    handleRecentProjectAction,
    handleOpenedEditorSelectionChange,
    handleOpenedEditorAction,
    handleOpenedEditorAuxClick,
    handleProjectManagementSelectionChange,
    handleProjectManagementExpansionChange,
    handleProjectManagementAction,
    handleProjectSelectionChange,
    handleProjectExpansionChange,
    handleProjectRenameCommit,
    handleProjectMove,
    handleProjectExternalDrop,
    handleProjectAction,
    handleProjectNodeActivate,
    handleTimelineAction,
    handleVersionGraphExpansionChange,
    handleVersionGraphExpansionSync,
  } = options

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
    return []
  })

  const sidebarTailButtons = computed<ShellButton[]>(() => {
    if (isAuxiliaryMode.value) return []
    return [{ key: 'open-settings', icon: 'tool.settings', title: t('settings.title', 'Settings') }]
  })

  function captureProjectTreeInstance(instance: unknown): void {
    const tree = instance as { beginRename?: (key: string) => Promise<void> } | null
    projectTreeRef.value = typeof tree?.beginRename === 'function'
      ? { beginRename: tree.beginRename.bind(tree) }
      : null
  }

  const sidebarBodyLists = computed<ShellList[]>(() => {
    if (isAboutMode.value) return []

    if (isSettingsMode.value) {
      return [{
        key: SETTINGS_CATEGORIES_LIST_KEY,
        title: t('settings.title', 'Settings'),
        placeholder: '',
        actions: [],
        content: {
          type: 'tree',
          data: settingsCategoryTreeData.value,
          selectedKeys: [settingsCategoryKey.value],
          role: 'listbox',
          selectionMode: 'single',
          activationMode: 'none',
          onSelectionChange: handleSettingsCategorySelectionChange,
        },
      }]
    }

    if (isCreateProjectMode.value) {
      return [
        {
          key: TEMPLATES_LIST_KEY,
          title: t('projectTemplates.sections.templates'),
          placeholder: '',
          actions: [],
          content: {
            type: 'tree',
            data: templateTreeData.value,
            selectedKeys: selectedTemplateKey.value ? [selectedTemplateKey.value] : [],
            expandedKeys: [USER_TEMPLATES_GROUP_KEY],
            role: 'tree',
            selectionMode: 'single',
            activationMode: 'none',
            onSelectionChange: handleTemplateSelectionChange,
            onAction: handleTemplateAction,
          },
        },
        {
          key: RESOURCE_PACKAGES_LIST_KEY,
          title: t('projectTemplates.sections.resourcePackages'),
          placeholder: resourcePackageStore.isLoading.value
            ? t('projectTemplates.status.loadingResourcePackages')
            : t('projectTemplates.status.noResourcePackages'),
          actions: [{
            key: IMPORT_RESOURCE_PACKAGE_ACTION_KEY,
            icon: 'action.import',
            hoverTip: t('projectTemplates.actions.importResourcePackage'),
            disabled: isProjectTemplateBusy.value || resourcePackageStore.isLoading.value,
          }],
          content: {
            type: 'tree',
            data: resourcePackageTreeData.value,
            role: 'listbox',
            selectionMode: 'none',
            activationMode: 'none',
            onAction: handleResourcePackageAction,
          },
        },
      ]
    }

    if (isExportTemplateMode.value) {
      const projectContent = {
        type: 'tree' as const,
        data: exportTemplateTreeData.value,
        selectedKeys: selectedProjectEntryKeys.value,
        expandedKeys: exportTemplateExpandedKeys.value,
        role: 'tree' as const,
        selectionMode: 'single' as const,
        activationMode: 'none' as const,
        onAction: handleExportTemplateAction,
        captureInstance: captureProjectTreeInstance,
      }
      return [
        {
          key: PROJECT_FILES_LIST_KEY,
          title: projectFolderName.value || t('sidebar.files'),
          placeholder: t('sidebar.emptyProject', 'Folder is empty'),
          actions: [],
          content: projectContent,
        },
        {
          key: TEMPLATE_ENTRIES_LIST_KEY,
          title: t('projectTemplates.fields.entry'),
          placeholder: t('templateExport.noSelectedEntries'),
          actions: [],
          content: {
            type: 'tree',
            data: exportTemplateEntryTreeData.value,
            selectedKeys: [],
            role: 'listbox',
            selectionMode: 'none',
            activationMode: 'none',
            onAction: handleExportSelectionAction,
          },
        },
        {
          key: TEMPLATE_COVERS_LIST_KEY,
          title: t('projectTemplates.fields.covers'),
          placeholder: t('templateExport.noSelectedCovers'),
          actions: [],
          content: {
            type: 'tree',
            data: exportTemplateCoverTreeData.value,
            selectedKeys: [],
            role: 'listbox',
            selectionMode: 'none',
            activationMode: 'none',
            onAction: handleExportSelectionAction,
          },
        },
      ]
    }

    if (isWelcomeMode.value) {
      return [{
        key: RECENT_PROJECTS_LIST_KEY,
        title: t('sidebar.recentProjects'),
        placeholder: t('sidebar.noRecentProjects'),
        actions: [],
        content: {
          type: 'tree',
          data: recentProjectTreeData.value,
          selectedKeys: selectedRecentProjectKeys.value,
          role: 'listbox',
          selectionMode: 'single',
          activationMode: 'double-click',
          onSelectionChange: handleRecentProjectSelectionChange,
          onNodeActivate: handleRecentProjectNodeActivate,
          onAction: handleRecentProjectAction,
        },
      }]
    }

    const lists: ShellList[] = [
      {
        key: OPENED_EDITORS_LIST_KEY,
        title: t('sidebar.openedEditors'),
        placeholder: t('sidebar.noOpenedEditors', 'No open editors'),
        actions: [],
        content: {
          type: 'tree',
          data: openedEditorTreeData.value,
          selectedKeys: openedEditorSelectedKeys.value,
          role: 'listbox',
          selectionMode: 'single',
          activationMode: 'none',
          onSelectionChange: handleOpenedEditorSelectionChange,
          onAction: handleOpenedEditorAction,
          onAuxclick: handleOpenedEditorAuxClick,
        },
      },
      {
        key: PROJECT_MANAGEMENT_LIST_KEY,
        title: t('sidebar.projectManagement'),
        placeholder: '',
        actions: [],
        content: {
          type: 'tree',
          data: projectManagementTreeData.value,
          selectedKeys: selectedManagementKeys.value,
          expandedKeys: projectManagementExpandedKeys.value,
          role: 'tree',
          selectionMode: 'single',
          activationMode: 'none',
          onSelectionChange: handleProjectManagementSelectionChange,
          onExpansionChange: handleProjectManagementExpansionChange,
          onAction: handleProjectManagementAction,
        },
      },
      {
        key: PROJECT_FILES_LIST_KEY,
        title: projectFolderName.value || t('sidebar.files'),
        placeholder: projectPath.value
          ? t('sidebar.emptyProject', 'Folder is empty')
          : t('sidebar.openProject', 'Open Project Folder'),
        actions: [
          {
            key: PROJECT_REVEAL_ACTION_KEY,
            icon: 'status.folder-open',
            hoverTip: t('sidebar.fileActions.reveal'),
            disabled: !projectPath.value,
          },
          {
            key: PROJECT_NEW_FILE_ACTION_KEY,
            icon: 'action.file-plus',
            hoverTip: t('sidebar.fileActions.newFile'),
            disabled: !projectPath.value,
            children: [{
              key: PROJECT_NEW_OPENCARD_ACTION_KEY,
              title: t('sidebar.fileActions.newOpenCard'),
              icon: 'file.opencard',
            }],
          },
          {
            key: PROJECT_NEW_FOLDER_ACTION_KEY,
            icon: 'action.folder-plus',
            hoverTip: t('sidebar.fileActions.newFolder'),
            disabled: !projectPath.value,
          },
        ],
        content: {
          type: 'tree',
          data: projectTreeData.value,
          selectedKeys: selectedProjectEntryKeys.value,
          expandedKeys: projectExpandedKeys.value,
          role: 'tree',
          selectionMode: 'single',
          activationMode: 'double-click',
          onSelectionChange: handleProjectSelectionChange,
          onExpansionChange: handleProjectExpansionChange,
          onRenameCommit: handleProjectRenameCommit,
          onMove: handleProjectMove,
          onExternalDrop: handleProjectExternalDrop,
          externalDrop: projectOpen.value,
          onAction: handleProjectAction,
          onNodeActivate: handleProjectNodeActivate,
          captureInstance: captureProjectTreeInstance,
        },
      },
    ]
    if (repositoryReady.value) {
      lists.push({
        key: TIMELINE_LIST_KEY,
        title: t('sidebar.timeline'),
        placeholder: timelinePlaceholder.value,
        actions: [{
          key: TIMELINE_REFRESH_ACTION_KEY,
          icon: 'action.refresh',
          hoverTip: t('sidebar.timelineRefresh'),
          disabled: !timelineFilePath.value || timelineLoading.value,
        }],
        content: {
          type: 'tree',
          data: timelineTreeData.value,
          selectedKeys: [],
          role: 'tree',
          selectionMode: 'none',
          activationMode: 'none',
          onAction: handleTimelineAction,
        },
      })
    }
    return lists
  })

  const sidebarBodyGroups = computed<ShellListGroup[]>(() => {
    if (isSettingsMode.value || isCreateProjectMode.value || isExportTemplateMode.value || isWelcomeMode.value || isAboutMode.value) {
      return [{
        key: 'primary',
        transitionKey: `page:${shellPage.value.type}`,
        title: '',
        headButtons: sidebarHeadButtons.value,
        lists: sidebarBodyLists.value,
      }];
    }
    const lists = sidebarBodyLists.value;
    const groups: ShellListGroup[] = [
      {
        key: 'workspace',
        title: t('sidebar.workspaceGroup', 'Workspace'),
        icon: 'status.folder-open',
        headButtons: [{ key: 'new-open-card', icon: 'action.file-plus', title: t('app.menu.newOpenCard') }],
        lists,
      },
      {
        key: 'version-control',
        title: t('sidebar.versionControlGroup', 'Version Control'),
        icon: 'file.git',
        headButtons: repositoryNeedsInitialization.value
          ? [{
              key: 'initialize-repository',
              icon: 'file.git',
              title: t('sidebar.initializeRepository', 'Initialize repository'),
              disabled: isInitializingRepository.value,
            }]
          : repositoryReady.value
            ? [{
                key: 'publish-version',
                icon: 'action.publish',
                title: t('sidebar.commitVersion', 'Commit version'),
                disabled: changesTreeData.value.rootKeys.length === 0 || isCommittingVersion.value,
              }]
            : [],
        lists: repositoryReady.value
          ? [
              {
                key: 'changes',
                title: t('sidebar.changes', 'Changes'),
                placeholder: t('sidebar.changesEmpty', 'Uncommitted project files appear here'),
                actions: [],
                content: {
                  type: 'tree',
                  data: changesTreeData.value,
                  selectedKeys: [],
                  role: 'tree',
                  selectionMode: 'none',
                  activationMode: 'none',
                },
              },
              {
                key: 'version-graph',
                title: t('sidebar.versionGraph', 'Version graph'),
                placeholder: t('sidebar.versionGraphEmpty', 'Project commits appear here'),
                actions: [],
                content: {
                  type: 'tree',
                  data: timelineProjectTreeData.value,
                  selectedKeys: [],
                  expandedKeys: versionGraphExpandedKeys.value,
                  role: 'tree',
                  selectionMode: 'none',
                  activationMode: 'none',
                  onExpansionChange: handleVersionGraphExpansionChange,
                  onExpansionSync: handleVersionGraphExpansionSync,
                },
              },
            ]
          : [],
      },
    ];
    return groups;
  });

  return { sidebarTailButtons, sidebarBodyGroups }
}
