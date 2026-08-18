import type { CardDocument, CardInstanceRecord } from '../../entities/card/model'
import type { CardPipelineIssue, CardIssueType } from '../card-rendering/cardPipelineIssue'
import type { RenderPipelineResult } from '../card-rendering/renderPipeline'
import type { EditorIssue, EditorIssueSnapshot } from '../editor-runtime/model/editorIssue'
import type { CardDesignerNavigationToken } from './cardDesignerNavigation'
import type { CardStorageWarning } from '../../entities/card/storage'

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
  'card-designer.custom-block.unavailable': 'app.problems.customBlockCodes.UNAVAILABLE',
  'card-designer.custom-block.content-error': 'app.problems.customBlockCodes.CONTENT_ERROR',
  'card-designer.custom-block.resource-error': 'app.problems.customBlockCodes.RESOURCE_ERROR',
  'card-designer.rich-text.invalid-html': 'app.problems.richTextCodes.INVALID_HTML',
  'card-designer.rich-text.limit-exceeded': 'app.problems.richTextCodes.LIMIT_EXCEEDED',
}

const valueKindMessageKeys: Readonly<Record<string, string>> = {
  string: 'app.problems.valueKinds.string',
  number: 'app.problems.valueKinds.number',
  boolean: 'app.problems.valueKinds.boolean',
  object: 'app.problems.valueKinds.object',
  array: 'app.problems.valueKinds.array',
  undefined: 'app.problems.valueKinds.undefined',
  'interpolated-string': 'app.problems.valueKinds.interpolatedString',
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
    version: 2,
    target: {
      kind: 'property',
      instanceId,
      faceKey: issue.location.faceKey,
      ...(issue.location.blockId ? { blockId: issue.location.blockId } : {}),
      owner: issue.location.owner.kind,
      fieldKey: issue.location.fieldKey,
      ...(issue.location.characterOffset !== undefined
        ? { characterOffset: issue.location.characterOffset }
        : {}),
    },
  }
}

function resolveCardLabel(
  instance: CardInstanceRecord | null,
  faceKey: CardPipelineIssue['location']['faceKey'],
  translate: Translate,
): string {
  const card = !instance
    ? translate('app.problems.locations.blueprint')
    : translate('app.problems.locations.instance', {
        instanceName: instance.name?.trim() || instance.id,
      })
  if (!faceKey) return card
  return translate('app.problems.locations.cardFace', {
    card,
    face: translate(`app.problems.locations.${faceKey}Face`),
  })
}

function abbreviateId(value: string): string {
  if (value.length <= 12) return value
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

function resolveValueKind(value: unknown, translate: Translate): string {
  if (typeof value !== 'string') return ''
  const messageKey = valueKindMessageKeys[value]
  return messageKey ? translate(messageKey) : value
}

function createDescriptionParameters(
  issue: CardPipelineIssue,
  translate: Translate,
  resolveFieldLabel: ResolveFieldLabel,
): Readonly<Record<string, string | number>> {
  const parameters: Record<string, string | number> = { ...issue.parameters }
  const referencedFieldKey = typeof issue.parameters?.referencedFieldKey === 'string'
    ? issue.parameters.referencedFieldKey
    : issue.location.fieldKey
  const displayFieldKey = typeof issue.parameters?.fieldName === 'string'
    ? issue.parameters.fieldName
    : referencedFieldKey

  parameters.fieldName = resolveFieldLabel(displayFieldKey)
  parameters.fieldKey = referencedFieldKey
  parameters.token = issue.token ?? ''
  parameters.sourceTypeName = resolveValueKind(issue.parameters?.sourceType, translate)
  parameters.targetTypeName = resolveValueKind(issue.parameters?.targetType, translate)
  return parameters
}

function createLocationText(
  issue: CardPipelineIssue,
  cardLabel: string,
  translate: Translate,
  resolveFieldLabel: ResolveFieldLabel,
): string {
  const displayFieldKey = typeof issue.parameters?.fieldName === 'string'
    ? issue.parameters.fieldName
    : issue.location.fieldKey
  const parameters = {
    card: cardLabel,
    blockPath: issue.location.blockPath || translate('app.problems.locations.unnamedBlock'),
    blockId: abbreviateId(issue.location.blockId || issue.location.owner.id),
    fieldName: resolveFieldLabel(displayFieldKey),
    fieldKey: issue.location.fieldKey,
    ...(issue.location.characterOffset !== undefined
      ? { character: issue.location.characterOffset + 1 }
      : {}),
  }
  const isBlockField = issue.location.owner.kind === 'block'
    || issue.location.owner.kind === 'location'
  const hasCharacter = issue.location.characterOffset !== undefined
  const messageKey = isBlockField
    ? hasCharacter
      ? 'app.problems.locations.blockFieldAtCharacter'
      : 'app.problems.locations.blockField'
    : hasCharacter
      ? 'app.problems.locations.fieldAtCharacter'
      : 'app.problems.locations.field'

  return translate(messageKey, parameters)
}

export function createCardDesignerIssues(
  result: RenderPipelineResult | null,
  instance: CardInstanceRecord | null,
  translate: Translate,
  resolveFieldLabel: ResolveFieldLabel,
): readonly EditorIssue[] {
  if (!result) return []
  return result.issues.map((issue) => {
    const cardLabel = resolveCardLabel(instance, issue.location.faceKey, translate)
    const navigationToken = createNavigationToken(issue)
    return {
      id: issue.id,
      type: issue.type,
      severity: issue.severity,
      locationText: createLocationText(issue, cardLabel, translate, resolveFieldLabel),
      description: translate(
        issueMessageKeys[issue.type],
        createDescriptionParameters(issue, translate, resolveFieldLabel),
      ),
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
  storageWarnings?: readonly CardStorageWarning[]
}): EditorIssueSnapshot {
  const scopeKey = options.instance
    ? createCardInstanceScopeKey(options.instance.id)
    : CARD_DESIGNER_BLUEPRINT_SCOPE_KEY
  return {
    scopeKey,
    scopeOrder: options.document ? createCardIssueScopeOrder(options.document) : [],
    issues: [
      ...(options.instance ? [] : (options.storageWarnings ?? []).map((warning, index) => ({
        id: `card-storage:${warning.code}:${warning.path}:${index}`,
        type: `card-designer.storage.${warning.code}`,
        severity: 'warning' as const,
        locationText: options.translate('app.problems.locations.storagePath', { path: warning.path }),
        description: options.translate(`app.problems.storageCodes.${warning.code}`),
      }))),
      ...createCardDesignerIssues(
        options.result,
        options.instance,
        options.translate,
        options.resolveFieldLabel,
      ),
    ],
  }
}
