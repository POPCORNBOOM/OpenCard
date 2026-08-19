import { computed, ref, watch, type Ref } from 'vue'

import type { OcTreeData, OcTreeIntent } from '../../shared/ui/tree/tree.types'
import { inspectRepository, listBranches, readFileHistory, readStatus } from './gitService'
import type { BranchSummary, CommitSummary, GitErrorKind } from './git.types'
import type { DiffRevisionOption } from './diff.types'

const HISTORY_LIMIT = 50

export function useProjectTimeline(
  projectPath: Ref<string | null | undefined>,
  currentFilePath: Ref<string | null | undefined>,
  locale: Ref<string>,
) {
  const commits = ref<CommitSummary[]>([])
  const branches = ref<BranchSummary[]>([])
  const stagedPaths = ref<string[]>([])
  const selectedKeys = ref<string[]>([])
  const expandedKeys = ref<string[]>(['timeline:branches', 'timeline:commits'])
  const loading = ref(false)
  const historyLoaded = ref(false)
  const initialized = ref<boolean | null>(null)
  const errorKind = ref<GitErrorKind | null>(null)
  let requestRevision = 0

  const treeData = computed<OcTreeData>(() => {
    if (!historyLoaded.value) return { rootKeys: [], items: new Map(), children: new Map() }
    const items = new Map<string, OcTreeData['items'] extends ReadonlyMap<string, infer Item> ? Item : never>()
    const children = new Map<string, string[]>()
    const branchRootKey = 'timeline:branches'
    const commitRootKey = 'timeline:commits'
    const branchKeys = branches.value.map(branch => `timeline:branch:${branch.name}`)
    const commitKeys = commits.value.map(commit => `timeline:${commit.id}`)

    items.set(branchRootKey, {
      label: locale.value === 'zh-CN' ? '分支' : 'Branches',
      icon: 'file.git',
      tail: String(branchKeys.length),
    })
    items.set(commitRootKey, {
      label: locale.value === 'zh-CN' ? '提交' : 'Commits',
      icon: 'file.git',
      tail: String(commitKeys.length),
    })
    children.set(branchRootKey, branchKeys)
    children.set(commitRootKey, commitKeys)

    for (const branch of branches.value) {
      const key = `timeline:branch:${branch.name}`
      const target = branch.target?.slice(0, 7) ?? ''
      items.set(key, {
        label: branch.name,
        tail: branch.current
          ? (locale.value === 'zh-CN' ? `当前 · ${target}` : `Current · ${target}`)
          : target,
        icon: 'file.git',
        iconTone: branch.current ? 'muted' : undefined,
        disabled: true,
      })
    }

    for (const commit of commits.value) {
      const key = `timeline:${commit.id}`
      items.set(key, {
        label: `${commit.summary.trim() || commit.shortId} · ${commit.shortId}`,
        tail: new Intl.DateTimeFormat(locale.value, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(commit.authoredAtSeconds * 1000)),
        icon: 'file.git',
      })
    }
    return { rootKeys: [branchRootKey, commitRootKey], items, children }
  })

  const stagedChangesTreeData = computed<OcTreeData>(() => {
    const items = new Map<string, OcTreeData['items'] extends ReadonlyMap<string, infer Item> ? Item : never>()
    const rootKeys = stagedPaths.value.map(path => `staged:${path}`)
    for (const path of stagedPaths.value) items.set(`staged:${path}`, { label: path, icon: 'file.git' })
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

  async function refresh() {
    const revision = ++requestRevision
    const root = projectPath.value
    const filePath = currentFilePath.value
    commits.value = []
    branches.value = []
    stagedPaths.value = []
    historyLoaded.value = false
    selectedKeys.value = []
    initialized.value = null
    errorKind.value = null
    if (!root || !filePath) return

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

      const [history, branchResult, statusResult] = await Promise.all([
        readFileHistory(root, { path: filePath, limit: HISTORY_LIMIT }),
        listBranches(root),
        readStatus(root),
      ])
      if (revision !== requestRevision) return
      if (!history.ok || !history.value) {
        errorKind.value = history.error?.kind ?? 'git'
        return
      }
      commits.value = history.value
      if (branchResult.ok && branchResult.value) branches.value = branchResult.value
      if (statusResult.ok && statusResult.value) {
        stagedPaths.value = statusResult.value.entries.filter(entry => entry.indexNew || entry.indexModified || entry.indexDeleted).map(entry => entry.path)
      }
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

  function handleTreeIntent(intent: OcTreeIntent) {
    if (intent.type === 'expansion.change') {
      expandedKeys.value = intent.expanded
        ? [...new Set([...expandedKeys.value, intent.key])]
        : expandedKeys.value.filter(key => key !== intent.key)
      return
    }
    if (intent.type !== 'selection.change') return
    selectedKeys.value = intent.selectedKeys.filter(key => key.startsWith('timeline:') && !key.startsWith('timeline:branch'))
  }

  watch([projectPath, currentFilePath], () => { void refresh() }, { immediate: true })

  return {
    treeData,
    selectedKeys,
    expandedKeys,
    stagedChangesTreeData,
    loading,
    initialized,
    errorKind,
    refresh,
    handleTreeIntent,
    hasHistory: computed(() => commits.value.length > 0),
    revisionOptions,
  }
}
