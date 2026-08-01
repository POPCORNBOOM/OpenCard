import {
  type CardBlock,
  type CardDocument,
  type CardFace,
  type CardInstanceRecord,
  type FlowContainerLocationInfo,
  type RootChild,
  type SimpleContainerLocationInfo,
} from './model'

type SourceRecord = Record<string, unknown>
type CardLocation = SimpleContainerLocationInfo | FlowContainerLocationInfo

const blockTypes = new Set<CardBlock['type']>([
  'text-block',
  'markdown-text-block',
  'image-block',
  'qrcode-block',
  'shape-block',
  'simple-container-block',
  'flow-container-block',
])

export function parseCardDocument(value: unknown): CardDocument {
  assertStoredObject(value, '$')
  assertStringField(value, 'type', '$', 'card-document')
  assertStringField(value, 'schemaVersion', '$', '2')
  assertStringField(value, 'id', '$')
  assertOptionalStringField(value, 'name', '$')
  assertOptionalStringField(value, 'description', '$')
  assertOptionalStringField(value, 'notes', '$')
  assertStringField(value, 'version', '$')
  assertStringField(value, 'width', '$')
  assertStringField(value, 'height', '$')
  assertStoredObject(value.faces, '$.faces')
  assertFace(value.faces.front, '$.faces.front')
  assertFace(value.faces.back, '$.faces.back')

  if (value.dataTable !== undefined) {
    assertDataTableConfiguration(value.dataTable, '$.dataTable')
  }

  const instances = assertArrayField(value, 'instances', '$')
  instances.forEach((instance, index) => assertInstance(instance, `$.instances[${index}]`))

  return value as CardDocument
}

function assertDataTableConfiguration(value: unknown, path: string): void {
  assertStoredObject(value, path)
  assertStoredObject(value.blocks, `${path}.blocks`)
  for (const [blockId, fieldKeys] of Object.entries(value.blocks)) {
    if (!blockId) throw new Error(`${path}.blocks contains an empty Block ID`)
    if (!Array.isArray(fieldKeys)) throw new Error(`${path}.blocks.${blockId} must be an array`)
    fieldKeys.forEach((fieldKey, index) => {
      if (typeof fieldKey !== 'string' || !fieldKey) {
        throw new Error(`${path}.blocks.${blockId}[${index}] must be a non-empty string`)
      }
    })
  }
  if (value.exportInstanceIds !== undefined) {
    if (!Array.isArray(value.exportInstanceIds)) {
      throw new Error(`${path}.exportInstanceIds must be an array`)
    }
    const seen = new Set<string>()
    value.exportInstanceIds.forEach((instanceId, index) => {
      if (typeof instanceId !== 'string' || !instanceId) {
        throw new Error(`${path}.exportInstanceIds[${index}] must be a non-empty string`)
      }
      if (seen.has(instanceId)) {
        throw new Error(`${path}.exportInstanceIds contains duplicate Instance ID ${instanceId}`)
      }
      seen.add(instanceId)
    })
  }
}

function assertFace(value: unknown, path: string): asserts value is CardFace {
  assertStoredObject(value, path)
  assertStringField(value, 'type', path, 'card-face')
  assertStringField(value, 'id', path)
  assertStringField(value, 'background', path)
  const children = assertArrayField(value, 'children', path)
  children.forEach((child, index) => assertRootChild(child, `${path}.children[${index}]`))
}

export function serializeCardDocument(document: CardDocument): string {
  return JSON.stringify(parseCardDocument(document), null, 2)
}

function assertRootChild(value: unknown, path: string): asserts value is RootChild {
  assertStoredObject(value, path)
  assertBlock(value.block, `${path}.block`)
  assertLocation(value.location, `${path}.location`, 'simple-container-location')
}

function assertBlock(value: unknown, path: string): asserts value is CardBlock {
  assertStoredObject(value, path)
  const type = assertStringField(value, 'type', path)
  if (!blockTypes.has(type as CardBlock['type'])) {
    throw new Error(`${path}.type is not a supported block type`)
  }
  assertStringField(value, 'id', path)

  if (type !== 'simple-container-block' && type !== 'flow-container-block') return

  const children = assertArrayField(value, 'children', path)
  children.forEach((childValue, index) => {
    const childPath = `${path}.children[${index}]`
    assertStoredObject(childValue, childPath)
    assertBlock(childValue.block, `${childPath}.block`)
    assertLocation(
      childValue.location,
      `${childPath}.location`,
      type === 'flow-container-block' ? 'flow-container-location' : 'simple-container-location',
    )
  })
}

function assertLocation(
  value: unknown,
  path: string,
  expectedType: CardLocation['type'],
): asserts value is CardLocation {
  assertStoredObject(value, path)
  assertStringField(value, 'type', path, expectedType)
  assertStringField(value, 'id', path)
}

function assertInstance(value: unknown, path: string): asserts value is CardInstanceRecord {
  assertStoredObject(value, path)
  assertStringField(value, 'type', path, 'card-instance')
  assertStringField(value, 'id', path)
  assertStringField(value, 'name', path)
  assertStringField(value, 'amount', path)
  assertStoredObject(value.data, `${path}.data`)
}

function assertStoredObject(value: unknown, path: string): asserts value is SourceRecord {
  if (!isRecord(value)) throw new Error(`${path} must be an object`)
  assertStoredTree(value, path)
}

function assertStoredTree(value: unknown, path: string): void {
  if (typeof value === 'string') return
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertStoredTree(item, `${path}[${index}]`))
    return
  }
  if (!isRecord(value)) throw new Error(`${path} contains a scalar that is not a string`)
  for (const [fieldKey, fieldValue] of Object.entries(value)) {
    if (fieldKey === 'datatype') {
      throw new Error(`${path}.datatype is no longer supported; use fieldType`)
    }
    assertStoredTree(fieldValue, `${path}.${fieldKey}`)
  }
}

function assertArrayField(source: SourceRecord, fieldKey: string, path: string): unknown[] {
  const value = source[fieldKey]
  if (!Array.isArray(value)) throw new Error(`${path}.${fieldKey} must be an array`)
  return value
}

function assertStringField(
  source: SourceRecord,
  fieldKey: string,
  path: string,
  expectedValue?: string,
): string {
  const value = source[fieldKey]
  if (typeof value !== 'string') throw new Error(`${path}.${fieldKey} must be a string`)
  if (expectedValue !== undefined && value !== expectedValue) {
    throw new Error(`${path}.${fieldKey} must be ${expectedValue}`)
  }
  return value
}

function assertOptionalStringField(source: SourceRecord, fieldKey: string, path: string): void {
  if (!Object.prototype.hasOwnProperty.call(source, fieldKey)) return
  assertStringField(source, fieldKey, path)
}

function isRecord(value: unknown): value is SourceRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
