import { OC_SHARED_THEME_TOKENS } from '../../shared/ui/foundation/themes'

/** Shell Sidebar 的结构 token 投影；数值来源仍是 foundation shared tokens。 */
export const SHELL_SIDEBAR_COLLAPSE_THRESHOLD = readPixels('--oc-shell-sidebar-collapse-threshold')

export function isRepositorySidebarReady(initialized: boolean | null): boolean {
  return initialized === true
}

function readPixels(token: keyof typeof OC_SHARED_THEME_TOKENS): number {
  const value = Number.parseFloat(OC_SHARED_THEME_TOKENS[token])
  if (!Number.isFinite(value)) throw new Error(`Invalid foundation pixel token: ${token}`)
  return value
}
