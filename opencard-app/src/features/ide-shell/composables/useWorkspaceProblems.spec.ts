import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import type { EditorProblem } from '../../editor-runtime/model/editorProblem'
import type { EditorSession } from '../../workspace/store/editorSessionStore'
import {
  buildWorkspaceProblemProjection,
  useWorkspaceProblems,
} from './useWorkspaceProblems'

function createSession(id: string, name: string): EditorSession {
  return {
    id,
    resourceKind: 'workspace',
    path: `/project/${name}.opencard`,
    fileTypeId: 'opencard',
    name,
    editorId: 'card-designer',
    savedContent: '',
    draftContent: '',
    isDirty: false,
    isPreview: false,
  }
}

function createProblem(id: string, source: EditorProblem['source']): EditorProblem {
  return {
    id,
    source,
    severity: 'warning',
    message: `${source} issue`,
  }
}

describe('workspace problem projection', () => {
  it('builds a session-first tree and maps only problem nodes to sessions', () => {
    const first = createSession('a', 'Card A')
    const second = createSession('b', 'Card B')
    const projection = buildWorkspaceProblemProjection(
      [first, second],
      new Map([
        [first.id, [createProblem('binding-a', 'binding')]],
        [second.id, [createProblem('render-b', 'render-parser')]],
      ]),
    )

    expect(projection.problemCount).toBe(2)
    expect(projection.treeData.rootKeys).toEqual([
      'workspace-problem-session:a',
      'workspace-problem-session:b',
    ])
    const firstProblemKey = projection.treeData.children.get('workspace-problem-session:a')?.[0]
    expect(firstProblemKey).toBe('workspace-problem:a:binding-a')
    expect(projection.nodeSessionIds.get(firstProblemKey!)).toBe('a')
    expect(projection.nodeSessionIds.has('workspace-problem-session:a')).toBe(false)
  })

  it('removes reports and expansion state when a session closes', async () => {
    const first = createSession('a', 'Card A')
    const second = createSession('b', 'Card B')
    const sessions = ref<EditorSession[]>([first, second])
    const problems = useWorkspaceProblems({ sessions })

    problems.reportSessionProblems(first.id, [createProblem('binding-a', 'binding')])
    problems.reportSessionProblems(second.id, [createProblem('render-b', 'render-parser')])
    problems.setProblemNodeExpanded('workspace-problem-session:a', true)
    sessions.value = [second]
    await nextTick()

    expect(problems.problemTreeData.value.rootKeys).toEqual(['workspace-problem-session:b'])
    expect(problems.problemCount.value).toBe(1)
    expect(problems.expandedProblemKeys.value).toEqual([])
  })
})
