/**
 * Projects only the currently selected Card Designer records for PropertyEditor.
 * Data-table cells and their cache intentionally belong to a separate lifecycle.
 */
import { computed, type Ref } from 'vue'
import {
  getCardFieldDefinition,
  getCardFieldKeys,
  getCardFieldValueKind,
  type CardBlock,
  type CardDocument,
  type CardFaceKey,
} from '../../entities/card/model'
import type { ParentLookup } from '../../entities/card/tree'
import type { FilePathDirectoryProvider } from '../../shared/model/filePath'
import type { PropertyEditorInput } from '../../shared/ui/property-editor/propertyEditor.types'
import type {
  ProjectFontRegistry,
  ProjectInformation,
} from '../workspace/model/projectMetadata'
import { buildFontCatalog } from '../workspace/model/projectFonts'
import type {
  ReferenceCompletionContext,
  ReferenceCompletionScope,
} from '../editor-runtime/services/referenceCompletion'
import type { CdePropertyEditorInput } from './cdePropertyFieldDefinitions'
import {
  createCdeCardReferenceScope,
  createCdeDictionaryReferenceScope,
  createCdeProjectReferenceScope,
  enrichCdePropertyFieldDefinition,
} from './cdePropertyFieldEnrichment'

export type CdePropertyProjectContext = {
  fonts?: ProjectFontRegistry | null
  information?: ProjectInformation | null
  dictionary?: Readonly<Record<string, string>> | null
}

type UseCdePropertyEditorProjectionOptions = {
  cardDoc: Readonly<Ref<CardDocument | null>>
  documentRevision: Readonly<Ref<number>>
  activeFaceKey: Readonly<Ref<CardFaceKey>>
  selectedCardId: Readonly<Ref<string | null>>
  selectedBlock: Readonly<Ref<CardBlock | null>>
  parentLookup: Readonly<Ref<ParentLookup>>
  rawPropertyInputs: Readonly<Ref<readonly CdePropertyEditorInput[]>>
  projectContext: Readonly<Ref<CdePropertyProjectContext>>
  directoryProvider: Readonly<Ref<FilePathDirectoryProvider | undefined>>
  blueprintCardId: string
  translate: (messageKey: string, parameters?: Record<string, unknown>) => string
  hasMessage: (messageKey: string) => boolean
}

export function useCdePropertyEditorProjection(options: UseCdePropertyEditorProjectionOptions) {
  const propertyEditorInputs = computed<readonly PropertyEditorInput[]>(() => {
    options.documentRevision.value
    const document = options.cardDoc.value
    if (!document) return []

    const projectContext = options.projectContext.value
    const fontCatalog = buildFontCatalog(projectContext.fonts)
    const selectedCard = !options.selectedCardId.value
      || options.selectedCardId.value === options.blueprintCardId
      ? null
      : document.instances?.find(instance => instance.id === options.selectedCardId.value) ?? null
    const currentCard = selectedCard ?? document
    const currentFace = document.faces[options.activeFaceKey.value]
    const oppositeFace = document.faces[options.activeFaceKey.value === 'front' ? 'back' : 'front']
    const selectedBlock = options.selectedBlock.value
    const currentCardScope = cardScope(
      options.selectedCardId.value === options.blueprintCardId
        ? options.translate('propertyEditor.references.currentCardBlueprint')
        : options.translate('propertyEditor.references.currentCard'),
      currentCard as unknown as Readonly<Record<string, unknown>>,
      options,
    )
    const documentScope = cardScope(
      options.translate('propertyEditor.references.document'),
      document as unknown as Readonly<Record<string, unknown>>,
      options,
    )
    const currentFaceScope = cardScope(
      options.translate('propertyEditor.references.currentFace'),
      currentFace as unknown as Readonly<Record<string, unknown>>,
      options,
    )
    const oppositeFaceScope = cardScope(
      options.translate('propertyEditor.references.oppositeFace'),
      oppositeFace as unknown as Readonly<Record<string, unknown>>,
      options,
    )
    const currentBlockScope = selectedBlock
      ? cardScope(
          options.translate('propertyEditor.references.self'),
          selectedBlock as unknown as Readonly<Record<string, unknown>>,
          options,
        )
      : undefined
    const projectScope = projectContext.information
      ? createCdeProjectReferenceScope({
          label: options.translate('propertyEditor.references.project'),
          project: projectContext.information,
          translate: options.translate,
          hasMessage: options.hasMessage,
        })
      : undefined
    const dictionaryScope = projectContext.dictionary
      ? createCdeDictionaryReferenceScope(
          options.translate('propertyEditor.references.dictionary'),
          projectContext.dictionary,
        )
      : undefined
    const ancestorScopes = selectedBlock
      ? createAncestorScopes(selectedBlock.id, options)
      : []

    return options.rawPropertyInputs.value.map(input => ({
      ...input,
      fields: Object.fromEntries(Object.entries(input.fields).map(([fieldKey, definition]) => {
        const hasFaceContext = Boolean(selectedBlock) || input.key === currentFace.id
        const referenceContext: ReferenceCompletionContext | undefined = getCardFieldKeys(input.record)
          .includes(fieldKey) ? {
          currentBlock: currentBlockScope,
          currentCard: currentCardScope,
          currentFace: hasFaceContext ? currentFaceScope : undefined,
          oppositeFace: hasFaceContext ? oppositeFaceScope : undefined,
          document: documentScope,
          project: projectScope,
          dictionary: dictionaryScope,
          allowedScopes: getCardFieldDefinition(input.record, fieldKey)?.bindingScopes,
          getAncestor: depth => ancestorScopes[depth - 1],
          targetKind: getCardFieldValueKind(input.record, fieldKey),
        } : undefined
        return [fieldKey, enrichCdePropertyFieldDefinition({
          definition,
          fieldKey,
          record: input.record,
          referenceContext,
          fontCatalog,
          directoryProvider: options.directoryProvider.value,
        })]
      })),
    }))
  })

  return { propertyEditorInputs }
}

function createAncestorScopes(
  blockId: string,
  options: UseCdePropertyEditorProjectionOptions,
): ReferenceCompletionScope[] {
  const scopes: ReferenceCompletionScope[] = []
  let currentBlockId = blockId
  let depth = 1
  while (true) {
    const parent = options.parentLookup.value.get(currentBlockId)
    if (!parent || parent.type === 'card-face') break
    scopes.push(cardScope(
      depth === 1
        ? options.translate('propertyEditor.references.parent')
        : options.translate('propertyEditor.references.ancestor', { depth }),
      parent as unknown as Readonly<Record<string, unknown>>,
      options,
    ))
    currentBlockId = parent.id
    depth += 1
  }
  return scopes
}

function cardScope(
  label: string,
  record: Readonly<Record<string, unknown>>,
  options: Pick<UseCdePropertyEditorProjectionOptions, 'translate' | 'hasMessage'>,
): ReferenceCompletionScope {
  return createCdeCardReferenceScope({
    label,
    record,
    translate: options.translate,
    hasMessage: options.hasMessage,
  })
}
