/**
 * Session-lifetime history for immutable, JSON-compatible editor documents.
 * Domain adapters own parsing/serialization and derived-state refreshes.
 */
import { computed, readonly, shallowRef, type ComputedRef, type DeepReadonly, type ShallowRef } from 'vue'
import {
  Immer,
  applyPatches,
  enableArrayMethods,
  enablePatches,
  type Draft,
  type Patch,
} from 'immer'

enablePatches()
enableArrayMethods()

const DEFAULT_MERGE_DELAY_MS = 300
const DEFAULT_BYTE_LIMIT = 32 * 1024 * 1024

const historyImmer = new Immer({
  autoFreeze: import.meta.env.DEV,
  useStrictShallowCopy: false,
})

export type HistoryMergeIdentity = {
  family: string
  target: string
}

export type HistoryOperationMeta =
  | { mode: 'immediate'; label?: string; structural?: boolean }
  | { mode: 'debounced'; merge: HistoryMergeIdentity; label?: string; structural?: boolean }

export type ContinuousHistoryMeta = {
  label?: string
  structural?: boolean
}

export type HistoryApplySource = 'change' | 'undo' | 'redo' | 'cancel' | 'reset'

export type StructuredHistoryChange<T> = {
  state: DeepReadonly<T>
  source: HistoryApplySource
  patches: readonly Patch[]
  structural: boolean
}

export type StructuredHistoryOptions<T extends object> = {
  initialState: T
  serialize: (state: DeepReadonly<T>) => string
  onContent: (content: string) => void
  onDirty: (dirty: boolean) => void
  onChange?: (change: StructuredHistoryChange<T>) => void
  entryLimit: number
  byteLimit?: number
  mergeDelayMs?: number
}

type HistoryEntry = {
  forward: Patch[]
  inverse: Patch[]
  beforeStateId: number
  afterStateId: number
  structural: boolean
  byteSize: number
  label?: string
}

type PendingDebounced = HistoryEntry & {
  merge: HistoryMergeIdentity
}

type ContinuousTransaction = HistoryEntry

export type StructuredHistoryPort<T extends object> = {
  state: Readonly<ShallowRef<DeepReadonly<T>>>
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  dirty: ComputedRef<boolean>
  transact: (meta: HistoryOperationMeta, recipe: (draft: Draft<T>) => void) => boolean
  beginContinuous: (meta?: ContinuousHistoryMeta) => void
  updateContinuous: (recipe: (draft: Draft<T>) => void) => boolean
  commitContinuous: () => boolean
  cancelContinuous: () => boolean
  flush: () => void
  undo: () => void
  redo: () => void
  markSaved: () => void
  reset: (state: T, saved?: boolean) => void
  setEntryLimit: (limit: number) => void
  dispose: () => void
}

export function createStructuredHistory<T extends object>(options: StructuredHistoryOptions<T>): StructuredHistoryPort<T> {
  const state = shallowRef<T>(options.initialState)
  const timeline = shallowRef<HistoryEntry[]>([])
  const cursor = shallowRef(0)
  const currentStateId = shallowRef(0)
  const savedStateId = shallowRef(0)
  const mergeDelayMs = options.mergeDelayMs ?? DEFAULT_MERGE_DELAY_MS
  const byteLimit = options.byteLimit ?? DEFAULT_BYTE_LIMIT
  let entryLimit = normalizeEntryLimit(options.entryLimit)
  let nextStateId = 1
  let byteSize = 0
  let pendingDebounced: PendingDebounced | null = null
  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  let continuous: ContinuousTransaction | null = null
  let disposed = false

  const canUndo = computed(() => cursor.value > 0 || pendingDebounced !== null)
  const canRedo = computed(() => cursor.value < timeline.value.length && pendingDebounced === null)
  const dirty = computed(() => currentStateId.value !== savedStateId.value)

  function notifyDirty(): void {
    options.onDirty(dirty.value)
  }

  function publish(): void {
    options.onContent(options.serialize(state.value as DeepReadonly<T>))
    notifyDirty()
  }

  function notifyChange(source: HistoryApplySource, patches: readonly Patch[], structural: boolean): void {
    options.onChange?.({
      state: state.value as DeepReadonly<T>,
      source,
      patches,
      structural,
    })
  }

  function applyRecipe(recipe: (draft: Draft<T>) => void): { forward: Patch[]; inverse: Patch[] } | null {
    const [nextState, forward, inverse] = historyImmer.produceWithPatches<T, Draft<T>>(
      state.value,
      recipe,
    )
    if (forward.length === 0) return null
    state.value = nextState as T
    return { forward, inverse }
  }

  function transact(meta: HistoryOperationMeta, recipe: (draft: Draft<T>) => void): boolean {
    assertActive()
    if (continuous) throw new Error('Cannot run a discrete history operation during a continuous transaction.')

    if (meta.mode === 'immediate') flushDebounced()
    else if (pendingDebounced && !sameMergeIdentity(pendingDebounced.merge, meta.merge)) flushDebounced()

    const beforeStateId = currentStateId.value
    const patches = applyRecipe(recipe)
    if (!patches) return false
    const afterStateId = nextStateId++
    currentStateId.value = afterStateId

    const entry = createEntry({
      ...patches,
      beforeStateId,
      afterStateId,
      structural: meta.structural === true,
      label: meta.label,
    })

    if (meta.mode === 'debounced') {
      pendingDebounced = pendingDebounced
        ? mergeEntries(pendingDebounced, entry, meta.merge)
        : { ...entry, merge: meta.merge }
      scheduleDebouncedFlush()
      notifyChange('change', patches.forward, entry.structural)
      notifyDirty()
      return true
    }

    appendEntry(entry)
    notifyChange('change', patches.forward, entry.structural)
    publish()
    return true
  }

  function beginContinuous(meta: ContinuousHistoryMeta = {}): void {
    assertActive()
    flushDebounced()
    if (continuous) throw new Error('A continuous history transaction is already active.')
    continuous = createEntry({
      forward: [],
      inverse: [],
      beforeStateId: currentStateId.value,
      afterStateId: currentStateId.value,
      structural: meta.structural === true,
      label: meta.label,
    })
  }

  function updateContinuous(recipe: (draft: Draft<T>) => void): boolean {
    assertActive()
    if (!continuous) throw new Error('No continuous history transaction is active.')
    const patches = applyRecipe(recipe)
    if (!patches) return false
    currentStateId.value = nextStateId++
    continuous = createEntry({
      ...continuous,
      forward: [...continuous.forward, ...patches.forward],
      inverse: [...patches.inverse, ...continuous.inverse],
      afterStateId: currentStateId.value,
      structural: continuous.structural,
    })
    notifyChange('change', patches.forward, continuous.structural)
    notifyDirty()
    return true
  }

  function commitContinuous(): boolean {
    assertActive()
    if (!continuous) return false
    const entry = continuous
    continuous = null
    if (entry.forward.length === 0) return false
    appendEntry(entry)
    publish()
    return true
  }

  function cancelContinuous(): boolean {
    assertActive()
    if (!continuous) return false
    const entry = continuous
    continuous = null
    if (entry.inverse.length === 0) return false
    state.value = applyPatches(state.value, entry.inverse) as T
    currentStateId.value = entry.beforeStateId
    notifyChange('cancel', entry.inverse, entry.structural)
    notifyDirty()
    return true
  }

  function undo(): void {
    assertActive()
    flush()
    if (cursor.value === 0) return
    const entry = timeline.value[cursor.value - 1]!
    state.value = applyPatches(state.value, entry.inverse) as T
    cursor.value -= 1
    currentStateId.value = entry.beforeStateId
    notifyChange('undo', entry.inverse, entry.structural)
    publish()
  }

  function redo(): void {
    assertActive()
    flush()
    const entry = timeline.value[cursor.value]
    if (!entry) return
    state.value = applyPatches(state.value, entry.forward) as T
    cursor.value += 1
    currentStateId.value = entry.afterStateId
    notifyChange('redo', entry.forward, entry.structural)
    publish()
  }

  function flush(): void {
    assertActive()
    if (continuous) commitContinuous()
    flushDebounced()
  }

  function markSaved(): void {
    assertActive()
    flush()
    savedStateId.value = currentStateId.value
    notifyDirty()
  }

  function reset(nextState: T, saved = true): void {
    assertActive()
    clearPendingTimer()
    pendingDebounced = null
    continuous = null
    timeline.value = []
    cursor.value = 0
    byteSize = 0
    const stateId = nextStateId++
    state.value = nextState
    currentStateId.value = stateId
    if (saved) savedStateId.value = stateId
    notifyChange('reset', [], true)
    notifyDirty()
  }

  function setEntryLimit(limit: number): void {
    assertActive()
    flush()
    entryLimit = normalizeEntryLimit(limit)
    trimTimeline()
  }

  function dispose(): void {
    if (disposed) return
    flush()
    disposed = true
    clearPendingTimer()
    timeline.value = []
    cursor.value = 0
    byteSize = 0
  }

  function flushDebounced(): void {
    clearPendingTimer()
    const entry = pendingDebounced
    pendingDebounced = null
    if (!entry) return
    appendEntry(entry)
    publish()
  }

  function appendEntry(entry: HistoryEntry): void {
    if (cursor.value < timeline.value.length) {
      const discarded = timeline.value.slice(cursor.value)
      byteSize -= discarded.reduce((total, item) => total + item.byteSize, 0)
      timeline.value = timeline.value.slice(0, cursor.value)
    }

    if (entry.byteSize > byteLimit) {
      timeline.value = []
      cursor.value = 0
      byteSize = 0
      return
    }

    timeline.value = [...timeline.value, entry]
    cursor.value = timeline.value.length
    byteSize += entry.byteSize
    trimTimeline()
  }

  function trimTimeline(): void {
    let removeCount = Math.max(0, timeline.value.length - entryLimit)
    let remainingBytes = byteSize
    while (removeCount < timeline.value.length && remainingBytes > byteLimit) {
      remainingBytes -= timeline.value[removeCount]!.byteSize
      removeCount += 1
    }
    if (removeCount === 0) return
    const removed = timeline.value.slice(0, removeCount)
    timeline.value = timeline.value.slice(removeCount)
    cursor.value = Math.max(0, cursor.value - removeCount)
    byteSize -= removed.reduce((total, item) => total + item.byteSize, 0)
  }

  function scheduleDebouncedFlush(): void {
    clearPendingTimer()
    pendingTimer = setTimeout(() => {
      pendingTimer = null
      flushDebounced()
    }, mergeDelayMs)
  }

  function clearPendingTimer(): void {
    if (pendingTimer === null) return
    clearTimeout(pendingTimer)
    pendingTimer = null
  }

  function assertActive(): void {
    if (disposed) throw new Error('History session has been disposed.')
  }

  return {
    state: readonly(state) as Readonly<ShallowRef<DeepReadonly<T>>>,
    canUndo,
    canRedo,
    dirty,
    transact,
    beginContinuous,
    updateContinuous,
    commitContinuous,
    cancelContinuous,
    flush,
    undo,
    redo,
    markSaved,
    reset,
    setEntryLimit,
    dispose,
  }
}

function createEntry(input: Omit<HistoryEntry, 'byteSize'>): HistoryEntry {
  const byteSize = estimatePatchBytes(input.forward, input.inverse)
  return { ...input, byteSize }
}

function mergeEntries(
  pending: PendingDebounced,
  next: HistoryEntry,
  merge: HistoryMergeIdentity,
): PendingDebounced {
  const forward = [...pending.forward, ...next.forward]
  const inverse = [...next.inverse, ...pending.inverse]
  return {
    forward,
    inverse,
    beforeStateId: pending.beforeStateId,
    afterStateId: next.afterStateId,
    structural: pending.structural || next.structural,
    byteSize: estimatePatchBytes(forward, inverse),
    label: next.label ?? pending.label,
    merge,
  }
}

function sameMergeIdentity(left: HistoryMergeIdentity, right: HistoryMergeIdentity): boolean {
  return left.family === right.family && left.target === right.target
}

function estimatePatchBytes(forward: readonly Patch[], inverse: readonly Patch[]): number {
  return JSON.stringify([forward, inverse]).length * 2
}

function normalizeEntryLimit(limit: number): number {
  return Number.isFinite(limit) ? Math.max(1, Math.round(limit)) : 100
}
