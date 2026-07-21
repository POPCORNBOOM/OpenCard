import type { CardDocument, CardInstanceRecord } from '../../entities/card/model'
import type { CardPipelineIssue, CardIssueType } from '../card-rendering/cardPipelineIssue'
import type { RenderPipelineResult } from '../card-rendering/renderPipeline'
import type { EditorIssue, EditorIssueSnapshot } from '../editor-runtime/model/editorIssue'
import type { CardDesignerNavigationToken } from './cardDesignerNavigation'

type Translate = (key: string, parameters?: Readonly<Record<string, string | number>>) => string
type ResolveFieldLabel = (fieldKey: string) => string

const issueMessageKeys: Readonly<Record<CardIssueType, string>> = {
  'card-designer.binding.invalid-token': 'app.problems.bindingCodes.INVALID_TOKEN',
  'card-designer.binding.source-not-found': 'app.problems.bindingCodes.SOURCE_NOT_FOUND',
  'card-designer.binding.field-not-allowed': 'app.problems.bindingCodes.FIELD_NOT_ALLOWED',
  'card-designer.binding.field-not-found': 'app.problems.bindingCodes.FIELD_NOT_FOUND',
  'card-designer.binding.cycle': 'app.problems.bindingCodes.CYCLE',
  'card-designer.binding.max-depth': 'app.problems.bindingCodes.MAX_DEPTH',
  'card-designer.binding.type-mismatch': 'app.problems.bindingCodes.TYPE_MISMATCH',
  'card-designer.render-parse.invalid-type': 'app.problems.renderCodes.INVALID_TYPE',
  'card-designer.render-parse.conversion-failed': 'app.problems.renderCodes.CONVERSION_FAILED',
  'card-designer.render-parse.invalid-option': 'app.problems.renderCodes.INVALID_OPTION',
  'card-designer.render-parse.out-of-range': 'app.problems.renderCodes.OUT_OF_RANGE',
}

export const CARD_DESIGNER_BLUEPRINT_SCOPE_KEY = 'card:blueprint'

export function createCardInstanceScopeKey(instanceId: string): string {
  return `card:instance:${instanceId}`
}

export function createCardIssueScopeOrder(document: CardDocument): readonly string[] {
  return [
    CARD_DESIGNER_BLUEPRINT_SCOPE_KEY,
    ...(document.instances ?? []).map((instance) => createCardInstanceScopeKey(instance.id)),
  ]
}

function createNavigationToken(issue: CardPipelineIssue): CardDesignerNavigationToken | undefined {
  if (
    (issue.location.owner.kind === 'block' || issue.location.owner.kind === 'location')
    && !issue.location.blockId
  ) {
    return undefined
  }
  const instanceId = issue.location.owner.kind === 'document'
    ? null
    : issue.location.instanceId
  return {
    protocol: 'card-designer',
    version: 1,
    target: {
      kind: 'property',
      instanceId,
      ...(issue.location.blockId ? { blockId: issue.location.blockId } : {}),
      owner: issue.location.owner.kind,
      fieldKey: issue.location.fieldKey,
    },
  }
}

function resolveCardLabel(
  instance: CardInstanceRecord | null,
  translate: Translate,
): string {
  return instance?.name?.trim() || instance?.id || translate('app.problems.blueprint')
}

function createLocationText(
  issue: CardPipelineIssue,
  cardLabel: string,
  resolveFieldLabel: ResolveFieldLabel,
): string {
  const displayFieldKey = typeof issue.parameters?.fieldName === 'string'
    ? issue.parameters.fieldName
    : issue.location.fieldKey
  return [
    cardLabel,
    issue.location.blockPath,
    resolveFieldLabel(displayFieldKey),
  ].filter((part): part is string => Boolean(part)).join(' · ')
}

export function createCardDesignerIssues(
  result: RenderPipelineResult | null,
  instance: CardInstanceRecord | null,
  translate: Translate,
  resolveFieldLabel: ResolveFieldLabel,
): readonly EditorIssue[] {
  if (!result) return []
  const cardLabel = resolveCardLabel(instance, translate)
  return result.issues.map((issue) => {
    const navigationToken = createNavigationToken(issue)
    return {
      id: issue.id,
      type: issue.type,
      severity: issue.severity,
      locationText: createLocationText(issue, cardLabel, resolveFieldLabel),
      description: translate(issueMessageKeys[issue.type], issue.parameters),
      ...(navigationToken ? { navigationToken } : {}),
    }
  })
}

export function createCardDesignerIssueSnapshot(options: {
  document: CardDocument | null
  instance: CardInstanceRecord | null
  result: RenderPipelineResult | null
  translate: Translate
  resolveFieldLabel: ResolveFieldLabel
}): EditorIssueSnapshot {
  const scopeKey = options.instance
    ? createCardInstanceScopeKey(options.instance.id)
    : CARD_DESIGNER_BLUEPRINT_SCOPE_KEY
  return {
    scopeKey,
    scopeOrder: options.document ? createCardIssueScopeOrder(options.document) : [],
    issues: createCardDesignerIssues(
      options.result,
      options.instance,
      options.translate,
      options.resolveFieldLabel,
    ),
  }
}
