import {
  acceptsCardFieldBinding,
  exposesCardFieldReference,
  getCardFieldKeys,
  getCardFieldValue,
  getCardFieldValueKind,
  hasCardField,
  setCardFieldValue,
  type AdditionalFieldDefinitionMap,
  type CardBlock,
  type CardDocument,
  type CardInstanceRecord,
  type FlowContainerLocationInfo,
  type SimpleContainerLocationInfo,
} from '../../entities/card/model'
import {
  buildParentLookup,
  isBlockContainer,
  type ParentLookup,
} from '../../entities/card/tree'
import { isBindingCompatible, type BindingValueKind } from '../editor-runtime/model/binding'
import { parseFieldReference } from '../editor-runtime/model/bindingExpression'
import {
  exposesProjectFieldReference,
  getProjectFieldValueKind,
  type ProjectInformation,
} from '../workspace/model/projectMetadata'
import {
  createCardPipelineIssue,
  type CardBindingIssueType,
  type CardPipelineIssue,
} from './cardPipelineIssue'

const templateTokenPattern = /\{\{\s*([^{}]+?)\s*\}\}/g
const singleTemplateTokenPattern = /^\s*\{\{\s*([^{}]+?)\s*\}\}\s*$/
const maxReferenceDepth = 24

function toCharacterOffset(value: string, codeUnitOffset: number): number {
  return Array.from(value.slice(0, Math.max(0, codeUnitOffset))).length
}

export function resolveParentFieldReferenceKey(
  blockId: string,
  reference: string,
  parentLookup: ParentLookup,
): string | null {
  const descriptor = parseFieldReference(reference)
  if (!descriptor) {
    return null
  }

  if (descriptor.kind === 'current-card' || descriptor.kind === 'project') {
    return null
  }

  if (descriptor.kind === 'current-block') {
    return `${blockId}:${descriptor.fieldKey}`
  }

  if (descriptor.kind === 'document') {
    let currentBlockId = blockId
    while (true) {
      const parent = parentLookup.get(currentBlockId)
      if (!parent) {
        return null
      }
      if (parent.type === 'card-document') {
        return `${parent.id}:${descriptor.fieldKey}`
      }
      currentBlockId = parent.id
    }
  }

  let currentBlockId = blockId
  for (let depth = 0; depth < descriptor.parentDepth; depth += 1) {
    const parent = parentLookup.get(currentBlockId)
    if (!parent || parent.type === 'card-document') {
      return null
    }

    currentBlockId = parent.id
  }

  return `${currentBlockId}:${descriptor.fieldKey}`
}

export type ResolveReferencesResult = {
  document: CardDocument
  issues: CardPipelineIssue[]
}

export type ResolveReferencesOptions = {
  currentCard?: CardInstanceRecord | null
  project?: Readonly<ProjectInformation> | null
}

type ReferenceOwnerKind = 'document' | 'block' | 'location' | 'current-card'
type ReferenceOwner = {
  kind: ReferenceOwnerKind
  key: string
  id: string
  typeName: string
  source: Record<string, unknown>
  target: Record<string, unknown>
  anchorBlockId: string | null
  blockPath?: string
}

type ResolveFieldResult =
  | { ok: true, value: unknown }
  | { ok: false, value: unknown }

type ResolveTokenResult =
  | { ok: true, value: unknown, valueKind: BindingValueKind }
  | { ok: false, value: unknown }

type ResolveMemoState = 'resolving' | 'done' | 'failed'

function cloneAdditionalFieldDefinitions(
  definitions: AdditionalFieldDefinitionMap | undefined,
): AdditionalFieldDefinitionMap | undefined {
  if (!definitions) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(definitions).map(([fieldKey, definition]) => [fieldKey, { ...definition }]),
  )
}

function valueMatchesBindingKind(value: unknown, kind: BindingValueKind): boolean {
  if (kind === 'string') return typeof value === 'string'
  if (kind === 'number') {
    if (typeof value !== 'string' || value.trim() === '') return false
    return Number.isFinite(Number(value))
  }
  if (kind === 'boolean') return value === 'true' || value === 'false'
  return !!value && typeof value === 'object'
}

export function resolveReferences(
  document: CardDocument,
  options: ResolveReferencesOptions = {},
): ResolveReferencesResult {
  const sourceDocument = document
  const cloneBlockTree = (block: CardBlock): CardBlock => {
    if (block.type === 'simple-container-block') {
      return {
        ...block,
        additionalFieldDefinition: cloneAdditionalFieldDefinitions(block.additionalFieldDefinition),
        children: block.children.map((child) => ({
          block: cloneBlockTree(child.block),
          location: { ...child.location },
        })),
      }
    }

    if (block.type === 'flow-container-block') {
      return {
        ...block,
        additionalFieldDefinition: cloneAdditionalFieldDefinitions(block.additionalFieldDefinition),
        children: block.children.map((child) => ({
          block: cloneBlockTree(child.block),
          location: { ...child.location },
        })),
      }
    }

    return {
      ...block,
      additionalFieldDefinition: cloneAdditionalFieldDefinitions(block.additionalFieldDefinition),
    }
  }

  const targetDocument: CardDocument = {
    ...document,
    children: document.children.map((child) => ({
      block: cloneBlockTree(child.block),
      location: { ...child.location },
    })),
    instances: document.instances?.map((instance) => ({
      ...instance,
      data: { ...instance.data },
    })),
  }
  const parentLookup = buildParentLookup(sourceDocument)
  const issues: CardPipelineIssue[] = []
  const valueMemo = new Map<string, unknown>()
  const stateMemo = new Map<string, ResolveMemoState>()
  const owners: ReferenceOwner[] = []
  const targetOwnersById = new Map<string, ReferenceOwner>()
  const documentOwner: ReferenceOwner = {
    kind: 'document',
    key: `doc:${sourceDocument.id}`,
    id: sourceDocument.id,
    typeName: sourceDocument.type,
    source: sourceDocument as unknown as Record<string, unknown>,
    target: targetDocument as unknown as Record<string, unknown>,
    anchorBlockId: null,
  }
  owners.push(documentOwner)
  targetOwnersById.set(documentOwner.id, documentOwner)

  const sourceCurrentCard = options.currentCard
    ? {
        ...options.currentCard,
        data: Object.fromEntries(
          Object.entries(options.currentCard.data ?? {}).map(([blockId, fieldMap]) => [blockId, { ...fieldMap }]),
        ),
      } satisfies CardInstanceRecord
    : null

  const targetCurrentCard = sourceCurrentCard
    ? {
        ...sourceCurrentCard,
        data: Object.fromEntries(
          Object.entries(sourceCurrentCard.data ?? {}).map(([blockId, fieldMap]) => [blockId, { ...fieldMap }]),
        ),
      } satisfies CardInstanceRecord
    : null

  const currentCardOwner: ReferenceOwner | null = sourceCurrentCard && targetCurrentCard
    ? {
        kind: 'current-card',
        key: `card:${sourceCurrentCard.id || '__current-card__'}`,
        id: sourceCurrentCard.id || '__current-card__',
        typeName: 'card-instance',
        source: sourceCurrentCard as unknown as Record<string, unknown>,
        target: targetCurrentCard as unknown as Record<string, unknown>,
        anchorBlockId: null,
      }
    : null

  const visitChildren = (
    sourceChildren: Array<{ block: CardBlock, location: SimpleContainerLocationInfo | FlowContainerLocationInfo }>,
    targetChildren: Array<{ block: CardBlock, location: SimpleContainerLocationInfo | FlowContainerLocationInfo }>,
    parentBlockPath: string,
  ): void => {
    for (let index = 0; index < sourceChildren.length; index += 1) {
      const sourceChild = sourceChildren[index]
      const targetChild = targetChildren[index]
      if (!sourceChild || !targetChild) {
        continue
      }

      const sourceBlock = sourceChild.block
      const targetBlock = targetChild.block
      const blockPath = joinBlockPath(parentBlockPath, sourceBlock.name ?? '')

      const blockOwner: ReferenceOwner = {
        kind: 'block',
        key: `block:${sourceBlock.id}`,
        id: sourceBlock.id,
        typeName: sourceBlock.type,
        source: sourceBlock as unknown as Record<string, unknown>,
        target: targetBlock as unknown as Record<string, unknown>,
        anchorBlockId: sourceBlock.id,
        blockPath,
      }
      owners.push(blockOwner)
      targetOwnersById.set(blockOwner.id, blockOwner)

      const sourceLocation = sourceChild.location as unknown as Record<string, unknown>
      const targetLocation = targetChild.location as unknown as Record<string, unknown>
      const locationType = typeof sourceLocation.type === 'string'
        ? sourceLocation.type
        : sourceChild.location.type
      owners.push({
        kind: 'location',
        key: `layout:${sourceBlock.id}`,
        id: sourceChild.location.id,
        typeName: locationType,
        source: sourceLocation,
        target: targetLocation,
        anchorBlockId: sourceBlock.id,
        blockPath,
      })

      if (isBlockContainer(sourceBlock) && isBlockContainer(targetBlock)) {
        visitChildren(
          sourceBlock.children as Array<{ block: CardBlock, location: SimpleContainerLocationInfo | FlowContainerLocationInfo }>,
          targetBlock.children as Array<{ block: CardBlock, location: SimpleContainerLocationInfo | FlowContainerLocationInfo }>,
          blockPath,
        )
      }
    }
  }

  visitChildren(
    sourceDocument.children as Array<{ block: CardBlock, location: SimpleContainerLocationInfo | FlowContainerLocationInfo }>,
    targetDocument.children as Array<{ block: CardBlock, location: SimpleContainerLocationInfo | FlowContainerLocationInfo }>,
    '',
  )

  function buildMemoKey(owner: ReferenceOwner, fieldKey: string): string {
    return `${owner.key}:${fieldKey}`
  }

  function pushIssue(
    owner: ReferenceOwner,
    fieldKey: string,
    token: string,
    type: CardBindingIssueType,
    parameters?: Readonly<Record<string, string | number>>,
    characterOffset?: number,
  ): void {
    const ownerKind = owner.kind === 'current-card' ? 'instance' : owner.kind
    issues.push(createCardPipelineIssue({
      type,
      location: {
        documentId: sourceDocument.id,
        instanceId: options.currentCard?.id ?? null,
        owner: { kind: ownerKind, id: owner.id },
        ...(owner.anchorBlockId ? { blockId: owner.anchorBlockId } : {}),
        ...(owner.blockPath ? { blockPath: owner.blockPath } : {}),
        fieldKey,
        ...(characterOffset !== undefined ? { characterOffset } : {}),
      },
      ...(parameters ? { parameters } : {}),
      token,
    }))
  }

  function resolveTokenValue(
    owner: ReferenceOwner,
    tokenBody: string,
    fieldKey: string,
    recursionDepth: number,
    rawToken: string,
    characterOffset: number,
  ): ResolveTokenResult {
    if (recursionDepth > maxReferenceDepth) {
      pushIssue(owner, fieldKey, rawToken, 'card-designer.binding.max-depth', {
        maxDepth: maxReferenceDepth,
      }, characterOffset)
      return { ok: false, value: null }
    }

    const tokenDescriptor = parseFieldReference(tokenBody)
    if (!tokenDescriptor) {
      pushIssue(owner, fieldKey, rawToken, 'card-designer.binding.invalid-token', undefined, characterOffset)
      return { ok: false, value: null }
    }

    function resolveTargetField(targetOwner: ReferenceOwner, targetFieldKey: string): ResolveTokenResult {
      if (!exposesCardFieldReference(targetOwner.source, targetFieldKey)) {
        pushIssue(owner, fieldKey, rawToken, 'card-designer.binding.field-not-allowed', {
          ownerType: targetOwner.typeName,
          referencedFieldKey: targetFieldKey,
        }, characterOffset)
        return { ok: false, value: null }
      }
      if (!hasCardField(targetOwner.source, targetFieldKey)) {
        pushIssue(owner, fieldKey, rawToken, 'card-designer.binding.field-not-found', {
          ownerType: targetOwner.typeName,
          referencedFieldKey: targetFieldKey,
        }, characterOffset)
        return { ok: false, value: null }
      }
      if (stateMemo.get(buildMemoKey(targetOwner, targetFieldKey)) === 'resolving') {
        pushIssue(owner, fieldKey, rawToken, 'card-designer.binding.cycle', {
          referencedOwnerId: targetOwner.id,
          referencedFieldKey: targetFieldKey,
        }, characterOffset)
        return { ok: false, value: null }
      }

      const resolved = resolveOwnerField(targetOwner, targetFieldKey, recursionDepth + 1)
      return resolved.ok
        ? { ...resolved, valueKind: getCardFieldValueKind(targetOwner.source, targetFieldKey) }
        : resolved
    }

    if (tokenDescriptor.kind === 'current-card') {
      return resolveTargetField(currentCardOwner ?? documentOwner, tokenDescriptor.fieldKey)
    }

    if (tokenDescriptor.kind === 'project') {
      const project = options.project
      if (!project) {
        pushIssue(owner, fieldKey, rawToken, 'card-designer.binding.source-not-found', undefined, characterOffset)
        return { ok: false, value: null }
      }
      if (!Object.prototype.hasOwnProperty.call(project, tokenDescriptor.fieldKey)) {
        pushIssue(owner, fieldKey, rawToken, 'card-designer.binding.field-not-found', {
          ownerType: 'project',
          referencedFieldKey: tokenDescriptor.fieldKey,
        }, characterOffset)
        return { ok: false, value: null }
      }
      if (!exposesProjectFieldReference(project, tokenDescriptor.fieldKey)) {
        pushIssue(owner, fieldKey, rawToken, 'card-designer.binding.field-not-allowed', {
          ownerType: 'project',
          referencedFieldKey: tokenDescriptor.fieldKey,
        }, characterOffset)
        return { ok: false, value: null }
      }
      return {
        ok: true,
        value: project[tokenDescriptor.fieldKey],
        valueKind: getProjectFieldValueKind(project, tokenDescriptor.fieldKey),
      }
    }

    let targetReference: string | null = null
    if (owner.anchorBlockId) {
      targetReference = resolveParentFieldReferenceKey(owner.anchorBlockId, tokenBody, parentLookup)
      if (!targetReference) {
        pushIssue(owner, fieldKey, rawToken, 'card-designer.binding.source-not-found', undefined, characterOffset)
        return { ok: false, value: null }
      }
    } else if (tokenDescriptor.kind === 'document') {
      targetReference = `${documentOwner.id}:${tokenDescriptor.fieldKey}`
    } else {
      pushIssue(owner, fieldKey, rawToken, 'card-designer.binding.source-not-found', undefined, characterOffset)
      return { ok: false, value: null }
    }

    const separatorIndex = targetReference.indexOf(':')
    if (separatorIndex < 1) {
      pushIssue(owner, fieldKey, rawToken, 'card-designer.binding.invalid-token', undefined, characterOffset)
      return { ok: false, value: null }
    }

    const targetOwnerId = targetReference.slice(0, separatorIndex)
    const targetFieldKey = targetReference.slice(separatorIndex + 1)
    const targetOwner = targetOwnersById.get(targetOwnerId)
    if (!targetOwner) {
      pushIssue(owner, fieldKey, rawToken, 'card-designer.binding.source-not-found', {
        referencedOwnerId: targetOwnerId,
      }, characterOffset)
      return { ok: false, value: null }
    }

    return resolveTargetField(targetOwner, targetFieldKey)
  }

  function resolveStringField(
    owner: ReferenceOwner,
    fieldKey: string,
    sourceValue: string,
    recursionDepth: number,
  ): ResolveFieldResult {
    const targetKind = getCardFieldValueKind(owner.source, fieldKey)
    if (!sourceValue.includes('{{')) {
      return { ok: true, value: sourceValue }
    }
    if (!acceptsCardFieldBinding(owner.source, fieldKey)) {
      const characterOffset = sourceValue.indexOf('{{')
      pushIssue(owner, fieldKey, sourceValue, 'card-designer.binding.field-not-allowed', {
        ownerType: owner.typeName,
        referencedFieldKey: fieldKey,
      }, characterOffset >= 0 ? toCharacterOffset(sourceValue, characterOffset) : undefined)
      return { ok: false, value: sourceValue }
    }

    const singleTokenMatch = singleTemplateTokenPattern.exec(sourceValue)
    if (singleTokenMatch) {
      const tokenBody = singleTokenMatch[1].trim()
      const characterOffset = sourceValue.indexOf('{{')
      const tokenEnd = sourceValue.indexOf('}}', characterOffset + 2)
      const rawToken = characterOffset >= 0 && tokenEnd >= characterOffset
        ? sourceValue.slice(characterOffset, tokenEnd + 2)
        : sourceValue
      const tokenResult = resolveTokenValue(
        owner,
        tokenBody,
        fieldKey,
        recursionDepth + 1,
        rawToken,
        toCharacterOffset(sourceValue, characterOffset),
      )
      if (!tokenResult.ok) {
        return { ok: false, value: sourceValue }
      }
      if (!isBindingCompatible(targetKind, tokenResult.valueKind)
        || !valueMatchesBindingKind(tokenResult.value, tokenResult.valueKind)) {
        pushIssue(owner, fieldKey, rawToken, 'card-designer.binding.type-mismatch', {
          sourceType: tokenResult.valueKind,
          targetType: targetKind,
        }, toCharacterOffset(sourceValue, characterOffset))
        return { ok: false, value: sourceValue }
      }
      return { ok: true, value: String(tokenResult.value) }
    }

    if (targetKind !== 'string') {
      const characterOffset = sourceValue.indexOf('{{')
      pushIssue(owner, fieldKey, sourceValue, 'card-designer.binding.type-mismatch', {
        sourceType: 'interpolated-string',
        targetType: targetKind,
      }, characterOffset >= 0 ? toCharacterOffset(sourceValue, characterOffset) : undefined)
      return { ok: false, value: sourceValue }
    }

    let hasToken = false
    let resolvedValue = ''
    let cursor = 0
    templateTokenPattern.lastIndex = 0

    while (true) {
      const matched = templateTokenPattern.exec(sourceValue)
      if (!matched) {
        break
      }
      hasToken = true
      resolvedValue += sourceValue.slice(cursor, matched.index)

      const tokenBody = matched[1].trim()
      const tokenResult = resolveTokenValue(
        owner,
        tokenBody,
        fieldKey,
        recursionDepth + 1,
        matched[0],
        toCharacterOffset(sourceValue, matched.index),
      )
      if (!tokenResult.ok) {
        return { ok: false, value: sourceValue }
      }

      if (!isBindingCompatible('string', tokenResult.valueKind)
        || !valueMatchesBindingKind(tokenResult.value, tokenResult.valueKind)) {
        pushIssue(owner, fieldKey, matched[0], 'card-designer.binding.type-mismatch', {
          sourceType: tokenResult.valueKind,
          targetType: 'string',
        }, toCharacterOffset(sourceValue, matched.index))
        return { ok: false, value: sourceValue }
      }

      resolvedValue += String(tokenResult.value)
      cursor = matched.index + matched[0].length
    }

    if (!hasToken) {
      return { ok: true, value: sourceValue }
    }

    resolvedValue += sourceValue.slice(cursor)
    return { ok: true, value: resolvedValue }
  }

  function resolveOwnerField(
    owner: ReferenceOwner,
    fieldKey: string,
    recursionDepth: number,
  ): ResolveFieldResult {
    const memoKey = buildMemoKey(owner, fieldKey)
    if (valueMemo.has(memoKey)) {
      return { ok: true, value: valueMemo.get(memoKey) }
    }

    if (stateMemo.get(memoKey) === 'failed') {
      return { ok: false, value: getCardFieldValue(owner.source, fieldKey) }
    }

    if (recursionDepth > maxReferenceDepth) {
      pushIssue(
        owner,
        fieldKey,
        `${owner.id}:${fieldKey}`,
        'card-designer.binding.max-depth',
        { maxDepth: maxReferenceDepth },
      )
      stateMemo.set(memoKey, 'failed')
      return { ok: false, value: getCardFieldValue(owner.source, fieldKey) }
    }

    const sourceValue = getCardFieldValue(owner.source, fieldKey)
    if (typeof sourceValue !== 'string') {
      const stableValue = getCardFieldValue(owner.target, fieldKey)
      if (getCardFieldValueKind(owner.source, fieldKey) !== 'object') {
        pushIssue(
          owner,
          fieldKey,
          String(sourceValue),
          'card-designer.binding.type-mismatch',
          {
            sourceType: Array.isArray(sourceValue) ? 'array' : typeof sourceValue,
            targetType: getCardFieldValueKind(owner.source, fieldKey),
          },
        )
        stateMemo.set(memoKey, 'failed')
        return { ok: false, value: stableValue }
      }
      valueMemo.set(memoKey, stableValue)
      stateMemo.set(memoKey, 'done')
      return { ok: true, value: stableValue }
    }

    stateMemo.set(memoKey, 'resolving')
    const resolved = resolveStringField(owner, fieldKey, sourceValue, recursionDepth + 1)
    if (!resolved.ok) {
      stateMemo.set(memoKey, 'failed')
      return resolved
    }

    valueMemo.set(memoKey, resolved.value)
    stateMemo.set(memoKey, 'done')
    return resolved
  }

  for (const owner of owners) {
    const fieldKeys = getCardFieldKeys(owner.source)
    for (const fieldKey of fieldKeys) {
      const resolved = resolveOwnerField(owner, fieldKey, 0)
      setCardFieldValue(owner.target, fieldKey, resolved.value)
    }
  }

  return { document: targetDocument, issues }
}

function joinBlockPath(parentPath: string, blockName: string): string {
  if (!blockName) return parentPath
  return parentPath ? `${parentPath}.${blockName}` : blockName
}
