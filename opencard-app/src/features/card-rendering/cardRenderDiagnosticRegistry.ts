import { computed, shallowRef, type ComputedRef } from 'vue'
import type { CardPipelineIssue } from './cardPipelineIssue'

export type CardRenderDiagnosticRegistry = {
  issues: ComputedRef<readonly CardPipelineIssue[]>
  replace(ownerId: string, issues: readonly CardPipelineIssue[]): void
  remove(ownerId: string): void
  snapshot(): readonly CardPipelineIssue[]
}

export function createCardRenderDiagnosticRegistry(): CardRenderDiagnosticRegistry {
  const entries = shallowRef(new Map<string, readonly CardPipelineIssue[]>())
  const issues = computed(() => [...entries.value.values()].flat())
  return {
    issues,
    replace(ownerId, nextIssues) {
      const currentIssues = entries.value.get(ownerId) ?? []
      if (
        currentIssues.length === nextIssues.length
        && currentIssues.every((issue, index) => issue.id === nextIssues[index]?.id)
      ) return

      const next = new Map(entries.value)
      if (nextIssues.length > 0) next.set(ownerId, [...nextIssues])
      else next.delete(ownerId)
      entries.value = next
    },
    remove(ownerId) {
      if (!entries.value.has(ownerId)) return
      const next = new Map(entries.value)
      next.delete(ownerId)
      entries.value = next
    },
    snapshot: () => [...issues.value],
  }
}
