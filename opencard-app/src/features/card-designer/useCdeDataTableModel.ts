import { computed, type Ref } from 'vue'
import {
  getAdditionalFieldPropertyDefinition,
  type CardBlock,
  type CardDocument,
  type CardFaceKey,
} from '../../entities/card/model'
import type { EditorPropertyDefinition } from '../../entities/card/schema'
import { isBlockContainer } from '../../entities/card/tree'
import type { CdePropertyFieldDefinition } from './cdePropertyFieldDefinitions'
import { resolveCdePropertyFields } from './cdePropertyFieldDefinitions'

export type CdeDataTableColumn = {
  key: string
  kind: 'blueprint' | 'instance'
  title: string
}

export type CdeDataTableCell = {
  identity: string
  cardId: string
  value: unknown
  inherited: boolean
  overridden: boolean
}

export type CdeDataTableFieldCatalogEntry = {
  key: string
  title: string
  definition: CdePropertyFieldDefinition
  deletable: boolean
}

export type CdeDataTableFieldRow = CdeDataTableFieldCatalogEntry & {
  cells: CdeDataTableCell[]
}

export type CdeDataTableBlockCatalogEntry = {
  key: string
  title: string
  type: CardBlock['type']
  depth: number
  fields: CdeDataTableFieldCatalogEntry[]
}

export type CdeDataTableBlockRow = Omit<CdeDataTableBlockCatalogEntry, 'fields'> & {
  fields: CdeDataTableFieldRow[]
}

export type CdeDataTableFaceGroup = {
  key: CardFaceKey
  title: string
  blocks: CdeDataTableBlockRow[]
}

export type CdeDataTableFaceCatalog = {
  key: CardFaceKey
  title: string
  blocks: CdeDataTableBlockCatalogEntry[]
}

export type CdeDataTableFieldSelection = Readonly<Record<string, readonly string[]>>

type UseCdeDataTableModelOptions = {
  cardDoc: Readonly<Ref<CardDocument | null>>
  documentRevision: Readonly<Ref<number>>
  fieldSelection: Readonly<Ref<CdeDataTableFieldSelection>>
  blueprintCardId: string
  blueprintTitle: () => string
  faceTitle: (faceKey: CardFaceKey) => string
  translate: (messageKey: string) => string
  hasMessage: (messageKey: string) => boolean
}

function hasOwn(record: object, fieldKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, fieldKey)
}

export function useCdeDataTableModel(options: UseCdeDataTableModelOptions) {
  const columns = computed<CdeDataTableColumn[]>(() => {
    options.documentRevision.value
    return [
      { key: options.blueprintCardId, kind: 'blueprint', title: options.blueprintTitle() },
      ...(options.cardDoc.value?.instances ?? []).map(instance => ({
        key: instance.id,
        kind: 'instance' as const,
        title: instance.name?.trim() || instance.id,
      })),
    ]
  })

  const catalogFaceGroups = computed<CdeDataTableFaceCatalog[]>(() => {
    options.documentRevision.value
    const document = options.cardDoc.value
    if (!document) return []

    return (['front', 'back'] as const).map(faceKey => ({
      key: faceKey,
      title: options.faceTitle(faceKey),
      blocks: projectBlockCatalog(document, faceKey),
    }))
  })

  const faceGroups = computed<CdeDataTableFaceGroup[]>(() => {
    options.documentRevision.value
    const document = options.cardDoc.value
    if (!document) return []
    const selection = options.fieldSelection.value
    const blockLookup = createBlockLookup(document)
    const instanceLookup = new Map((document.instances ?? []).map(instance => [instance.id, instance]))

    return catalogFaceGroups.value.map(face => ({
      key: face.key,
      title: face.title,
      blocks: face.blocks.flatMap((blockCatalog) => {
        if (!hasOwn(selection, blockCatalog.key)) return []
        const block = blockLookup.get(blockCatalog.key)
        if (!block) return []
        const selectedFields = new Set(selection[blockCatalog.key] ?? [])
        return [{
          ...blockCatalog,
          fields: blockCatalog.fields
            .filter(field => selectedFields.has(field.key))
            .map(field => ({
              ...field,
              cells: projectCells(document, block, field, columns.value, instanceLookup),
            })),
        }]
      }),
    }))
  })

  function projectBlockCatalog(
    document: CardDocument,
    faceKey: CardFaceKey,
  ): CdeDataTableBlockCatalogEntry[] {
    const rows: CdeDataTableBlockCatalogEntry[] = []

    function visit(block: CardBlock, depth: number): void {
      rows.push({
        key: block.id,
        title: block.name?.trim() || block.id,
        type: block.type,
        depth,
        fields: projectFieldCatalog(document, block),
      })
      if (isBlockContainer(block)) {
        for (const child of block.children) visit(child.block, depth + 1)
      }
    }

    for (const child of document.faces[faceKey].children) visit(child.block, 0)
    return rows
  }

  function projectFieldCatalog(
    document: CardDocument,
    block: CardBlock,
  ): CdeDataTableFieldCatalogEntry[] {
    const definitionRecord: Record<string, unknown> = { ...block }
    for (const instance of document.instances ?? []) {
      for (const fieldKey of Object.keys(instance.data[block.id] ?? {})) {
        if (!hasOwn(definitionRecord, fieldKey)) definitionRecord[fieldKey] = undefined
      }
    }

    const override = Object.fromEntries(Object.entries(block.additionalFieldDefinition ?? {}).map(
      ([fieldKey, definition]) => [
        fieldKey,
        getAdditionalFieldPropertyDefinition(definition) as Partial<EditorPropertyDefinition>,
      ],
    ))
    const labels = Object.fromEntries(Object.entries(block.additionalFieldDefinition ?? {}).map(
      ([fieldKey, definition]) => [fieldKey, definition.title ?? fieldKey],
    ))
    const definitions = resolveCdePropertyFields(definitionRecord, {
      allowDelete: true,
      translate: options.translate,
      hasMessage: options.hasMessage,
      override,
      labels,
      categorylessKeys: new Set(Object.keys(block.additionalFieldDefinition ?? {})),
    })
    const blockRecord = block as unknown as Record<string, unknown>

    return Object.entries(definitions)
      .filter(([, definition]) => !definition.isHidden)
      .map(([fieldKey, definition]) => ({
        key: fieldKey,
        title: definition.title,
        definition,
        deletable: hasOwn(blockRecord, fieldKey) && definition.deletable === true,
      }))
  }

  function projectCells(
    _document: CardDocument,
    block: CardBlock,
    field: CdeDataTableFieldCatalogEntry,
    projectedColumns: readonly CdeDataTableColumn[],
    instanceLookup: ReadonlyMap<string, CardDocument['instances'][number]>,
  ): CdeDataTableCell[] {
    const blockRecord = block as unknown as Record<string, unknown>
    const blueprintValue = hasOwn(blockRecord, field.key)
      ? blockRecord[field.key]
      : field.definition.defaultValue
    return projectedColumns.map<CdeDataTableCell>((column) => {
      const overrideRecord = column.kind === 'instance'
        ? instanceLookup.get(column.key)?.data[block.id]
        : undefined
      const overridden = Boolean(overrideRecord && hasOwn(overrideRecord, field.key))
      return {
        identity: `${column.key}\u0000${block.id}\u0000${field.key}`,
        cardId: column.key,
        value: overridden ? overrideRecord![field.key] : blueprintValue,
        inherited: column.kind === 'instance' && !overridden,
        overridden,
      }
    })
  }

  function createBlockLookup(document: CardDocument): Map<string, CardBlock> {
    const lookup = new Map<string, CardBlock>()
    function visit(block: CardBlock): void {
      lookup.set(block.id, block)
      if (isBlockContainer(block)) {
        for (const child of block.children) visit(child.block)
      }
    }
    for (const face of Object.values(document.faces)) {
      for (const child of face.children) visit(child.block)
    }
    return lookup
  }

  return { columns, catalogFaceGroups, faceGroups }
}
