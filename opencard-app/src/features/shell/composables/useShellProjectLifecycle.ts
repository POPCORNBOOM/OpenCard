import { readonly, ref, type Ref } from 'vue'
import type { CreatedProject } from '../../project-templates/model/projectTemplate'
import {
  getPrimaryShellPage,
  resolveShellPageAfterProjectClose,
  type ProjectCloseDestination,
  type ShellPage,
} from '../shellPage'

type ProjectLifecycleOptions = {
  project: {
    projectPath: Readonly<Ref<string>>
    chooseProjectDirectory: () => Promise<string | null>
    setProjectPath: (path: string) => Promise<void>
    readDirectoryEntries: (path?: string, depth?: number) => Promise<void>
  }
  sessions: {
    detachWorkspaceSessions: (oldProjectRoot: string) => void
    closeWorkspaceSessions: () => void
    openFile: (path: string) => Promise<unknown>
  }
  settings: {
    rememberRecentProject: (path: string) => void
    forgetRecentProject: (path: string) => void
  }
  templates: {
    load: () => Promise<void>
  }
  shellPage: Ref<ShellPage>
  translate: (key: string) => string
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function useShellProjectLifecycle(options: ProjectLifecycleOptions) {
  const isActivating = ref(false)
  const activationError = ref('')

  async function ensureProjectTreeLoaded(): Promise<void> {
    if (!options.project.projectPath.value) return
    await options.project.readDirectoryEntries('', Number.POSITIVE_INFINITY)
  }

  async function activateProject(path: string, entryPath?: string): Promise<boolean> {
    if (isActivating.value) return false

    isActivating.value = true
    activationError.value = ''
    const previousProjectPath = options.project.projectPath.value

    try {
      if (previousProjectPath && normalizePath(previousProjectPath) !== normalizePath(path)) {
        options.sessions.detachWorkspaceSessions(previousProjectPath)
      }

      await options.project.setProjectPath(path)
      options.settings.rememberRecentProject(options.project.projectPath.value)
      if (entryPath) {
        await options.sessions.openFile(entryPath)
      }
      options.shellPage.value = { type: 'workbench' }
      return true
    } catch (error) {
      activationError.value = options.translate('projectTemplates.errors.activationFailed')
      console.error('激活项目失败:', error)
      return false
    } finally {
      isActivating.value = false
    }
  }

  async function openProject(): Promise<boolean> {
    const path = await options.project.chooseProjectDirectory()
    return path ? await activateProject(path) : false
  }

  async function openRecentProject(path: string): Promise<boolean> {
    return await activateProject(path)
  }

  async function relocateRecentProject(missingPath: string): Promise<string | null> {
    const selectedPath = await options.project.chooseProjectDirectory()
    if (!selectedPath) return null

    options.settings.forgetRecentProject(missingPath)
    options.settings.rememberRecentProject(selectedPath)
    return selectedPath
  }

  async function activateCreatedProject(project: CreatedProject): Promise<boolean> {
    return await activateProject(project.path, project.entry)
  }

  function enterCreateProject(): void {
    activationError.value = ''
    options.shellPage.value = {
      type: 'create-project',
      returnPage: getPrimaryShellPage(options.shellPage.value),
    }
    void options.templates.load().catch(() => undefined)
  }

  async function completeProjectClose(destination: ProjectCloseDestination = 'current'): Promise<void> {
    options.sessions.closeWorkspaceSessions()
    await options.project.setProjectPath('')
    options.shellPage.value = resolveShellPageAfterProjectClose(options.shellPage.value, destination)

    if (destination === 'create-project') {
      activationError.value = ''
      void options.templates.load().catch(() => undefined)
    }
  }

  return {
    isActivating: readonly(isActivating),
    activationError: readonly(activationError),
    openProject,
    openRecentProject,
    relocateRecentProject,
    activateCreatedProject,
    enterCreateProject,
    completeProjectClose,
    ensureProjectTreeLoaded,
  }
}
