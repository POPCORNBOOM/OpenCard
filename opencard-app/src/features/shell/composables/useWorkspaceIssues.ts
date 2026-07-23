import { computed, ref, watch, type Ref } from 'vue'
import type {
  EditorIssue,
  EditorIssueSeverity,
  EditorIssueSnapshot,
  SessionIssue,
  SessionIssueNavigationRequest,
} from '../../editor-runtime/model/editorIssue'
import { resolveFileTypeById } from '../../workspace/model/fileTypes'
import type { EditorSession } from '../../workspace/store/editorSessionStore'
import type { OcTreeData, OcTreeItem } from '../../../shared/ui/tree/tree.types'

const SESSION_KEY_PREFIX = 'workspace-issue-session:'
const ISSUE_KEY_PREFIX = 'workspace-issue:'

type SessionIssueScopes = ReadonlyMap<string, readonly EditorIssue[]>

export type WorkspaceIssueProjection = {
  treeData: OcTreeData
  navigationTargets: ReadonlyMap<string, SessionIssueNavigationRequest>
  issueCount: number
  highestSeverity: EditorIssueSeverity | null
}

const ISSUE_SEVERITY_RANK: Readonly<Record<EditorIssueSeverity, number>> = {
  info: 1,
  warning: 2,
  error: 3,
}

function encodeKeyPart(value: string): string {
  return encodeURIComponent(value)
}

function sessionNodeKey(sessionId: string): string {
  return `${SESSION_KEY_PREFIX}${encodeKeyPart(sessionId)}`
}

function issueNodeKey(sessionId: string, scopeKey: string, issueId: string): string {
  return `${ISSUE_KEY_PREFIX}${encodeKeyPart(sessionId)}:${encodeKeyPart(scopeKey)}:${encodeKeyPart(issueId)}`
}

function issueLabel(issue: EditorIssue): string {
  return issue.locationText
    ? `${issue.locationText}: ${issue.description}`
    : issue.description
}

function issueTreeItem(issue: EditorIssue): OcTreeItem {
  if (issue.severity === 'error') {
    return { label: issueLabel(issue), icon: 'status.error', iconTone: 'danger' }
  }
  if (issue.severity === 'warning') {
    return { label: issueLabel(issue), icon: 'status.warning', iconTone: 'warning' }
  }
  return { label: issueLabel(issue), icon: 'status.unknown', iconTone: 'muted' }
}

function dedupeIssues(issues: readonly EditorIssue[]): readonly EditorIssue[] {
  const byId = new Map<string, EditorIssue>()
  for (const issue of issues) byId.set(issue.id, issue)
  return [...byId.values()]
}

function normalizeScopeOrder(snapshot: EditorIssueSnapshot): readonly string[] {
  if (snapshot.scopeOrder.length === 0) return []
  const order = [...new Set(snapshot.scopeOrder)]
  if (!order.includes(snapshot.scopeKey)) order.push(snapshot.scopeKey)
  return order
}

export function buildWorkspaceIssueProjection(
  sessions: readonly EditorSession[],
  issuesBySession: ReadonlyMap<string, SessionIssueScopes>,
): WorkspaceIssueProjection {
  const rootKeys: string[] = []
  const items = new Map<string, OcTreeItem>()
  const children = new Map<string, readonly string[]>()
  const navigationTargets = new Map<string, SessionIssueNavigationRequest>()
  let issueCount = 0
  let highestSeverity: EditorIssueSeverity | null = null

  for (const session of sessions) {
    const scopes = issuesBySession.get(session.id)
    if (!scopes) continue

    const sessionIssues: Array<{ scopeKey: string; issue: SessionIssue }> = []
    for (const [scopeKey, issues] of scopes) {
      for (const issue of issues) {
        sessionIssues.push({ scopeKey, issue: { ...issue, sessionId: session.id } })
        if (highestSeverity === null || ISSUE_SEVERITY_RANK[issue.severity] > ISSUE_SEVERITY_RANK[highestSeverity]) {
          highestSeverity = issue.severity
        }
      }
    }
    if (sessionIssues.length === 0) continue

    const rootKey = sessionNodeKey(session.id)
    const fileType = resolveFileTypeById(session.fileTypeId)
    const issueKeys = sessionIssues.map(({ scopeKey, issue }) => {
      const key = issueNodeKey(session.id, scopeKey, issue.id)
      items.set(key, issueTreeItem(issue))
      if (issue.navigationToken !== undefined) {
        navigationTargets.set(key, {
          sessionId: session.id,
          token: issue.navigationToken,
        })
      }
      return key
    })

    rootKeys.push(rootKey)
    items.set(rootKey, {
      label: `${session.name} (${sessionIssues.length})`,
      icon: fileType.icon,
      iconTone: fileType.iconTone,
    })
    children.set(rootKey, issueKeys)
    issueCount += sessionIssues.length
  }

  return {
    treeData: { rootKeys, items, children },
    navigationTargets,
    issueCount,
    highestSeverity,
  }
}

export function useWorkspaceIssues(options: {
  sessions: Readonly<Ref<readonly EditorSession[]>>
}) {
  const issuesBySession = ref<ReadonlyMap<string, SessionIssueScopes>>(new Map())
  const expandedIssueKeys = ref<string[]>([])

  const projection = computed(() => buildWorkspaceIssueProjection(
    options.sessions.value,
    issuesBySession.value,
  ))

  function reportSessionIssueSnapshot(sessionId: string, snapshot: EditorIssueSnapshot): void {
    const nextBySession = new Map(issuesBySession.value)
    const currentScopes = nextBySession.get(sessionId) ?? new Map()
    const nextScopes = new Map<string, readonly EditorIssue[]>()
    const scopeOrder = normalizeScopeOrder(snapshot)
    const snapshotIssues = dedupeIssues(snapshot.issues)

    for (const scopeKey of scopeOrder) {
      if (scopeKey === snapshot.scopeKey) {
        nextScopes.set(scopeKey, snapshotIssues)
        continue
      }
      const cached = currentScopes.get(scopeKey)
      if (cached) nextScopes.set(scopeKey, cached)
    }

    nextBySession.set(sessionId, nextScopes)
    issuesBySession.value = nextBySession
  }

  function clearSessionIssues(sessionId: string): void {
    if (!issuesBySession.value.has(sessionId)) return
    const next = new Map(issuesBySession.value)
    next.delete(sessionId)
    issuesBySession.value = next
  }

  function clearAllSessionIssues(): void {
    issuesBySession.value = new Map()
    expandedIssueKeys.value = []
  }

  function setIssueNodeExpanded(key: string, expanded: boolean): void {
    const next = new Set(expandedIssueKeys.value)
    if (expanded) next.add(key)
    else next.delete(key)
    expandedIssueKeys.value = [...next]
  }

  watch(
    () => options.sessions.value.map((session) => session.id),
    (sessionIds) => {
      const activeIds = new Set(sessionIds)
      issuesBySession.value = new Map(
        [...issuesBySession.value].filter(([sessionId]) => activeIds.has(sessionId)),
      )
      expandedIssueKeys.value = expandedIssueKeys.value.filter((key) => {
        if (!key.startsWith(SESSION_KEY_PREFIX)) return false
        return activeIds.has(decodeURIComponent(key.slice(SESSION_KEY_PREFIX.length)))
      })
    },
  )

  return {
    issueTreeData: computed(() => projection.value.treeData),
    issueNavigationTargets: computed(() => projection.value.navigationTargets),
    issueCount: computed(() => projection.value.issueCount),
    highestIssueSeverity: computed(() => projection.value.highestSeverity),
    expandedIssueKeys,
    reportSessionIssueSnapshot,
    clearSessionIssues,
    clearAllSessionIssues,
    setIssueNodeExpanded,
  }
}
