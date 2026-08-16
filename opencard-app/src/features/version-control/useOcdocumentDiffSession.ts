import { computed, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { fileSystemService } from '../workspace/services/fileSystemService'
import { materializeRevision, readFileAtRevision } from './gitService'
import type { DiffRevisionOption, DiffSession, DiffSnapshot } from './diff.types'
import { compareOcdocuments, type OcdocumentDiffModel } from './ocdocumentDiff'

export interface OcdocumentDiffSessionOptions {
  projectRoot: Ref<string | null | undefined>
  filePath: Ref<string | null | undefined>
  fileName: Ref<string | null | undefined>
  revisions: Ref<readonly DiffRevisionOption[]>
}

function resolveProjectFile(root: string, path: string): string {
  const normalizedRoot = root.replace(/[\\/]$/, '')
  return `${normalizedRoot}/${path.replace(/^[\\/]+/, '').replace(/\\/g, '/')}`
}

export function useOcdocumentDiffSession(options: OcdocumentDiffSessionOptions) {
  const { t } = useI18n()
  const before = ref<DiffSnapshot | null>(null)
  const after = ref<DiffSnapshot | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const beforeSnapshotRoot = ref<string | null>(null)
  const afterSnapshotRoot = ref<string | null>(null)
  let requestRevision = 0

  const diffSession = computed<DiffSession | null>(() => {
    const path = options.filePath.value
    const fileName = options.fileName.value
    if (!path || !fileName || !before.value || !after.value) return null
    return {
      id: `diff:${path}`,
      fileTypeId: 'ocdocument',
      path,
      name: fileName,
      before: before.value,
      after: after.value,
    }
  })
  const diffModel = computed<OcdocumentDiffModel | null>(() => (
    before.value && after.value ? compareOcdocuments(before.value.content, after.value.content) : null
  ))

  async function loadSnapshot(commitId: string | null, label: string): Promise<DiffSnapshot> {
    const root = options.projectRoot.value
    const path = options.filePath.value
    if (!root || !path) throw new Error('项目或文件不可用')
    if (commitId === null) {
      return { commitId, label, content: await fileSystemService.readFile(resolveProjectFile(root, path)) }
    }
    const result = await readFileAtRevision(root, { revision: commitId, path })
    if (!result.ok || !result.value) throw new Error(result.error?.message ?? '无法读取历史版本')
    if (result.value.binary) throw new Error('该版本不是文本文件')
    return { commitId, label, content: result.value.content }
  }

  async function loadSnapshotRoot(commitId: string | null): Promise<string | null> {
    const root = options.projectRoot.value
    if (!root || !commitId) return null
    const result = await materializeRevision(root, { revision: commitId })
    if (!result.ok || !result.value) throw new Error(result.error?.message ?? '无法准备历史资源')
    return result.value.rootPath
  }

  async function selectComparison(beforeCommitId: string | null, afterCommitId: string | null) {
    if (beforeCommitId === afterCommitId) {
      error.value = t('sidebar.diffViewer.sameVersion')
      return
    }
    const revision = ++requestRevision
    loading.value = true
    error.value = null
    const optionById = new Map(options.revisions.value.map(item => [item.commitId, item]))
    try {
      const [nextBefore, nextAfter, nextBeforeRoot, nextAfterRoot] = await Promise.all([
        loadSnapshot(beforeCommitId, optionById.get(beforeCommitId)?.label ?? '版本 A'),
        loadSnapshot(afterCommitId, optionById.get(afterCommitId)?.label ?? '版本 B'),
        loadSnapshotRoot(beforeCommitId),
        loadSnapshotRoot(afterCommitId),
      ])
      if (revision !== requestRevision) return
      before.value = nextBefore
      after.value = nextAfter
      beforeSnapshotRoot.value = nextBeforeRoot
      afterSnapshotRoot.value = nextAfterRoot
    } catch (cause) {
      if (revision === requestRevision) error.value = cause instanceof Error ? cause.message : '差异版本读取失败'
    } finally {
      if (revision === requestRevision) loading.value = false
    }
  }

  async function refresh() {
    const history = options.revisions.value.filter(item => item.commitId !== null)
    const beforeId = history[0]?.commitId ?? null
    await selectComparison(beforeId, null)
  }

  return {
    before,
    after,
    diffSession,
    diffModel,
    loading,
    error,
    beforeSnapshotRoot,
    afterSnapshotRoot,
    refresh,
    selectComparison,
  }
}
