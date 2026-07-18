import type { ComputedRef, InjectionKey } from 'vue'

export interface CardEditorContext {
  transformDisabledBlockIds: ComputedRef<Set<string>>
  handleBlockClick?: (blockId: string, event: MouseEvent) => void
}

export const cardEditorContextKey: InjectionKey<CardEditorContext> = Symbol('card-editor-context')
