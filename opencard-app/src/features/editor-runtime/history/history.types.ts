/**
 * Shared history metadata contracts.
 * Owned by the history layer; consumed by every editor that emits a change.
 */

export type HistoryMergeIdentity = {
  family: string
  target: string
}

export type HistoryOperationMeta =
  | { mode: 'immediate'; label?: string; structural?: boolean }
  | { mode: 'debounced'; merge: HistoryMergeIdentity; label?: string; structural?: boolean }
