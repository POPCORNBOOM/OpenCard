import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const e2eWorkspacePath = resolve(appRoot, 'e2e/.tmp/OpenCard E2E 中文项目')
export const e2eSecondaryWorkspacePath = resolve(appRoot, 'e2e/.tmp/OpenCard E2E Secondary')
const storageRoot = join(homedir(), '.opencard')
const settingsPath = join(storageRoot, 'settings.json')
const backupPath = join(storageRoot, 'settings.e2e-backup.json')
const historyRoot = join(storageRoot, 'version-history/v1')

export function prepareE2eWorkspace() {
  restoreSettingsBackup()
  rmSync(e2eWorkspacePath, { recursive: true, force: true })
  rmSync(e2eSecondaryWorkspacePath, { recursive: true, force: true })
  writeWorkspace(e2eWorkspacePath, 'OpenCard E2E Fixture')
  writeWorkspace(e2eSecondaryWorkspacePath, 'OpenCard E2E Secondary')

  mkdirSync(storageRoot, { recursive: true })
  writeFileSync(backupPath, JSON.stringify({
    existed: existsSync(settingsPath),
    content: existsSync(settingsPath) ? readFileSync(settingsPath, 'utf8') : '',
  }))

  const document = readSettingsDocument()
  document['app-settings'].appearance = {
    ...(document['app-settings'].appearance ?? {}),
    locale: 'zh-CN',
    theme: 'dark',
  }
  const projectCreation = document['app-settings'].projectCreation ?? {}
  const normalizedPath = e2eWorkspacePath.replace(/\\/g, '/')
  const normalizedSecondaryPath = e2eSecondaryWorkspacePath.replace(/\\/g, '/')
  const recentProjects = Array.isArray(projectCreation.recentProjects)
    ? projectCreation.recentProjects.filter(path => path !== normalizedPath && path !== normalizedSecondaryPath)
    : []
  document['app-settings'].projectCreation = {
    ...projectCreation,
    recentProjects: [normalizedPath, normalizedSecondaryPath, ...recentProjects],
    workspaceStates: {
      ...(projectCreation.workspaceStates ?? {}),
      [normalizedPath]: { expandedDirectories: [] },
      [normalizedSecondaryPath]: { expandedDirectories: [] },
    },
  }
  writeFileSync(settingsPath, `${JSON.stringify(document, null, 2)}\n`)
  removeWorkspaceHistory(normalizedPath)
  removeWorkspaceHistory(normalizedSecondaryPath)
}

function writeWorkspace(path, name) {
  mkdirSync(path, { recursive: true })
  writeFileSync(join(path, '.ocproject'), `${JSON.stringify({
    name,
    description: 'Release desktop version management fixture.',
    version: '0.0.1',
    remoteResources: { mode: 'deny' },
  }, null, 2)}\n`)
  writeFileSync(join(path, 'README.md'), '# OpenCard E2E\n\nDesktop version management fixture.\n')
}

export function cleanupE2eWorkspace() {
  const normalizedPath = e2eWorkspacePath.replace(/\\/g, '/')
  const normalizedSecondaryPath = e2eSecondaryWorkspacePath.replace(/\\/g, '/')
  restoreSettingsBackup()
  removeWorkspaceHistory(normalizedPath)
  removeWorkspaceHistory(normalizedSecondaryPath)
  rmSync(e2eWorkspacePath, { recursive: true, force: true })
  rmSync(e2eSecondaryWorkspacePath, { recursive: true, force: true })
}

function readSettingsDocument() {
  if (!existsSync(settingsPath)) return { 'app-settings': { version: 1, projectCreation: {} } }
  const document = JSON.parse(readFileSync(settingsPath, 'utf8'))
  document['app-settings'] ??= { version: 1, projectCreation: {} }
  return document
}

function restoreSettingsBackup() {
  if (!existsSync(backupPath)) return
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'))
  if (backup.existed) writeFileSync(settingsPath, backup.content)
  else rmSync(settingsPath, { force: true })
  rmSync(backupPath, { force: true })
}

function removeWorkspaceHistory(normalizedPath) {
  if (!existsSync(historyRoot)) return
  for (const entry of readdirSync(historyRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const projectHistoryRoot = join(historyRoot, entry.name)
    const identityPath = join(projectHistoryRoot, 'identity.json')
    if (!existsSync(identityPath)) continue
    try {
      const identity = JSON.parse(readFileSync(identityPath, 'utf8'))
      if (identity.canonicalRoot === normalizedPath) {
        rmSync(projectHistoryRoot, { recursive: true, force: true })
      }
    } catch {
      // A malformed unrelated identity belongs to the product's recovery path.
    }
  }
}
