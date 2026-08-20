import { isCardStoredValue, type CardBlock, type CardDataTableConfiguration, type CardDocument, type CardFace,
  type CardInstanceRecord, type CardStoredValue, type FlowContainerLocationInfo, type RootChild,
  type SimpleContainerLocationInfo } from './model'
import { fillDefaults, getTypePropertyEditorSchema, parseAdditionalFieldDefinitions } from './schema'

type SourceRecord = Record<string, unknown>
type CardLocation = SimpleContainerLocationInfo | FlowContainerLocationInfo

export type CardStorageWarning = {
  code: 'field-defaulted' | 'entry-ignored'
  path: string
  message: string
}

export type SerializeCardDocumentOptions = {
  resolveCustomBlockPublicFieldKeys?: (customBlockKey: string) => readonly string[] | undefined
}

type ProjectionOptions = { preserveCustomBlockExtras: boolean
  materializeRequiredDefaults: boolean
  resolveCustomBlockPublicFieldKeys?: SerializeCardDocumentOptions['resolveCustomBlockPublicFieldKeys'] }

const structuralFields = new Set(['children', 'faces', 'instances', 'data', 'dataTable', 'additionalFieldDefinition'])
const blockTypes = new Set<CardBlock['type']>(['text-block', 'markdown-text-block', 'image-block', 'qrcode-block',
  'shape-block', 'simple-container-block', 'flow-container-block', 'custom-block'])

export function normalizeCardDocument(value: unknown): { document: CardDocument, warnings: readonly CardStorageWarning[] } {
  if (!isRecord(value)) throw new Error('Card document must be a JSON object')
  const warnings: CardStorageWarning[] = []
  return {
    document: projectDocument(value, warnings, { preserveCustomBlockExtras: true, materializeRequiredDefaults: true }),
    warnings,
  }
}

export function normalizeStoredCardBlock(value: unknown): { block: CardBlock | null, warnings: readonly CardStorageWarning[] } {
  const warnings: CardStorageWarning[] = []
  return {
    block: projectBlock(value, '$', warnings, { preserveCustomBlockExtras: true, materializeRequiredDefaults: true }),
    warnings,
  }
}

export function serializeCardDocument(document: CardDocument, options: SerializeCardDocumentOptions = {}): string {
  return serializeCardDocumentWithWarnings(document, options).text
}

export function serializeCardDocumentWithWarnings(
  document: CardDocument,
  options: SerializeCardDocumentOptions = {},
): { text: string, warnings: readonly CardStorageWarning[] } {
  const warnings: CardStorageWarning[] = []
  const normalized = projectDocument(document as unknown as SourceRecord, warnings, {
    preserveCustomBlockExtras: false,
    materializeRequiredDefaults: false,
    resolveCustomBlockPublicFieldKeys: options.resolveCustomBlockPublicFieldKeys,
  })
  return { text: JSON.stringify(normalized, null, 2), warnings }
}

function projectDocument(source: SourceRecord, warnings: CardStorageWarning[], options: ProjectionOptions): CardDocument {
  const document = projectKnownFields('card-document', source, '$', warnings, options.materializeRequiredDefaults)
  document.type = 'card-document'
  document.id = nonEmptyString(document.id) ?? 'document'
  document.faces = {
    front: projectFace(isRecord(source.faces) ? source.faces.front : undefined, 'front', warnings, options),
    back: projectFace(isRecord(source.faces) ? source.faces.back : undefined, 'back', warnings, options),
  }
  document.instances = projectArray(source.instances, '$.instances', warnings, (value, path) => (
    projectInstance(value, path, warnings, options.materializeRequiredDefaults)
  ))
  const dataTable = projectDataTable(source.dataTable, warnings)
  if (dataTable) document.dataTable = dataTable
  else delete document.dataTable
  return document as CardDocument
}

function projectFace(value: unknown, faceKey: 'front' | 'back', warnings: CardStorageWarning[], options: ProjectionOptions): CardFace {
  const path = `$.faces.${faceKey}`
  const source = isRecord(value) ? value : {}
  if (value !== undefined && !isRecord(value)) warnIgnored(warnings, path, 'Invalid Card Face was replaced with defaults')
  const face = projectKnownFields('card-face', source, path, warnings, options.materializeRequiredDefaults)
  face.type = 'card-face'
  face.id = nonEmptyString(face.id) ?? faceKey
  face.children = projectArray(source.children, `${path}.children`, warnings, (child, childPath): RootChild | null => {
    if (!isRecord(child)) return ignored(warnings, childPath, 'Invalid root child was ignored')
    const block = projectBlock(child.block, `${childPath}.block`, warnings, options)
    return block ? {
      block,
      location: projectLocation(
        child.location,
        'simple-container-location',
        `${childPath}.location`,
        warnings,
        options.materializeRequiredDefaults,
      ) as SimpleContainerLocationInfo,
    } : null
  })
  return face as CardFace
}

function projectBlock(value: unknown, path: string, warnings: CardStorageWarning[], options: ProjectionOptions): CardBlock | null {
  if (!isRecord(value)) return ignored(warnings, path, 'Invalid Block was ignored')
  const type = typeof value.type === 'string' ? value.type : ''
  if (!blockTypes.has(type as CardBlock['type'])) return ignored(warnings, path, `Unknown Block type ${type || '(missing)'} was ignored`)

  const block = projectKnownFields(type, value, path, warnings, options.materializeRequiredDefaults)
  block.type = type
  block.id = nonEmptyString(block.id) ?? `${type}@${path}`
  const definitions = parseAdditionalFieldDefinitions(value.additionalFieldDefinition)
  if (Object.keys(definitions).length > 0) block.additionalFieldDefinition = definitions

  for (const [fieldKey, definition] of Object.entries(definitions)) {
    const fieldValue = value[fieldKey]
    if (isCardStoredValue(fieldValue)) block[fieldKey] = structuredClone(fieldValue)
    else if (options.materializeRequiredDefaults) block[fieldKey] = additionalFieldDefault(definition.fieldType)
  }

  if (type === 'custom-block') {
    const customBlockKey = typeof value.customBlockKey === 'string' ? value.customBlockKey : ''
    block.customBlockKey = customBlockKey
    const publicKeys = options.preserveCustomBlockExtras
      ? Object.keys(value).filter(key => !structuralFields.has(key)
        && !Object.prototype.hasOwnProperty.call(getTypePropertyEditorSchema(type), key))
      : [...(options.resolveCustomBlockPublicFieldKeys?.(customBlockKey) ?? [])]
    for (const fieldKey of publicKeys) {
      if (isCardStoredValue(value[fieldKey])) block[fieldKey] = structuredClone(value[fieldKey])
    }
    return block as unknown as CardBlock
  }

  if (type === 'simple-container-block' || type === 'flow-container-block') {
    block.children = projectArray(value.children, `${path}.children`, warnings, (child, childPath) => {
      if (!isRecord(child)) return ignored(warnings, childPath, 'Invalid container child was ignored')
      const childBlock = projectBlock(child.block, `${childPath}.block`, warnings, options)
      if (!childBlock) return null
      return {
        block: childBlock,
        location: projectLocation(
          child.location,
          type === 'flow-container-block' ? 'flow-container-location' : 'simple-container-location',
          `${childPath}.location`,
          warnings,
          options.materializeRequiredDefaults,
        ),
      }
    })
  }
  return block as unknown as CardBlock
}

function projectLocation(
  value: unknown,
  type: CardLocation['type'],
  path: string,
  warnings: CardStorageWarning[],
  materializeRequiredDefaults: boolean,
): CardLocation {
  const source = isRecord(value) ? value : {}
  if (value !== undefined && !isRecord(value)) warnIgnored(warnings, path, 'Invalid location was replaced with defaults')
  const location = projectKnownFields(type, source, path, warnings, materializeRequiredDefaults)
  location.type = type
  location.id = nonEmptyString(location.id) ?? `${type}@${path}`
  return location as CardLocation
}

function projectInstance(
  value: unknown,
  path: string,
  warnings: CardStorageWarning[],
  materializeRequiredDefaults: boolean,
): CardInstanceRecord | null {
  if (!isRecord(value)) return ignored(warnings, path, 'Invalid card instance was ignored')
  const instance = projectKnownFields('card-instance', value, path, warnings, materializeRequiredDefaults)
  instance.type = 'card-instance'
  instance.id = nonEmptyString(instance.id) ?? `instance@${path}`
  const data: CardInstanceRecord['data'] = {}
  if (isRecord(value.data)) {
    for (const [blockId, fields] of Object.entries(value.data)) {
      if (!blockId || !isRecord(fields)) {
        warnIgnored(warnings, `${path}.data.${blockId}`, 'Invalid instance data row was ignored')
        continue
      }
      const projected = Object.fromEntries(Object.entries(fields).flatMap(([fieldKey, fieldValue]) => (
        fieldKey && isCardStoredValue(fieldValue) ? [[fieldKey, structuredClone(fieldValue)]] : []
      )))
      if (Object.keys(projected).length > 0) data[blockId] = projected
    }
  }
  instance.data = data
  return instance as CardInstanceRecord
}

function projectDataTable(value: unknown, warnings: CardStorageWarning[]): CardDataTableConfiguration | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) return ignored(warnings, '$.dataTable', 'Invalid data-table configuration was ignored') ?? undefined
  const blocks: Record<string, string[]> = {}
  if (isRecord(value.blocks)) {
    for (const [blockId, fields] of Object.entries(value.blocks)) {
      if (!blockId || !Array.isArray(fields)) {
        warnIgnored(warnings, `$.dataTable.blocks.${blockId}`, 'Invalid data-table row was ignored')
        continue
      }
      blocks[blockId] = [...new Set(fields.filter((field): field is string => typeof field === 'string' && field.length > 0))]
    }
  }
  const exportInstanceIds = Array.isArray(value.exportInstanceIds)
    ? [...new Set(value.exportInstanceIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : undefined
  return { blocks, ...(exportInstanceIds ? { exportInstanceIds } : {}) }
}

function projectKnownFields(
  type: string,
  source: SourceRecord,
  path: string,
  warnings: CardStorageWarning[],
  materializeRequiredDefaults: boolean,
): SourceRecord {
  const defaults = fillDefaults(type, {})
  const schema = getTypePropertyEditorSchema(type)
  const projected: SourceRecord = {}
  for (const fieldKey of Object.keys(schema)) {
    if (structuralFields.has(fieldKey)) continue
    const value = source[fieldKey]
    if (isCardStoredValue(value)) {
      projected[fieldKey] = structuredClone(value)
    }
    else if (materializeRequiredDefaults && schema[fieldKey]?.required === true && defaults[fieldKey] !== undefined) {
      projected[fieldKey] = structuredClone(defaults[fieldKey])
      warnings.push({
        code: 'field-defaulted',
        path: `${path}.${fieldKey}`,
        message: value === undefined || value === null ? 'Required field was defaulted' : 'Invalid field value was replaced with its default',
      })
    } else if (value !== undefined && value !== null) {
      warnIgnored(warnings, `${path}.${fieldKey}`, 'Invalid optional field was ignored')
    }
  }
  return projected
}

function projectArray<T>(value: unknown, path: string, warnings: CardStorageWarning[], project: (value: unknown, path: string) => T | null): T[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    warnIgnored(warnings, path, 'Invalid collection was replaced with an empty collection')
    return []
  }
  return value.flatMap((item, index) => {
    const projected = project(item, `${path}[${index}]`)
    return projected === null ? [] : [projected]
  })
}

function nonEmptyString(value: unknown): string | null { return typeof value === 'string' && value.length > 0 ? value : null }

function additionalFieldDefault(fieldType: string): CardStoredValue {
  if (fieldType === 'number') return '0'
  if (fieldType === 'boolean') return 'false'
  if (fieldType === 'object') return {}
  return ''
}

function warnIgnored(warnings: CardStorageWarning[], path: string, message: string): void {
  warnings.push({ code: 'entry-ignored', path, message }) }

function ignored(warnings: CardStorageWarning[], path: string, message: string): null {
  warnIgnored(warnings, path, message)
  return null
}

function isRecord(value: unknown): value is SourceRecord { return !!value && typeof value === 'object' && !Array.isArray(value) }
