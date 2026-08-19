import type { CardFaceKey } from '../../entities/card/model'

export type CardIssueSeverity = 'error' | 'warning' | 'info'

export type CardIssueOwner =
  | { kind: 'document', id: string }
  | { kind: 'face', id: string }
  | { kind: 'instance', id: string }
  | { kind: 'block', id: string }
  | { kind: 'location', id: string }

export type CardIssueLocation = {
  documentId: string
  instanceId: string | null
  faceKey: CardFaceKey | null
  owner: CardIssueOwner
  blockId?: string
  blockPath?: string
  fieldKey: string
  valuePath?: readonly (string | number)[]
  characterOffset?: number
}

export type CardBindingIssueType =
  | 'card-designer.binding.invalid-token'
  | 'card-designer.binding.source-not-found'
  | 'card-designer.binding.field-not-allowed'
  | 'card-designer.binding.field-not-found'
  | 'card-designer.binding.cycle'
  | 'card-designer.binding.max-depth'
  | 'card-designer.binding.type-mismatch'

export type CardRenderParseIssueType =
  | 'card-designer.render-parse.invalid-type'
  | 'card-designer.render-parse.conversion-failed'
  | 'card-designer.render-parse.invalid-option'
  | 'card-designer.render-parse.out-of-range'
  | 'card-designer.render-parse.required'
  | 'card-designer.render-parse.invalid-color'
  | 'card-designer.render-parse.invalid-css-length'
  | 'card-designer.render-parse.invalid-file-path'
  | 'card-designer.render-parse.invalid-object'
export type CardCustomBlockIssueType =
  | 'card-designer.custom-block.unavailable'
  | 'card-designer.custom-block.content-error'
  | 'card-designer.custom-block.resource-error'

export type CardRichTextIssueType =
  | 'card-designer.rich-text.invalid-html'
  | 'card-designer.rich-text.limit-exceeded'

export type CardIssueType = CardBindingIssueType | CardRenderParseIssueType | CardCustomBlockIssueType | CardRichTextIssueType

export type CardPipelineIssue = {
  id: string
  type: CardIssueType
  severity: CardIssueSeverity
  location: CardIssueLocation
  parameters?: Readonly<Record<string, string | number>>
  token?: string
}

export type CreateCardPipelineIssueInput = Omit<CardPipelineIssue, 'id' | 'severity'>

export function createCardPipelineIssue(
  input: CreateCardPipelineIssueInput,
): CardPipelineIssue {
  return {
    ...input,
    id: JSON.stringify([
      input.location.documentId,
      input.location.instanceId,
      input.location.faceKey,
      input.type,
      input.location.owner.kind,
      input.location.owner.id,
      input.location.blockId ?? null,
      input.location.fieldKey,
      input.location.valuePath ?? null,
      input.location.characterOffset ?? null,
      input.token ?? null,
    ]),
    severity: 'warning',
  }
}
