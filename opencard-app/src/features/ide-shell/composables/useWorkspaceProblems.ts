import { computed, ref, watch, type Ref } from 'vue'
import type { EditorProblem } from '../../editor-runtime/model/editorProblem'
import { resolveFileTypeById } from '../../workspace/model/fileTypes'
import type { EditorSession } from '../../workspace/store/editorSessionStore'
import type { OcTreeData, OcTreeItem } from '../../../shared/ui/tree/tree.types'

const SESSION_KEY_PREFIX = 'workspace-problem-session:'
const PROBLEM_KEY_PREFIX = 'workspace-problem:'

type WorkspaceProblemProjection = {
  treeData: OcTreeData
  nodeSessionIds: ReadonlyMap<string, string>
  problemCount: number
}

function sessionNodeKey(sessionId: string): string {
  return `${SESSION_KEY_PREFIX}${sessionId}`
}

function problemNodeKey(sessionId: string, problemId: string): string {
  return `${PROBLEM_KEY_PREFIX}${sessionId}:${problemId}`
}

export function buildWorkspaceProblemProjection(
  sessions: readonly EditorSession[],
  problemsBySession: ReadonlyMap<string, readonly EditorProblem[]>,
): WorkspaceProblemProjection {
  const rootKeys: string[] = []
  const items = new Map<string, OcTreeItem>()
  const children = new Map<string, readonly string[]>()
  const nodeSessionIds = new Map<string, string>()
  let problemCount = 0

  for (const session of sessions) {
    const problems = problemsBySession.get(session.id) ?? []
    if (problems.length === 0) continue

    const rootKey = sessionNodeKey(session.id)
    const fileType = resolveFileTypeById(session.fileTypeId)
    const problemKeys = problems.map((problem) => {
      const key = problemNodeKey(session.id, problem.id)
      items.set(key, {
        label: problem.message,
        icon: problem.source === 'binding' ? 'data.variable' : 'status.warning',
        iconTone: problem.severity === 'error'
          ? 'danger'
          : problem.severity === 'warning' ? 'warning' : 'muted',
      })
      nodeSessionIds.set(key, session.id)
      return key
    })

    rootKeys.push(rootKey)
    items.set(rootKey, {
      label: `${session.name} (${problems.length})`,
      icon: fileType.icon,
      iconTone: fileType.iconTone,
    })
    children.set(rootKey, problemKeys)
    problemCount += problems.length
  }

  return {
    treeData: { rootKeys, items, children },
    nodeSessionIds,
    problemCount,
  }
}

export function useWorkspaceProblems(options: {
  sessions: Readonly<Ref<readonly EditorSession[]>>
}) {
  const problemsBySession = ref<ReadonlyMap<string, readonly EditorProblem[]>>(new Map())
  const expandedProblemKeys = ref<string[]>([])

  const projection = computed(() => buildWorkspaceProblemProjection(
    options.sessions.value,
    problemsBySession.value,
  ))

  function reportSessionProblems(sessionId: string, problems: readonly EditorProblem[]): void {
    const next = new Map(problemsBySession.value)
    if (problems.length === 0) {
      next.delete(sessionId)
    } else {
      next.set(sessionId, [...problems])
    }
    problemsBySession.value = next
  }

  function setProblemNodeExpanded(key: string, expanded: boolean): void {
    const next = new Set(expandedProblemKeys.value)
    if (expanded) next.add(key)
    else next.delete(key)
    expandedProblemKeys.value = [...next]
  }

  watch(
    () => options.sessions.value.map((session) => session.id),
    (sessionIds) => {
      const activeIds = new Set(sessionIds)
      const nextProblems = new Map(
        [...problemsBySession.value].filter(([sessionId]) => activeIds.has(sessionId)),
      )
      problemsBySession.value = nextProblems
      expandedProblemKeys.value = expandedProblemKeys.value.filter((key) => {
        if (!key.startsWith(SESSION_KEY_PREFIX)) return false
        return activeIds.has(key.slice(SESSION_KEY_PREFIX.length))
      })
    },
  )

  return {
    problemTreeData: computed(() => projection.value.treeData),
    problemNodeSessionIds: computed(() => projection.value.nodeSessionIds),
    problemCount: computed(() => projection.value.problemCount),
    expandedProblemKeys,
    reportSessionProblems,
    setProblemNodeExpanded,
  }
}
