import { computed, ref, watch, type Ref } from 'vue'

import type { OcTreeData, OcTreeIntent } from '../../shared/ui/tree/tree.types'
import { inspectRepository, readFileHistory } from './gitService'
import type { CommitSummary, GitErrorKind } from './git.types'
import type { DiffRevisionOption } from './diff.types'

const HISTORY_LIMIT = 50

export function useProjectTimeline(
  projectPath: Ref<string | null | undefined>,
  currentFilePath: Ref<string | null | undefined>,
  locale: Ref<string>,
) {
  const commits = ref<CommitSummary[]>([])
  const selectedKeys = ref<string[]>([])
  const loading = ref(false)
  const initialized = ref<boolean | null>(null)
  const errorKind = ref<GitErrorKind | null>(null)
  let requestRevision = 0

  const treeData = computed<OcTreeData>(() => {
    const items = new Map<string, OcTreeData['items'] extends ReadonlyMap<string, infer Item> ? Item : never>()
    const keys: string[] = []
    for (const commit of commits.value) {
      const key = `timeline:${commit.id}`
      keys.push(key)
      items.set(key, {
        label: commit.summary.trim() || commit.shortId,
        tail: new Intl.DateTimeFormat(locale.value, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(commit.authoredAtSeconds * 1000)),
        icon: 'file.git',
      })
    }
    return { rootKeys: keys, items, children: new Map() }
  })

  const revisionOptions = computed<DiffRevisionOption[]>(() => [
    { commitId: null, label: '当前文件' },
    ...commits.value.map(commit => ({
      commitId: commit.id,
      label: commit.summary.trim() || commit.shortId,
      authoredAtSeconds: commit.authoredAtSeconds,
    })),
  ])

  async function refresh() {
    const revision = ++requestRevision
    const root = projectPath.value
    const filePath = currentFilePath.value
    commits.value = []
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

      const history = await readFileHistory(root, { path: filePath, limit: HISTORY_LIMIT })
      if (revision !== requestRevision) return
      if (!history.ok || !history.value) {
        errorKind.value = history.error?.kind ?? 'git'
        return
      }
      commits.value = history.value
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
    if (intent.type !== 'selection.change') return
    selectedKeys.value = intent.selectedKeys
  }

  watch([projectPath, currentFilePath], () => { void refresh() }, { immediate: true })

  return {
    treeData,
    selectedKeys,
    loading,
    initialized,
    errorKind,
    refresh,
    handleTreeIntent,
    hasHistory: computed(() => commits.value.length > 0),
    revisionOptions,
  }
}
