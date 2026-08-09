import { inject, type ComputedRef, type InjectionKey } from 'vue'
import type { ProjectIconCatalog } from '../../workspace/services/projectIconCatalog'
import type { ProjectFontResolutionContext } from '../../workspace/model/projectFonts'

export interface CardEditorContext {
  transformDisabledBlockIds: ComputedRef<Set<string>>
  handleBlockClick: (blockId: string, event: MouseEvent) => void
  resolveAssetSrc: (path: string) => string
  projectIconCatalog?: ComputedRef<ProjectIconCatalog>
  fontContext?: ProjectFontResolutionContext
}

export const cardEditorContextKey: InjectionKey<CardEditorContext> = Symbol('card-editor-context')

export function useCardEditorContext(): CardEditorContext {
  const context = inject(cardEditorContextKey)
  if (!context) throw new Error('Card renderer context is required')
  return context
}
