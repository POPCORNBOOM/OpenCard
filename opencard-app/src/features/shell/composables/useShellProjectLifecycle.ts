import { computed, readonly, ref, type Ref } from 'vue'
import type { ProjectDirectoryKind } from '../../workspace/services/projectStructureService'
import type { CreatedProject } from '../../project-templates/model/projectTemplate'
import { reportAppError } from '../../logging/appErrorCatalog'
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
    classifyProjectDirectory: (path: string) => Promise<ProjectDirectoryKind>
    initializeProjectDirectory: (path: string) => Promise<void>
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
  const pendingInitialization = ref<{ path: string; entryPath?: string } | null>(null)

  async function ensureProjectTreeLoaded(): Promise<void> {
    if (!options.project.projectPath.value) return
    await options.project.readDirectoryEntries('', Number.POSITIVE_INFINITY)
  }

  async function activatePreparedProject(
    path: string,
    entryPath?: string,
    ensureStructure = false,
  ): Promise<boolean> {
    if (isActivating.value) return false

    isActivating.value = true
    activationError.value = ''
    const previousProjectPath = options.project.projectPath.value

    try {
      if (previousProjectPath && normalizePath(previousProjectPath) !== normalizePath(path)) {
        options.sessions.detachWorkspaceSessions(previousProjectPath)
      }

      if (ensureStructure) await options.project.initializeProjectDirectory(path)
      await options.project.setProjectPath(path)
      options.settings.rememberRecentProject(options.project.projectPath.value)
      if (entryPath) {
        await options.sessions.openFile(entryPath)
      }
      options.shellPage.value = { type: 'workbench' }
      return true
    } catch (error) {
      activationError.value = options.translate('projectTemplates.errors.activationFailed')
      reportAppError('OC-E3001', error)
      return false
    } finally {
      isActivating.value = false
    }
  }

  async function activateProject(path: string, entryPath?: string): Promise<boolean> {
    if (isActivating.value) return false
    activationError.value = ''
    try {
      const kind = await options.project.classifyProjectDirectory(path)
      if (kind === 'uninitialized') {
        pendingInitialization.value = { path, ...(entryPath ? { entryPath } : {}) }
        return false
      }
      if (kind === 'legacy') {
        activationError.value = options.translate('projectInitialization.errors.legacy')
        return false
      }
      if (kind === 'invalid') {
        activationError.value = options.translate('projectInitialization.errors.invalid')
        return false
      }
      return await activatePreparedProject(path, entryPath, true)
    } catch (error) {
      activationError.value = options.translate('projectTemplates.errors.activationFailed')
      reportAppError('OC-E3001', error)
      return false
    }
  }

  async function confirmProjectInitialization(): Promise<boolean> {
    const pending = pendingInitialization.value
    if (!pending || isActivating.value) return false
    isActivating.value = true
    activationError.value = ''
    try {
      await options.project.initializeProjectDirectory(pending.path)
      pendingInitialization.value = null
    } catch (error) {
      activationError.value = options.translate('projectInitialization.errors.failed')
      reportAppError('OC-E3001', error)
      return false
    } finally {
      isActivating.value = false
    }
    return await activatePreparedProject(pending.path, pending.entryPath)
  }

  function cancelProjectInitialization(): void {
    if (!isActivating.value) pendingInitialization.value = null
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
    projectInitializationOpen: computed(() => pendingInitialization.value !== null),
    projectInitializationPath: computed(() => pendingInitialization.value?.path ?? ''),
    confirmProjectInitialization,
    cancelProjectInitialization,
    openProject,
    openRecentProject,
    relocateRecentProject,
    activateCreatedProject,
    enterCreateProject,
    completeProjectClose,
    ensureProjectTreeLoaded,
  }
}
