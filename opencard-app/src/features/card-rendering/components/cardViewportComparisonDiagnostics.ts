import type { CardPipelineIssue } from '../cardPipelineIssue'

export type CardViewportComparisonSide = 'before' | 'after'

export function createCardViewportComparisonDiagnostics(
  report: (issues: readonly CardPipelineIssue[]) => void,
) {
  const snapshots: Record<CardViewportComparisonSide, readonly CardPipelineIssue[]> = {
    before: [],
    after: [],
  }
  const publish = () => report([...snapshots.before, ...snapshots.after])
  return {
    replace(side: CardViewportComparisonSide, issues: readonly CardPipelineIssue[]): void {
      snapshots[side] = issues
      publish()
    },
    remove(side: CardViewportComparisonSide): void {
      snapshots[side] = []
      publish()
    },
    reset(): void {
      snapshots.before = []
      snapshots.after = []
    },
  }
}
