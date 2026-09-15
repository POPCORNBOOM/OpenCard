import { OC_SHARED_THEME_TOKENS } from '../../shared/ui/foundation/themes'

/** Shell Sidebar 的结构 token 投影；数值来源仍是 foundation shared tokens。 */
export const SHELL_SIDEBAR_COLLAPSE_THRESHOLD = readPixels('--oc-shell-sidebar-collapse-threshold')

/** 侧栏列表键；侧栏描述符与列表动作分发共用同一份定义。 */
export const PROJECT_FILES_LIST_KEY = 'project-files'
export const PROJECT_MANAGEMENT_LIST_KEY = 'project-management'
export const OPENED_EDITORS_LIST_KEY = 'opened-editors'
export const RECENT_PROJECTS_LIST_KEY = 'recent-projects'
export const TIMELINE_LIST_KEY = 'timeline'
export const SETTINGS_CATEGORIES_LIST_KEY = 'settings-categories'
export const TEMPLATES_LIST_KEY = 'templates'
export const RESOURCE_PACKAGES_LIST_KEY = 'resource-packages'
export const USER_TEMPLATES_GROUP_KEY = 'template-group:user'
export const TEMPLATE_ENTRIES_LIST_KEY = 'template-entries'
export const TEMPLATE_COVERS_LIST_KEY = 'template-covers'

/** 侧栏列表动作键；同样由侧栏描述符与列表动作分发共用。 */
export const TIMELINE_REFRESH_ACTION_KEY = 'timeline.refresh'
/** 把软件存储里的附加包导入存储、附加到新项目、或从存储里移除。 */
export const IMPORT_RESOURCE_PACKAGE_ACTION_KEY = 'resource-package.import'
export const PROJECT_NEW_FILE_ACTION_KEY = 'project.new-file'
export const PROJECT_NEW_OPENCARD_ACTION_KEY = 'project.new-file.ocdocument'
export const PROJECT_NEW_FOLDER_ACTION_KEY = 'project.new-folder'
export const PROJECT_REVEAL_ACTION_KEY = 'project.reveal'

export function isRepositorySidebarReady(initialized: boolean | null): boolean {
  return initialized === true
}

function readPixels(token: keyof typeof OC_SHARED_THEME_TOKENS): number {
  const value = Number.parseFloat(OC_SHARED_THEME_TOKENS[token])
  if (!Number.isFinite(value)) throw new Error(`Invalid foundation pixel token: ${token}`)
  return value
}
