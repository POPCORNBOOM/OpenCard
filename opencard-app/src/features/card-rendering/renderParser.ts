import type { CardBlock, CardDocument } from '../../entities/card/model'
import {
  getPropertyAllowedValues,
  getTypePropertyEditorSchema,
  type EditorPropertyDefinition,
} from '../../entities/card/schema'
import type {
  RenderIssue,
  RenderIssueReasonCode,
  RenderParseResult,
  RenderReadyBaseBlock,
  RenderReadyCardBlock,
  RenderReadyCardDocument,
  RenderReadyFlowContainerLocation,
  RenderReadySimpleContainerLocation,
} from './render.types'

type SourceRecord = Record<string, unknown>
type BlockType = CardBlock['type']

type IssueContext = {
  documentId: string
  blockPath: string
  blockId?: string
  typeName: string
}

const blockTypes: readonly BlockType[] = [
  'text-block',
  'image-block',
  'qrcode-block',
  'shape-block',
  'simple-container-block',
  'flow-container-block',
]

export function parseRenderDocument(bindingExpandedCardDocument: CardDocument): RenderParseResult {
  const issues: RenderIssue[] = []
  const source = toRecord(bindingExpandedCardDocument)
  const context: IssueContext = {
    documentId: primitiveString(source.id),
    blockPath: '',
    typeName: 'card-document',
  }
  const fields = createFieldReader(source, context, issues)

  fields.expectedLiteral('type', 'card-document')
  const id = fields.string('id')
  context.documentId = id

  const document: RenderReadyCardDocument = {
    type: 'card-document',
    id,
    name: fields.string('name'),
    width: fields.number('width'),
    height: fields.number('height'),
    background: fields.string('background'),
    children: fields.array('children').map((childValue) => {
      const child = toRecord(childValue)
      const block = parseBlock(child.block, '', id, issues)
      return {
        block,
        location: parseSimpleLocation(child.location, block, block.name, id, issues),
      }
    }),
  }

  return { document, issues }
}

function parseBlock(
  blockValue: unknown,
  parentPath: string,
  documentId: string,
  issues: RenderIssue[],
): RenderReadyCardBlock {
  const source = toRecord(blockValue)
  const type = resolveBlockType(source, parentPath, documentId, issues)
  const context: IssueContext = {
    documentId,
    blockPath: joinBlockPath(parentPath, primitiveString(source.name)),
    blockId: primitiveString(source.id) || undefined,
    typeName: type,
  }
  const fields = createFieldReader(source, context, issues)
  const base = parseBaseBlock(fields)

  context.blockId = base.id || undefined
  context.blockPath = joinBlockPath(parentPath, base.name)

  switch (type) {
    case 'text-block':
      return {
        ...base,
        type,
        content: fields.string('content'),
        mode: fields.option('mode'),
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
          const block = parseBlock(child.block, context.blockPath, documentId, issues)
          return {
            block,
            location: parseSimpleLocation(
              child.location,
              block,
              joinBlockPath(context.blockPath, block.name),
              documentId,
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
          const block = parseBlock(child.block, context.blockPath, documentId, issues)
          return {
            block,
            location: parseFlowLocation(
              child.location,
              block,
              joinBlockPath(context.blockPath, block.name),
              documentId,
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
  issues: RenderIssue[],
): RenderReadySimpleContainerLocation {
  const source = toRecord(locationValue)
  const fields = createFieldReader(
    source,
    createBlockContext(block, blockPath, documentId, 'simple-container-location'),
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
  issues: RenderIssue[],
): RenderReadyFlowContainerLocation {
  const source = toRecord(locationValue)
  const fields = createFieldReader(
    source,
    createBlockContext(block, blockPath, documentId, 'flow-container-location'),
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

function createBlockContext(
  block: RenderReadyCardBlock,
  blockPath: string,
  documentId: string,
  typeName: string,
): IssueContext {
  return {
    documentId,
    blockPath,
    blockId: block.id || undefined,
    typeName,
  }
}

type FieldReader = ReturnType<typeof createFieldReader>

function createFieldReader(source: SourceRecord, context: IssueContext, issues: RenderIssue[]) {
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
      pushIssue(context, fieldKey, definition, 'MISSING_VALUE', issues)
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
    number(fieldKey: string): number {
      return value(fieldKey) as number
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
        pushIssue(context, fieldKey, definition, 'MISSING_VALUE', issues)
        return
      }
      if (source[fieldKey] !== expected) {
        pushIssue(context, fieldKey, definition, 'INVALID_OPTION', issues)
      }
    },
  }
}

type ConversionResult =
  | { ok: true, value: unknown }
  | { ok: false, reasonCode: RenderIssueReasonCode }

function convertValue(value: unknown, definition: EditorPropertyDefinition): ConversionResult {
  let converted: unknown

  switch (definition.fieldType) {
    case 'number': {
      let numericValue: number
      if (typeof value === 'string') {
        const parsed = value.trim() === '' ? Number.NaN : Number(value)
        if (!Number.isFinite(parsed)) return { ok: false, reasonCode: 'CONVERSION_FAILED' }
        numericValue = parsed
      } else {
        return { ok: false, reasonCode: 'INVALID_TYPE' }
      }

      if ((definition.min !== undefined && numericValue < definition.min)
        || (definition.max !== undefined && numericValue > definition.max)) {
        return { ok: false, reasonCode: 'OUT_OF_RANGE' }
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
          reasonCode: typeof value === 'string' ? 'CONVERSION_FAILED' : 'INVALID_TYPE',
        }
      }
      break
    case 'object':
      if (definition.isArray ? Array.isArray(value) : isRecord(value)) {
        converted = value
      } else {
        return { ok: false, reasonCode: 'INVALID_TYPE' }
      }
      break
    default:
      let stringValue: string
      if (typeof value === 'string') {
        stringValue = value
      } else {
        return { ok: false, reasonCode: 'INVALID_TYPE' }
      }

      if ('minLength' in definition && definition.minLength !== undefined
        && stringValue.length < definition.minLength) {
        return { ok: false, reasonCode: 'OUT_OF_RANGE' }
      }
      if ('maxLength' in definition && definition.maxLength !== undefined
        && stringValue.length > definition.maxLength) {
        return { ok: false, reasonCode: 'OUT_OF_RANGE' }
      }
      converted = stringValue
  }

  const allowedValues = getPropertyAllowedValues(definition)
  if (allowedValues && (typeof converted !== 'string' || !allowedValues.includes(converted))) {
    return { ok: false, reasonCode: 'INVALID_OPTION' }
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
  issues: RenderIssue[],
): BlockType {
  const rawType = source.type
  if (typeof rawType === 'string' && blockTypes.includes(rawType as BlockType)) {
    return rawType as BlockType
  }

  const fallbackType: BlockType = 'text-block'
  const context: IssueContext = {
    documentId,
    blockPath: joinBlockPath(parentPath, primitiveString(source.name)),
    blockId: primitiveString(source.id) || undefined,
    typeName: fallbackType,
  }
  const definition = getTypePropertyEditorSchema(fallbackType).type
  if (!definition) throw new Error(`Missing schema definition for ${fallbackType}.type`)
  pushIssue(
    context,
    'type',
    definition,
    rawType === null || rawType === undefined ? 'MISSING_VALUE' : 'INVALID_OPTION',
    issues,
  )
  return fallbackType
}

function pushIssue(
  context: IssueContext,
  fieldKey: string,
  definition: EditorPropertyDefinition,
  reasonCode: RenderIssueReasonCode,
  issues: RenderIssue[],
): void {
  issues.push({
    documentId: context.documentId,
    blockPath: context.blockPath,
    ...(context.blockId ? { blockId: context.blockId } : {}),
    fieldKey,
    ...(definition.displayFieldKey ? { fieldName: definition.displayFieldKey } : {}),
    reasonCode,
  })
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
