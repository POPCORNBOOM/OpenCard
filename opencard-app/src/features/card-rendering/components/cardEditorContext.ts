import { inject, type ComputedRef, type InjectionKey } from 'vue'
import type { ProjectIconCatalog, ProjectIconCatalogEntry } from '../../workspace/services/projectIconCatalog'
import type { CustomBlockRuntimeCatalog } from '../expandCustomBlocks'
import type { PreparedRichTextCatalog } from '../prepareRichText'
import type { CardVisualReadinessRegistrar } from './cardRenderReadiness'

export interface CardEditorContext {
  transformDisabledBlockIds: ComputedRef<Set<string>>
  handleBlockClick: (blockId: string, event: MouseEvent) => void
  resolveAssetSrc: (path: string, blockId?: string, fieldKey?: string) => string
  resolveFontFamily: (value: string, blockId?: string, fieldKey?: string) => string
  resolveIconReference: (source: string, blockId?: string, fieldKey?: string) => ProjectIconCatalogEntry | null
  projectIconCatalog?: ComputedRef<ProjectIconCatalog>
  customBlockCatalog?: ComputedRef<CustomBlockRuntimeCatalog>
  richText?: ComputedRef<PreparedRichTextCatalog>
  visualReadiness?: CardVisualReadinessRegistrar
}

export const cardEditorContextKey: InjectionKey<CardEditorContext> = Symbol('card-editor-context')

export function useCardEditorContext(): CardEditorContext {
  const context = inject(cardEditorContextKey)
  if (!context) throw new Error('Card renderer context is required')
  return context
}
