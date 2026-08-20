import { computed, ref, watch, type Ref } from 'vue'

import type { OcTreeData } from '../../shared/ui/tree/tree.types'
import { inspectRepository, readFileHistory, readHistory, readStatus } from './gitService'
import { formatRelativeTime } from '../../shared/i18n/relativeTime'
import type { CommitSummary, GitErrorKind, GitStatusEntry } from './git.types'
import type { DiffRevisionOption } from './diff.types'
import { resolveEntryIcon } from '../workspace/model/fileTypes'

const HISTORY_LIMIT = 50
export const TIMELINE_COMPARE_WITH_DISK_ACTION_KEY = 'timeline.compare-with-disk'

const emptyHistoryResult = () => ({
  ok: true as const,
  value: [] as CommitSummary[],
  error: null,
  retryable: false,
  authenticationRequired: false,
  conflicted: false,
  continuable: false,
  abortable: false,
})

export function useProjectTimeline(
  projectPath: Ref<string | null | undefined>,
  currentFilePath: Ref<string | null | undefined>,
  locale: Ref<string>,
) {
  const commits = ref<CommitSummary[]>([])
  const projectCommits = ref<CommitSummary[]>([])
  const changePaths = ref<string[]>([])
  const loading = ref(false)
  const historyLoaded = ref(false)
  const initialized = ref<boolean | null>(null)
  const errorKind = ref<GitErrorKind | null>(null)
  let requestRevision = 0
  let statusRequestRevision = 0

  function createCommitTree(
    commits: CommitSummary[],
    keyPrefix: string,
    visible = historyLoaded.value,
    actions: readonly string[] = [],
    includeChangedPaths = false,
  ): OcTreeData {
    if (!visible) return { rootKeys: [], items: new Map(), children: new Map() }
    const items = new Map<string, OcTreeData['items'] extends ReadonlyMap<string, infer Item> ? Item : never>()
    const children = new Map<string, readonly string[]>()
    const rootKeys = commits.map(commit => `${keyPrefix}:${commit.id}`)
    for (const commit of commits) {
      const key = `${keyPrefix}:${commit.id}`
      items.set(key, {
        label: `${commit.summary.trim() || commit.shortId} · ${commit.shortId}`,
        tail: formatRelativeTime(commit.authoredAtSeconds * 1000, locale.value),
        icon: 'file.git',
        actions,
      })
      const changedPaths = Array.isArray(commit.changedPaths) ? commit.changedPaths : []
      if (!includeChangedPaths || changedPaths.length === 0) continue
      const childKeys = changedPaths.map((path, index) => `${key}:file:${index}:${path}`)
      children.set(key, childKeys)
      changedPaths.forEach((path, index) => {
        const presentation = resolveEntryIcon(path, false)
        items.set(childKeys[index]!, {
          label: path,
          icon: presentation.icon,
          iconTone: presentation.tone,
        })
      })
    }
    return { rootKeys, items, children }
  }

  const treeData = computed(() => createCommitTree(
    commits.value,
    'timeline',
    Boolean(currentFilePath.value) && historyLoaded.value,
    [TIMELINE_COMPARE_WITH_DISK_ACTION_KEY],
  ))
  const projectTreeData = computed(() => createCommitTree(
    projectCommits.value,
    'project-timeline',
    historyLoaded.value,
    [],
    true,
  ))

  const changesTreeData = computed<OcTreeData>(() => {
    const items = new Map<string, OcTreeData['items'] extends ReadonlyMap<string, infer Item> ? Item : never>()
    const rootKeys = changePaths.value.map(path => `change:${path}`)
    for (const path of changePaths.value) {
      const presentation = resolveEntryIcon(path, false)
      items.set(`change:${path}`, { label: path, icon: presentation.icon, iconTone: presentation.tone })
    }
    return { rootKeys, items, children: new Map() }
  })

  const revisionOptions = computed<DiffRevisionOption[]>(() => [
    { commitId: null, label: locale.value === 'zh-CN' ? '磁盘版本' : 'Disk version' },
    ...commits.value.map(commit => ({
      commitId: commit.id,
      label: commit.summary.trim() || commit.shortId,
      shortId: commit.shortId,
      authoredAtSeconds: commit.authoredAtSeconds,
    })),
  ])

  function updateChangePaths(entries: readonly GitStatusEntry[]): void {
    changePaths.value = [...new Set(entries
      .filter(entry => (
        entry.indexNew || entry.indexModified || entry.indexDeleted
        || entry.worktreeNew || entry.worktreeModified || entry.worktreeDeleted
        || entry.conflicted
      ))
      .map(entry => entry.path))]
  }

  async function refreshStatus(): Promise<void> {
    const revision = ++statusRequestRevision
    const root = projectPath.value
    if (!root || initialized.value === false) return
    try {
      const result = await readStatus(root)
      if (revision !== statusRequestRevision || root !== projectPath.value || !result.ok || !result.value) return
      updateChangePaths(result.value.entries)
    } catch {
      // Keep the last known change paths when a lightweight refresh fails.
    }
  }

  async function refresh() {
    const revision = ++requestRevision
    const root = projectPath.value
    const hasCurrentFile = Boolean(currentFilePath.value)
    commits.value = []
    projectCommits.value = []
    changePaths.value = []
    historyLoaded.value = false
    initialized.value = null
    errorKind.value = null
    if (!root) return

    loading.value = true
    try {
      const inspection = await inspectRepository(root)
      if (revision !== requestRevision) return
      if (!inspection.ok || !inspection.value) {
        errorKind.value = inspection.error?.kind ?? 'git'
        initialized.value = false
        return
      }
      initialized.value = inspection.value.initialized
      if (!inspection.value.initialized) return

      const [history, fileHistory, statusResult] = await Promise.all([
        readHistory(root, { limit: HISTORY_LIMIT, start: null }),
        hasCurrentFile
          ? readFileHistory(root, { path: currentFilePath.value!, limit: HISTORY_LIMIT })
          : Promise.resolve(emptyHistoryResult()),
        readStatus(root),
      ])
      if (revision !== requestRevision) return
      if (!history.ok || !history.value || !fileHistory.ok || !fileHistory.value) {
        errorKind.value = history.error?.kind ?? fileHistory.error?.kind ?? 'git'
        return
      }
      projectCommits.value = history.value
      commits.value = fileHistory.value
      if (statusResult.ok && statusResult.value) updateChangePaths(statusResult.value.entries)
      historyLoaded.value = true
    } catch {
      if (revision === requestRevision) {
        initialized.value = false
        errorKind.value = 'io'
      }
    } finally {
      if (revision === requestRevision) loading.value = false
    }
  }


  watch(
    [projectPath, currentFilePath],
    () => { void refresh() },
    { immediate: true },
  )

  return {
    treeData,
    projectTreeData,
    changesTreeData,
    loading,
    initialized,
    errorKind,
    refresh,
    refreshStatus,
    hasHistory: computed(() => commits.value.length > 0),
    revisionOptions,
  }
}
