/**
 * 模块说明：
 * - 组装版本库切片：项目时间线与版本图状态、提交版本与初始化仓库的对话框流程。
 * 职责边界：
 * - 只维护版本库状态与其对话框动作；不渲染侧栏与对话框，也不创建编辑器对比会话。
 */
import { computed, ref, watch, type Ref } from 'vue'
import type {
  OcNodeCollection,
  OcNodeExpansionEvent,
  OcNodeExpansionSyncEvent,
} from '../../../shared/ui/node/node.types'
import type { DiffRevisionOption } from '../../version-control/diff.types'
import type { RepositoryInitializationInput } from '../../version-control/git.types'
import { createCommit, initializeRepository, stageAll } from '../../version-control/gitService'
import { useProjectTimeline } from '../../version-control/useProjectTimeline'
import type { EditorSession } from '../../workspace/store/editorSessionStore'
import { isRepositorySidebarReady } from '../shellSidebarConfig'

/**
 * 版本库切片要读取的 shell 状态与项目仓储投影。
 * 时间线跟随当前工作区文档，因此编辑器会话按名字直接注入。
 */
type ShellVersionControlOptions = {
  /** 当前项目根路径；空字符串表示未打开项目。 */
  projectPath: Readonly<Ref<string>>
  /** 当前编辑器会话；时间线只跟随其中的工作区文档。 */
  activeSession: Readonly<Ref<EditorSession | null>>
  /** 当前语言；时间线节点文案与相对时间由它决定。 */
  locale: Ref<string>
  /** i18n 翻译函数。 */
  translate: (key: string, fallback?: string) => string
  /** 项目文件变化版本号；变化后刷新版本库状态。 */
  fileChangeRevision: Readonly<Ref<number>>
  /** 工作区绝对路径转项目相对路径。 */
  getRelativeProjectPath: (path: string) => string
}

type ShellVersionControl = {
  /** 提交版本对话框；开关由 shell 的动作分发与下面的处理器共同维护。 */
  commitVersionDialogOpen: Ref<boolean>
  isCommittingVersion: Readonly<Ref<boolean>>
  commitVersionError: Ref<string>
  /** 初始化仓库对话框；开关由 shell 的动作分发与下面的处理器共同维护。 */
  initializeRepositoryDialogOpen: Ref<boolean>
  isInitializingRepository: Readonly<Ref<boolean>>
  initializeRepositoryError: Ref<string>
  repositoryInitializedDuringDialog: Ref<boolean>

  /** 当前工作区文档；没有工作区文档时时间线为空。 */
  timelineFilePath: Readonly<Ref<string | null>>
  timelineFileName: Readonly<Ref<string>>
  timelineTreeData: Readonly<Ref<OcNodeCollection>>
  timelineProjectTreeData: Readonly<Ref<OcNodeCollection>>
  changesTreeData: Readonly<Ref<OcNodeCollection>>
  timelineLoading: Readonly<Ref<boolean>>
  timelineRevisionOptions: Readonly<Ref<readonly DiffRevisionOption[]>>
  refreshTimeline: () => Promise<void>
  refreshTimelineStatus: () => Promise<void>
  timelinePlaceholder: Readonly<Ref<string>>
  versionGraphExpandedKeys: Readonly<Ref<string[]>>

  /** 版本库就绪状态；侧栏据此决定显示变更与版本图，还是显示初始化入口。 */
  repositoryReady: Readonly<Ref<boolean>>
  repositoryNeedsInitialization: Readonly<Ref<boolean>>

  handleVersionGraphExpansionChange: (event: OcNodeExpansionEvent) => void
  handleVersionGraphExpansionSync: (event: OcNodeExpansionSyncEvent) => void
  closeCommitVersionDialog: () => void
  closeInitializeRepositoryDialog: () => void
  initializeProjectRepository: (input: RepositoryInitializationInput) => Promise<void>
  commitVersion: (value: { summary: string; description: string }) => Promise<void>
}

export function useShellVersionControl(options: ShellVersionControlOptions): ShellVersionControl {
  const {
    projectPath,
    activeSession,
    locale,
    translate: t,
    fileChangeRevision,
    getRelativeProjectPath,
  } = options

  const commitVersionDialogOpen = ref(false)
  const isCommittingVersion = ref(false)
  const commitVersionError = ref('')
  const initializeRepositoryDialogOpen = ref(false)
  const isInitializingRepository = ref(false)
  const initializeRepositoryError = ref('')
  const repositoryInitializedDuringDialog = ref(false)

  const timelineFilePath = computed(() => {
    const session = activeSession.value
    if (!projectPath.value || session?.resourceKind !== 'workspace' || !session.path) return null
    return getRelativeProjectPath(session.path)
  })
  const projectTimeline = useProjectTimeline(
    projectPath,
    timelineFilePath,
    locale,
    computed(() => t('sidebar.timelineCompareWithDisk')),
  )
  const {
    treeData: timelineTreeData,
    projectTreeData: timelineProjectTreeData,
    changesTreeData,
    loading: timelineLoading,
    initialized: timelineInitialized,
    errorKind: timelineErrorKind,
    refresh: refreshTimeline,
    refreshStatus: refreshTimelineStatus,
    revisionOptions: timelineRevisionOptions,
  } = projectTimeline
  const repositoryReady = computed(() => isRepositorySidebarReady(timelineInitialized.value))
  const repositoryNeedsInitialization = computed(() => (
    timelineInitialized.value === false && !timelineErrorKind.value
  ))
  const versionGraphExpandedKeys = ref<string[]>([])
  watch(timelineProjectTreeData, data => {
    // 重载期间时间线会先发布一棵空树：数据已清空，历史尚未载入。
    // 空树不携带任何节点信息，不能据此判定展开键已失效，否则每次刷新都会丢掉展开状态。
    if (data.rootKeys.length === 0) return
    versionGraphExpandedKeys.value = versionGraphExpandedKeys.value.filter(key => data.children.has(key))
  })
  watch(fileChangeRevision, () => {
    if (projectPath.value) void refreshTimelineStatus()
  })
  const timelineFileName = computed(() => activeSession.value?.name ?? timelineFilePath.value?.split(/[\\/]/).pop() ?? 'ocdocument')

  function handleVersionGraphExpansionChange(event: OcNodeExpansionEvent): void {
    versionGraphExpandedKeys.value = event.expanded
      ? [...new Set([...versionGraphExpandedKeys.value, event.key])]
      : versionGraphExpandedKeys.value.filter(key => key !== event.key)
  }

  function handleVersionGraphExpansionSync(event: OcNodeExpansionSyncEvent): void {
    versionGraphExpandedKeys.value = event.expandedKeys
  }

  const timelinePlaceholder = computed(() => {
    if (!timelineFilePath.value) return t('sidebar.timelineNoFile')
    if (timelineLoading.value) return t('sidebar.timelineLoading')
    if (timelineErrorKind.value) return t('sidebar.timelineFailed')
    if (timelineInitialized.value === false) return t('sidebar.timelineNotInitialized')
    if (timelineInitialized.value === true && !projectTimeline.hasHistory.value) {
      return t('sidebar.timelineNoCommits')
    }
    return t('sidebar.timelineNoFile')
  })

  function closeCommitVersionDialog(): void {
    if (isCommittingVersion.value) return
    commitVersionDialogOpen.value = false
    commitVersionError.value = ''
  }

  function closeInitializeRepositoryDialog(): void {
    if (isInitializingRepository.value) return
    initializeRepositoryDialogOpen.value = false
    initializeRepositoryError.value = ''
    repositoryInitializedDuringDialog.value = false
  }

  async function initializeProjectRepository(input: RepositoryInitializationInput): Promise<void> {
    const root = projectPath.value
    if (!root || isInitializingRepository.value) return
    isInitializingRepository.value = true
    initializeRepositoryError.value = ''
    try {
      if (!repositoryInitializedDuringDialog.value) {
        const initialized = await initializeRepository(root, input.identity)
        if (!initialized.ok || !initialized.value) {
          initializeRepositoryError.value = initialized.error?.message ?? t('sidebar.initializeDialog.failed')
          return
        }
        repositoryInitializedDuringDialog.value = true
        await refreshTimeline()
      }

      if (input.createInitialCommit) {
        const staged = await stageAll(root)
        if (!staged.ok || !staged.value) {
          initializeRepositoryError.value = t('sidebar.initializeDialog.initialCommitFailed')
          return
        }
        const committed = await createCommit(root, { message: t('sidebar.initializeDialog.initialCommitMessage') })
        if (!committed.ok || !committed.value) {
          initializeRepositoryError.value = t('sidebar.initializeDialog.initialCommitFailed')
          return
        }
      }

      initializeRepositoryDialogOpen.value = false
      repositoryInitializedDuringDialog.value = false
      await refreshTimeline()
    } catch (error) {
      if (error instanceof Error) {
        initializeRepositoryError.value = error.message
      } else if (repositoryInitializedDuringDialog.value) {
        initializeRepositoryError.value = t('sidebar.initializeDialog.initialCommitFailed')
      } else {
        initializeRepositoryError.value = t('sidebar.initializeDialog.failed')
      }
    } finally {
      isInitializingRepository.value = false
    }
  }

  async function commitVersion(value: { summary: string; description: string }): Promise<void> {
    const root = projectPath.value
    if (!root || isCommittingVersion.value) return
    isCommittingVersion.value = true
    commitVersionError.value = ''
    try {
      const staged = await stageAll(root)
      if (!staged.ok || !staged.value) {
        commitVersionError.value = staged.error?.message ?? t('sidebar.commitDialog.failed')
        return
      }
      const message = value.description ? `${value.summary}\n\n${value.description}` : value.summary
      const result = await createCommit(root, { message })
      if (!result.ok || !result.value) {
        commitVersionError.value = result.error?.message ?? t('sidebar.commitDialog.failed')
        return
      }
      commitVersionDialogOpen.value = false
      await refreshTimeline()
    } catch (error) {
      commitVersionError.value = error instanceof Error ? error.message : t('sidebar.commitDialog.failed')
    } finally {
      isCommittingVersion.value = false
    }
  }

  return {
    commitVersionDialogOpen,
    isCommittingVersion,
    commitVersionError,
    initializeRepositoryDialogOpen,
    isInitializingRepository,
    initializeRepositoryError,
    repositoryInitializedDuringDialog,
    timelineFilePath,
    timelineFileName,
    timelineTreeData,
    timelineProjectTreeData,
    changesTreeData,
    timelineLoading,
    timelineRevisionOptions,
    refreshTimeline,
    refreshTimelineStatus,
    timelinePlaceholder,
    versionGraphExpandedKeys,
    repositoryReady,
    repositoryNeedsInitialization,
    handleVersionGraphExpansionChange,
    handleVersionGraphExpansionSync,
    closeCommitVersionDialog,
    closeInitializeRepositoryDialog,
    initializeProjectRepository,
    commitVersion,
  }
}
