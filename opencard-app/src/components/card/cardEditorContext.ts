import type { ComputedRef, InjectionKey } from 'vue'

export interface CardEditorContext {
  selectedBlockIds: ComputedRef<Set<string>>
}

export const cardEditorContextKey: InjectionKey<CardEditorContext> = Symbol('card-editor-context')
