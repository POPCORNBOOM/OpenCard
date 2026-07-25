import type { CardBlock, CardDocument, CardFaceKey } from '../../entities/card/model'
import {
  getPropertyAllowedValues,
  getTypePropertyEditorSchema,
  type EditorPropertyDefinition,
} from '../../entities/card/schema'
import {
  createCardPipelineIssue,
  type CardIssueOwner,
  type CardPipelineIssue,
  type CardRenderParseIssueType,
} from './cardPipelineIssue'
import type {
  RenderParseResult,
  RenderReadyBaseBlock,
  RenderReadyCardBlock,
  RenderReadyCardDocument,
  RenderReadyCardFace,
  RenderReadyFlowContainerLocation,
  RenderReadySimpleContainerLocation,
} from './render.types'

type SourceRecord = Record<string, unknown>
type BlockType = CardBlock['type']

type IssueContext = {
  documentId: string
  instanceId: string | null
  faceKey: CardFaceKey | null
  owner: CardIssueOwner
  blockPath: string
  blockId?: string
  typeName: string
}

export type ParseRenderDocumentOptions = {
  instanceId?: string | null
}

type RenderParseFailure =
  | 'invalid-type'
  | 'conversion-failed'
  | 'invalid-option'
  | 'out-of-range'

const blockTypes: readonly BlockType[] = [
  'text-block',
  'markdown-text-block',
  'image-block',
  'qrcode-block',
  'shape-block',
  'simple-container-block',
  'flow-container-block',
]

export function parseRenderDocument(
  bindingExpandedCardDocument: CardDocument,
  options: ParseRenderDocumentOptions = {},
): RenderParseResult {
  const issues: CardPipelineIssue[] = []
  const source = toRecord(bindingExpandedCardDocument)
  const sourceDocumentId = primitiveString(source.id)
  const context: IssueContext = {
    documentId: sourceDocumentId,
    instanceId: options.instanceId ?? null,
    faceKey: null,
    owner: { kind: 'document', id: sourceDocumentId },
    blockPath: '',
    typeName: 'card-document',
  }
  const fields = createFieldReader(source, context, issues)

  fields.expectedLiteral('type', 'card-document')
  const id = fields.string('id')
  context.documentId = id
  context.owner = { kind: 'document', id }

  const width = fields.number('width')
  const height = fields.number('height')
  const faces = toRecord(source.faces)
  const document: RenderReadyCardDocument = {
    type: 'card-document',
    id,
    name: fields.optionalString('name'),
    version: fields.string('version'),
    description: fields.optionalString('description'),
    notes: fields.optionalString('notes'),
    faces: {
      front: parseFace(faces.front, 'front', width, height, id, context.instanceId, issues),
      back: parseFace(faces.back, 'back', width, height, id, context.instanceId, issues),
    },
  }

  return { document, issues }
}

function parseFace(
  faceValue: unknown,
  faceKey: CardFaceKey,
  width: number,
  height: number,
  documentId: string,
  instanceId: string | null,
  issues: CardPipelineIssue[],
): RenderReadyCardFace {
  const source = toRecord(faceValue)
  const context: IssueContext = {
    documentId,
    instanceId,
    faceKey,
    owner: { kind: 'face', id: primitiveString(source.id) },
    blockPath: '',
    typeName: 'card-face',
  }
  const fields = createFieldReader(source, context, issues)
  fields.expectedLiteral('type', 'card-face')
  const id = fields.string('id')
  context.owner = { kind: 'face', id }

  return {
    type: 'card-face',
    id,
    faceKey,
    width,
    height,
    background: fields.string('background'),
    children: fields.array('children').map((childValue) => {
      const child = toRecord(childValue)
      const block = parseBlock(child.block, '', documentId, instanceId, faceKey, issues)
      return {
        block,
        location: parseSimpleLocation(child.location, block, block.name, documentId, instanceId, faceKey, issues),
      }
    }),
  }
}

function parseBlock(
  blockValue: unknown,
  parentPath: string,
  documentId: string,
  instanceId: string | null,
  faceKey: CardFaceKey,
  issues: CardPipelineIssue[],
): RenderReadyCardBlock {
  const source = toRecord(blockValue)
  const type = resolveBlockType(source, parentPath, documentId, instanceId, faceKey, issues)
  const sourceBlockId = primitiveString(source.id)
  const context: IssueContext = {
    documentId,
    instanceId,
    faceKey,
    owner: { kind: 'block', id: sourceBlockId },
    blockPath: joinBlockPath(parentPath, primitiveString(source.name)),
    blockId: sourceBlockId || undefined,
    typeName: type,
  }
  const fields = createFieldReader(source, context, issues)
  const base = parseBaseBlock(fields)

  context.blockId = base.id || undefined
  context.owner = { kind: 'block', id: base.id }
  context.blockPath = joinBlockPath(parentPath, base.name)

  switch (type) {
    case 'text-block':
    case 'markdown-text-block':
      return {
        ...base,
        type,
        content: fields.string('content'),
        fontSize: fields.cssLength('fontSize'),
        fontFamily: fields.string('fontFamily'),
        fontWeight: fields.string('fontWeight'),
        color: fields.string('color'),
        textAlign: fields.option('textAlign'),
        verticalAlign: fields.option('verticalAlign'),
        lineHeight: fields.cssLength('lineHeight'),
        writingMode: fields.option('writingMode'),
      }
    case 'image-block':
      return {
        ...base,
        type,
        image: fields.string('image'),
        fit: fields.option('fit'),
      }
    case 'qrcode-block':
      return {
        ...base,
        type,
        content: fields.string('content'),
        errorCorrection: fields.option('errorCorrection'),
        foreground: fields.string('foreground'),
        backgroundColor: fields.string('backgroundColor'),
        quietZone: fields.number('quietZone'),
      }
    case 'shape-block':
      return {
        ...base,
        type,
        shape: fields.option('shape'),
        fill: fields.string('fill'),
        stroke: fields.string('stroke'),
        strokeWidth: fields.number('strokeWidth'),
        strokeStyle: fields.option('strokeStyle'),
        strokeAlignment: fields.option('strokeAlignment'),
        strokeJoin: fields.option('strokeJoin'),
        strokeCap: fields.option('strokeCap'),
        strokeMiterLimit: fields.number('strokeMiterLimit'),
      }
    case 'simple-container-block':
      return {
        ...base,
        type,
        children: fields.array('children').map((childValue) => {
          const child = toRecord(childValue)
          const block = parseBlock(child.block, context.blockPath, documentId, instanceId, faceKey, issues)
          return {
            block,
            location: parseSimpleLocation(
              child.location,
              block,
              joinBlockPath(context.blockPath, block.name),
              documentId,
              instanceId,
              faceKey,
              issues,
            ),
          }
        }),
      }
    case 'flow-container-block':
      return {
        ...base,
        type,
        direction: fields.option('direction'),
        gap: fields.cssLength('gap'),
        children: fields.array('children').map((childValue) => {
          const child = toRecord(childValue)
          const block = parseBlock(child.block, context.blockPath, documentId, instanceId, faceKey, issues)
          return {
            block,
            location: parseFlowLocation(
              child.location,
              block,
              joinBlockPath(context.blockPath, block.name),
              documentId,
              instanceId,
              faceKey,
              issues,
            ),
          }
        }),
      }
  }
}

function parseBaseBlock(fields: FieldReader): RenderReadyBaseBlock {
  return {
    id: fields.string('id'),
    name: fields.string('name'),
    notes: fields.string('notes'),
    visible: fields.boolean('visible'),
    width: fields.cssLength('width'),
    height: fields.cssLength('height'),
    borderColor: fields.string('borderColor'),
    borderWidth: fields.number('borderWidth'),
    borderStyle: fields.option('borderStyle'),
    borderRadius: fields.cssLength('borderRadius'),
    background: fields.string('background'),
    translateX: fields.cssLength('translateX'),
    translateY: fields.cssLength('translateY'),
    scaleX: fields.number('scaleX'),
    scaleY: fields.number('scaleY'),
    transformAnchor: fields.option('transformAnchor'),
    zIndex: fields.number('zIndex'),
    rotation: fields.number('rotation'),
    opacity: fields.number('opacity'),
    customCss: fields.string('customCss'),
  }
}

function parseSimpleLocation(
  locationValue: unknown,
  block: RenderReadyCardBlock,
  blockPath: string,
  documentId: string,
  instanceId: string | null,
  faceKey: CardFaceKey,
  issues: CardPipelineIssue[],
): RenderReadySimpleContainerLocation {
  const source = toRecord(locationValue)
  const fields = createFieldReader(
    source,
    createLocationContext(source, block, blockPath, documentId, instanceId, faceKey, 'simple-container-location'),
    issues,
  )
  fields.expectedLiteral('type', 'simple-container-location')
  return {
    id: fields.string('id'),
    type: 'simple-container-location',
    anchor: fields.option('anchor'),
    x: fields.cssLength('x'),
    y: fields.cssLength('y'),
  }
}

function parseFlowLocation(
  locationValue: unknown,
  block: RenderReadyCardBlock,
  blockPath: string,
  documentId: string,
  instanceId: string | null,
  faceKey: CardFaceKey,
  issues: CardPipelineIssue[],
): RenderReadyFlowContainerLocation {
  const source = toRecord(locationValue)
  const fields = createFieldReader(
    source,
    createLocationContext(source, block, blockPath, documentId, instanceId, faceKey, 'flow-container-location'),
    issues,
  )
  fields.expectedLiteral('type', 'flow-container-location')
  return {
    id: fields.string('id'),
    type: 'flow-container-location',
    index: fields.number('index'),
    align: fields.option('align'),
  }
}

function createLocationContext(
  source: SourceRecord,
  block: RenderReadyCardBlock,
  blockPath: string,
  documentId: string,
  instanceId: string | null,
  faceKey: CardFaceKey,
  typeName: string,
): IssueContext {
  return {
    documentId,
    instanceId,
    faceKey,
    owner: { kind: 'location', id: primitiveString(source.id) },
    blockPath,
    blockId: block.id || undefined,
    typeName,
  }
}

type FieldReader = ReturnType<typeof createFieldReader>

function createFieldReader(source: SourceRecord, context: IssueContext, issues: CardPipelineIssue[]) {
  const schema = getTypePropertyEditorSchema(context.typeName)

  function definitionFor(fieldKey: string): EditorPropertyDefinition {
    const definition = schema[fieldKey]
    if (!definition) {
      throw new Error(`Missing schema definition for ${context.typeName}.${fieldKey}`)
    }
    return definition
  }

  function value(fieldKey: string): unknown {
    const definition = definitionFor(fieldKey)
    const hasValue = Object.prototype.hasOwnProperty.call(source, fieldKey)
      && source[fieldKey] !== null
      && source[fieldKey] !== undefined

    if (!hasValue) {
      return parseSchemaDefault(context.typeName, fieldKey, definition)
    }

    const parsed = convertValue(source[fieldKey], definition)
    if (!parsed.ok) {
      pushIssue(context, fieldKey, definition, parsed.reasonCode, issues)
      return parseSchemaDefault(context.typeName, fieldKey, definition)
    }
    return parsed.value
  }

  return {
    string(fieldKey: string): string {
      return value(fieldKey) as string
    },
    optionalString(fieldKey: string, fallback = ''): string {
      const definition = definitionFor(fieldKey)
      const hasValue = Object.prototype.hasOwnProperty.call(source, fieldKey)
        && source[fieldKey] !== null
        && source[fieldKey] !== undefined
      if (!hasValue) return fallback

      const parsed = convertValue(source[fieldKey], definition)
      if (!parsed.ok) {
        pushIssue(context, fieldKey, definition, parsed.reasonCode, issues)
        return fallback
      }
      return parsed.value as string
    },
    number(fieldKey: string): number {
      return value(fieldKey) as number
    },
    boolean(fieldKey: string): boolean {
      return value(fieldKey) as boolean
    },
    array(fieldKey: string): unknown[] {
      return value(fieldKey) as unknown[]
    },
    option<const T extends string>(fieldKey: string): T {
      return value(fieldKey) as T
    },
    cssLength(fieldKey: string): string {
      return normalizeCssLength(value(fieldKey) as string)
    },
    expectedLiteral(fieldKey: string, expected: string): void {
      const definition = definitionFor(fieldKey)
      const hasValue = Object.prototype.hasOwnProperty.call(source, fieldKey)
        && source[fieldKey] !== null
        && source[fieldKey] !== undefined
      if (!hasValue) {
        return
      }
      if (source[fieldKey] !== expected) {
        pushIssue(context, fieldKey, definition, 'invalid-option', issues)
      }
    },
  }
}

type ConversionResult =
  | { ok: true, value: unknown }
  | { ok: false, reasonCode: RenderParseFailure }

function convertValue(value: unknown, definition: EditorPropertyDefinition): ConversionResult {
  let converted: unknown

  switch (definition.fieldType) {
    case 'number': {
      let numericValue: number
      if (typeof value === 'string') {
        const parsed = value.trim() === '' ? Number.NaN : Number(value)
        if (!Number.isFinite(parsed)) return { ok: false, reasonCode: 'conversion-failed' }
        numericValue = parsed
      } else {
        return { ok: false, reasonCode: 'invalid-type' }
      }

      if ((definition.min !== undefined && numericValue < definition.min)
        || (definition.max !== undefined && numericValue > definition.max)) {
        return { ok: false, reasonCode: 'out-of-range' }
      }
      converted = numericValue
      break
    }
    case 'boolean':
      if (value === 'true' || value === 'false') {
        converted = value === 'true'
      } else {
        return {
          ok: false,
          reasonCode: typeof value === 'string' ? 'conversion-failed' : 'invalid-type',
        }
      }
      break
    case 'object':
      if (definition.isArray ? Array.isArray(value) : isRecord(value)) {
        converted = value
      } else {
        return { ok: false, reasonCode: 'invalid-type' }
      }
      break
    default:
      let stringValue: string
      if (typeof value === 'string') {
        stringValue = value
      } else {
        return { ok: false, reasonCode: 'invalid-type' }
      }

      if ('minLength' in definition && definition.minLength !== undefined
        && stringValue.length < definition.minLength) {
        return { ok: false, reasonCode: 'out-of-range' }
      }
      if ('maxLength' in definition && definition.maxLength !== undefined
        && stringValue.length > definition.maxLength) {
        return { ok: false, reasonCode: 'out-of-range' }
      }
      converted = stringValue
  }

  const allowedValues = getPropertyAllowedValues(definition)
  if (allowedValues && (typeof converted !== 'string' || !allowedValues.includes(converted))) {
    return { ok: false, reasonCode: 'invalid-option' }
  }

  return { ok: true, value: converted }
}

function parseSchemaDefault(
  typeName: string,
  fieldKey: string,
  definition: EditorPropertyDefinition,
): unknown {
  const parsed = convertValue(definition.defaultValue, definition)
  if (!parsed.ok) {
    throw new Error(`Invalid schema default for ${typeName}.${fieldKey}: ${parsed.reasonCode}`)
  }
  return parsed.value
}

function resolveBlockType(
  source: SourceRecord,
  parentPath: string,
  documentId: string,
  instanceId: string | null,
  faceKey: CardFaceKey,
  issues: CardPipelineIssue[],
): BlockType {
  const rawType = source.type
  if (typeof rawType === 'string' && blockTypes.includes(rawType as BlockType)) {
    return rawType as BlockType
  }

  const fallbackType: BlockType = 'text-block'
  const context: IssueContext = {
    documentId,
    instanceId,
    faceKey,
    owner: { kind: 'block', id: primitiveString(source.id) },
    blockPath: joinBlockPath(parentPath, primitiveString(source.name)),
    blockId: primitiveString(source.id) || undefined,
    typeName: fallbackType,
  }
  const definition = getTypePropertyEditorSchema(fallbackType).type
  if (!definition) throw new Error(`Missing schema definition for ${fallbackType}.type`)
  if (rawType !== null && rawType !== undefined) {
    pushIssue(context, 'type', definition, 'invalid-option', issues)
  }
  return fallbackType
}

function pushIssue(
  context: IssueContext,
  fieldKey: string,
  definition: EditorPropertyDefinition,
  reasonCode: RenderParseFailure,
  issues: CardPipelineIssue[],
): void {
  const defaultValue = formatIssueValue(parseSchemaDefault(context.typeName, fieldKey, definition))
  issues.push(createCardPipelineIssue({
    type: `card-designer.render-parse.${reasonCode}` as CardRenderParseIssueType,
    location: {
      documentId: context.documentId,
      instanceId: context.instanceId,
      faceKey: context.faceKey,
      owner: context.owner,
      ...(context.blockId ? { blockId: context.blockId } : {}),
      ...(context.blockPath ? { blockPath: context.blockPath } : {}),
      fieldKey,
    },
    parameters: {
      ...(definition.displayFieldKey ? { fieldName: definition.displayFieldKey } : {}),
      defaultValue,
    },
  }))
}

function formatIssueValue(value: unknown): string {
  if (typeof value === 'string') return value || '""'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value) ?? String(value)
}

function normalizeCssLength(value: string): string {
  const trimmed = value.trim()
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return `${trimmed}px`
  if (/^calc\(.+\)$/i.test(trimmed)) return trimmed
  if (/\S\s+[+\-*/]\s+\S/.test(trimmed)) return `calc(${trimmed})`
  return trimmed
}

function joinBlockPath(parentPath: string, blockName: string): string {
  if (!blockName) return parentPath
  return parentPath ? `${parentPath}.${blockName}` : blockName
}

function primitiveString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isRecord(value: unknown): value is SourceRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function toRecord(value: unknown): SourceRecord {
  return isRecord(value) ? value : {}
}
