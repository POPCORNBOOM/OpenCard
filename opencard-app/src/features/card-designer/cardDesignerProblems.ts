import type { EditorProblem } from '../editor-runtime/model/editorProblem'
import type { RenderPipelineResult } from '../card-rendering/renderPipeline'
import type { RenderIssue } from '../card-rendering/render.types'
import type { ReferenceResolveIssue } from '../card-rendering/resolveCardBindings'

type Translate = (key: string) => string

function createBindingProblem(issue: ReferenceResolveIssue, translate: Translate): EditorProblem {
  return {
    id: ['binding', issue.path, issue.code, issue.token].join(':'),
    source: 'binding',
    severity: 'warning',
    message: `${issue.path}: ${translate(`app.problems.bindingCodes.${issue.code}`)}`,
    code: issue.code,
    detail: issue.reason,
    path: issue.path,
    token: issue.token,
  }
}

function createRenderParserProblem(issue: RenderIssue, translate: Translate): EditorProblem {
  const fieldLabel = issue.fieldName || issue.fieldKey
  return {
    id: ['render-parser', issue.documentId, issue.blockPath, issue.fieldKey, issue.reasonCode].join(':'),
    source: 'render-parser',
    severity: 'warning',
    message: `${issue.blockPath} · ${fieldLabel}: ${translate(`app.problems.renderCodes.${issue.reasonCode}`)}`,
    code: issue.reasonCode,
    path: issue.blockPath,
    blockId: issue.blockId,
    fieldKey: issue.fieldKey,
  }
}

export function createCardDesignerProblems(
  result: Pick<RenderPipelineResult, 'bindingIssues' | 'renderIssues'> | null,
  translate: Translate,
): readonly EditorProblem[] {
  if (!result) return []
  return [
    ...result.bindingIssues.map((issue) => createBindingProblem(issue, translate)),
    ...result.renderIssues.map((issue) => createRenderParserProblem(issue, translate)),
  ]
}
