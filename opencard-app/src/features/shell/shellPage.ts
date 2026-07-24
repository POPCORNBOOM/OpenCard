import type { SettingsCategoryKey } from '../settings/model/appSettings'

export type PrimaryShellPage = 'welcome' | 'workbench'

export type ShellPage =
  | { type: 'welcome' }
  | { type: 'workbench' }
  | { type: 'create-project'; returnPage: PrimaryShellPage }
  | { type: 'export-template'; returnPage: PrimaryShellPage }
  | { type: 'about'; returnPage: PrimaryShellPage }
  | { type: 'settings'; categoryKey: SettingsCategoryKey; returnPage: PrimaryShellPage }

export function getPrimaryShellPage(page: ShellPage): PrimaryShellPage {
  return page.type === 'welcome' || page.type === 'workbench'
    ? page.type
    : page.returnPage
}

export function resolveShellPageAfterProjectClose(page: ShellPage): ShellPage {
  return page.type === 'export-template' ? { type: 'workbench' } : page
}
