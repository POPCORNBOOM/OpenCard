<!-- Standard tree/list view: consumes key-only UI data and emits user intents. -->
<template>
  <div
    ref="treeRootElement"
    class="oc-tree"
    :class="{
      'is-fill': props.fill,
      'is-dragging': draggedKey,
      'is-root-drop': draggedKey && dropTargetKey === null && dropPosition === 'inside',
      'are-actions-always-visible': props.actionVisibility === 'always',
    }"
    :role="props.role"
    :aria-multiselectable="props.selectionMode === 'multiple' ? 'true' : undefined"
    @scroll.passive="handleTreeScroll"
  >
    <div class="oc-tree__content" :class="{ 'is-virtualized': props.virtualized }"
      :style="virtualContentStyle">
    <div
      v-for="entry in renderedEntries"
      :key="entry.key"
      class="oc-tree__node"
      :class="resolveNodeClass(entry.key)"
      :data-oc-tree-key="entry.key"
      :style="resolveNodeStyle(entry)"
    >
      <span
        v-if="entry.guideRows > 0"
        class="oc-tree__branch-guide"
        :data-guide-rows="entry.guideRows"
        :style="{ '--oc-tree-guide-rows': String(entry.guideRows) }"
        aria-hidden="true"
      />
      <span
        v-if="entry.parentKey !== null"
        class="oc-tree__branch-connector"
        aria-hidden="true"
      />
      <div
        :ref="(element) => setRowRef(entry.key, element)"
        class="oc-tree__row"
        :class="{ 'is-disabled': entry.item.disabled }"
        :data-actions-overflowed="collapsedActionKeys.has(entry.key) || undefined"
        :data-tooltip="entry.item.disabledReason"
        :role="rowRole"
        :tabindex="props.tabNavigation === 'roving' && activeKey === entry.key && !entry.item.disabled ? 0 : -1"
        :aria-disabled="entry.item.disabled || undefined"
        :aria-selected="props.role !== 'menu' && props.selectionMode !== 'none' ? isSelected(entry.key) : undefined"
        :aria-expanded="isExpandable(entry.key) ? isExpanded(entry.key) : undefined"
        :aria-posinset="props.virtualized ? entry.index + 1 : undefined"
        :aria-setsize="props.virtualized ? visibleEntries.length : undefined"
        @focus="activeKey = entry.key"
        @click="handleRowClick($event, entry.key)"
        @auxclick="handleRowAuxClick($event, entry.key)"
        @dblclick="handleRowDoubleClick($event, entry.key)"
        @mousedown="handleRowMouseDown($event, entry.key)"
        @keydown="handleRowKeydown($event, entry.key, entry.index)"
        @contextmenu="handleRowContextMenu($event, entry.key)"
      >
        <span
          class="oc-tree__icon-slot"
          :class="{ 'is-expandable': isExpandable(entry.key) }"
          data-tree-interactive="true"
          @mousedown="handleIconMouseDown($event, entry.key)"
          @click="handleIconClick($event, entry.key)"
        >
          <span v-for="action in entry.item.displayActions?.leading ?? []" :key="`leading:${action.key}`"
            class="oc-tree__display-action" :data-tooltip="action.tooltip" aria-hidden="true">
            <OcIcon :name="action.icon" :tone="action.tone" size="sm" />
          </span>
          <span v-if="entry.item.thumbnailStyle" class="oc-tree__thumbnail"
            :class="{ 'oc-project-icon': entry.item.thumbnailStyle['--oc-project-icon-renderer'] === 'atlas-crop' }"
            :style="entry.item.thumbnailStyle" role="img"
            :aria-label="entry.item.thumbnailLabel ?? entry.item.label" />
          <OcIcon v-else
            :name="entry.item.icon ?? 'tree.chevron-right'"
            :tone="entry.item.iconTone"
            size="md"
            class="oc-tree__node-icon"
            :class="{ 'is-expanded': isExpandable(entry.key) && isExpanded(entry.key) }"
          />
          <span
            v-if="isExpandable(entry.key)"
            class="oc-tree__child-count oc-number-badge oc-number-badge--neutral"
            :class="{ 'is-expanded': isExpanded(entry.key) }"
            aria-hidden="true"
          >
            {{ formatChildCount(entry.key) }}
          </span>
        </span>

        <OcFieldInput
          v-if="renamingKey === entry.key"
          :ref="(element) => setRenameInputRef(entry.key, element)"
          as="input"
          class="oc-tree__rename-input"
          type="text"
          :value="renameDraft"
          data-tree-interactive="true"
          @mousedown.stop
          @click.stop
          @dblclick.stop
          @input="handleRenameInput"
          @keydown.stop="handleRenameKeydown($event, entry.key)"
          @blur="commitRename(entry.key)"
        />
        <OcText v-else class="oc-tree__label" :truncate="true">
          {{ entry.item.label }}
        </OcText>

        <span class="oc-tree__controls" data-tree-interactive="true">
          <OcActionButton
            v-for="action in resolveItemActions(entry.key)"
            :key="action.key"
            :action="action"
            size="sm"
            variant="ghost"
            :button-tabindex="props.tabNavigation === 'none' ? -1 : undefined"
            @mousedown.stop
            @select="emitActionIntent(entry.key, $event.key)"
          />
        </span>
        <span v-for="action in entry.item.displayActions?.trailing ?? []" :key="`trailing:${action.key}`"
          class="oc-tree__display-action" :data-tooltip="action.tooltip" aria-hidden="true">
          <OcIcon :name="action.icon" :tone="action.tone" size="sm" />
        </span>

        <OcText v-if="entry.item.tail" class="oc-tree__tail" tone="muted" size="xs" :truncate="true">
          {{ entry.item.tail }}
        </OcText>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect,
  type ComponentPublicInstance, type CSSProperties } from 'vue'
import type { OcActionButtonAction } from './OcActionButton.vue'
import OcActionButton from './OcActionButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import { useFloatingMenu } from '../../composables/useFloatingMenu'
import type {
  OcTreeActionDefinition,
  OcTreeData,
  OcTreeDropPosition,
  OcTreeIntent,
  OcTreeKey,
  OcTreeSelectionInput,
} from '../../shared/ui/tree/tree.types'
import { resolveOcPixelToken } from '../../shared/ui/foundation'

type OcTreeSelectionMode = 'none' | 'single' | 'multiple'
type OcTreeActivationMode = 'none' | 'single-click' | 'double-click'
type OcTreeRole = 'tree' | 'listbox' | 'menu'

interface OcTreeProps {
  data: OcTreeData
  actions?: ReadonlyMap<string, OcTreeActionDefinition>
  selectedKeys?: readonly OcTreeKey[]
  expandedKeys?: readonly OcTreeKey[]
  selectionMode?: OcTreeSelectionMode
  activationMode?: OcTreeActivationMode
  role?: OcTreeRole
  fill?: boolean
  selectionExpansionMode?: 'none' | 'expand' | 'expand-exclusive'
  scrollToSelection?: boolean
  virtualized?: boolean
  actionOverflowTitle?: string
  actionVisibility?: 'on-interaction' | 'always'
  tabNavigation?: 'roving' | 'none'
}

type VisibleEntry = {
  key: OcTreeKey
  item: OcTreeData['items'] extends ReadonlyMap<string, infer Item> ? Item : never
  level: number
  parentKey: OcTreeKey | null
  guideRows: number
  index: number
}

defineOptions({ name: 'OcTree' })

const props = withDefaults(defineProps<OcTreeProps>(), {
  actions: () => new Map(),
  selectedKeys: () => [],
  expandedKeys: () => [],
  selectionMode: 'single',
  activationMode: 'none',
  role: 'tree',
  fill: false,
  selectionExpansionMode: 'none',
  scrollToSelection: false,
  virtualized: false,
  actionOverflowTitle: 'More actions',
  actionVisibility: 'on-interaction',
  tabNavigation: 'roving',
})

const emit = defineEmits<{
  intent: [intent: OcTreeIntent]
}>()
const { openContextMenu } = useFloatingMenu()

const treeRootElement = ref<HTMLElement | null>(null)
const rowRefs = new Map<OcTreeKey, HTMLElement>()
const renameInputRefs = new Map<OcTreeKey, InstanceType<typeof OcFieldInput>>()
const activeKey = ref<OcTreeKey | null>(null)
const renamingKey = ref<OcTreeKey | null>(null)
const renameDraft = ref('')
const selectionAnchorKey = ref<OcTreeKey | null>(null)
const pendingDrag = ref<{ key: OcTreeKey; startX: number; startY: number } | null>(null)
const draggedKey = ref<OcTreeKey | null>(null)
const dropTargetKey = ref<OcTreeKey | null>(null)
const dropPosition = ref<OcTreeDropPosition | null>(null)
const suppressClick = ref(false)
const warnedMessages = new Set<string>()
const virtualScrollTop = ref(0)
const virtualViewportHeight = ref(0)
const virtualRowHeight = ref(1)
const collapsedActionKeys = ref<ReadonlySet<OcTreeKey>>(new Set())
const directActionWidths = new Map<OcTreeKey, number>()
const VIRTUAL_OVERSCAN_ROWS = 6
let treeResizeObserver: ResizeObserver | null = null

const selectedKeySet = computed(() => new Set(props.selectedKeys))
const expandedKeySet = computed(() => new Set(props.expandedKeys))
const parentKeyLookup = computed(() => {
  const lookup = new Map<OcTreeKey, OcTreeKey>()
  for (const [parentKey, childKeys] of props.data.children) {
    for (const childKey of childKeys) lookup.set(childKey, parentKey)
  }
  return lookup
})
const rowRole = computed(() => {
  if (props.role === 'menu') return 'menuitem'
  if (props.role === 'listbox') return 'option'
  return 'treeitem'
})

function warnContract(message: string): void {
  if (!import.meta.env.DEV || warnedMessages.has(message)) return
  warnedMessages.add(message)
  console.warn(`[OcTree] ${message}`)
}

function validateContract(): void {
  const referenceCounts = new Map<OcTreeKey, number>()
  const countReference = (key: OcTreeKey) => {
    referenceCounts.set(key, (referenceCounts.get(key) ?? 0) + 1)
  }

  for (const rootKey of props.data.rootKeys) countReference(rootKey)
  for (const [parentKey, childKeys] of props.data.children) {
    if (!props.data.items.has(parentKey)) warnContract(`Children are declared for missing parent "${parentKey}".`)
    for (const childKey of childKeys) countReference(childKey)
  }
  for (const [key, count] of referenceCounts) {
    if (!props.data.items.has(key)) warnContract(`Missing item for key "${key}".`)
    if (count > 1) warnContract(`Node "${key}" is referenced more than once.`)
  }

  const visited = new Set<OcTreeKey>()
  const visiting = new Set<OcTreeKey>()
  function visitNode(key: OcTreeKey): void {
    if (visiting.has(key)) {
      warnContract(`Children cycle detected at key "${key}".`)
      return
    }
    if (visited.has(key)) return
    visiting.add(key)
    for (const childKey of props.data.children.get(key) ?? []) visitNode(childKey)
    visiting.delete(key)
    visited.add(key)
  }
  for (const key of props.data.items.keys()) visitNode(key)

  function visitAction(actionKey: string, ancestors: Set<string>): void {
    const definition = props.actions.get(actionKey)
    if (!definition) {
      warnContract(`Missing action definition for key "${actionKey}".`)
      return
    }
    if (ancestors.has(actionKey)) {
      warnContract(`Action children cycle detected at key "${actionKey}".`)
      return
    }
    const nextAncestors = new Set(ancestors)
    nextAncestors.add(actionKey)
    for (const childKey of definition.children ?? []) visitAction(childKey, nextAncestors)
  }
  for (const item of props.data.items.values()) {
    for (const actionKey of item.actions ?? []) visitAction(actionKey, new Set())
    for (const actionKey of item.contextActions ?? []) visitAction(actionKey, new Set())
  }
}

watchEffect(validateContract)

const visibleEntries = computed<VisibleEntry[]>(() => {
  const entries: VisibleEntry[] = []
  const visited = new Set<OcTreeKey>()

  function visit(key: OcTreeKey, level: number, parentKey: OcTreeKey | null, ancestors: Set<OcTreeKey>): void {
    const item = props.data.items.get(key)
    if (!item) {
      warnContract(`Missing item for key "${key}".`)
      return
    }
    if (ancestors.has(key)) {
      warnContract(`Children cycle detected at key "${key}".`)
      return
    }
    if (visited.has(key)) {
      warnContract(`Node "${key}" is referenced more than once.`)
      return
    }

    visited.add(key)
    entries.push({ key, item, level, parentKey, guideRows: 0, index: entries.length })
    if (!isExpanded(key)) return

    const nextAncestors = new Set(ancestors)
    nextAncestors.add(key)
    for (const childKey of props.data.children.get(key) ?? []) {
      visit(childKey, level + 1, key, nextAncestors)
    }
  }

  for (const rootKey of props.data.rootKeys) {
    visit(rootKey, 0, null, new Set())
  }

  const entryIndexes = new Map(entries.map((entry, index) => [entry.key, index]))
  for (const [index, entry] of entries.entries()) {
    if (!isExpanded(entry.key)) continue
    const childKeys = props.data.children.get(entry.key) ?? []
    const lastChildIndex = entryIndexes.get(childKeys[childKeys.length - 1] ?? '')
    if (lastChildIndex !== undefined) entry.guideRows = lastChildIndex - index
  }

  return entries
})

const virtualRange = computed(() => {
  if (!props.virtualized) return { start: 0, end: visibleEntries.value.length }
  const rowHeight = virtualRowHeight.value
  const start = Math.max(0, Math.floor(virtualScrollTop.value / rowHeight) - VIRTUAL_OVERSCAN_ROWS)
  const visibleRows = Math.ceil(virtualViewportHeight.value / rowHeight)
  return {
    start,
    end: Math.min(visibleEntries.value.length, start + visibleRows + VIRTUAL_OVERSCAN_ROWS * 2),
  }
})
const renderedEntries = computed(() => visibleEntries.value.slice(
  virtualRange.value.start,
  virtualRange.value.end,
))
const virtualContentStyle = computed<CSSProperties | undefined>(() => props.virtualized
  ? { height: `${visibleEntries.value.length * virtualRowHeight.value}px` }
  : undefined)

function resolveNodeStyle(entry: VisibleEntry): CSSProperties {
  return {
    '--oc-tree-indent': `${entry.level * 12}px`,
    ...(props.virtualized ? { transform: `translateY(${entry.index * virtualRowHeight.value}px)` } : {}),
  } as CSSProperties
}

function handleTreeScroll(event: Event): void {
  if (!props.virtualized || !(event.currentTarget instanceof HTMLElement)) return
  virtualScrollTop.value = event.currentTarget.scrollTop
}

function syncVirtualMetrics(): void {
  const root = treeRootElement.value
  if (!props.virtualized || !root) return
  virtualRowHeight.value = Math.max(1, resolveOcPixelToken('--oc-size-md', root))
  virtualViewportHeight.value = root.clientHeight
  virtualScrollTop.value = root.scrollTop
}

function syncActionOverflow(): void {
  const nextCollapsed = new Set(collapsedActionKeys.value)
  const minimumLabelWidth = resolveOcPixelToken('--oc-tree-action-label-min-width', treeRootElement.value)

  for (const [key, row] of rowRefs) {
    const actionCount = props.data.items.get(key)?.actions?.length ?? 0
    if (actionCount <= 1 || row.clientWidth <= 0) {
      nextCollapsed.delete(key)
      directActionWidths.delete(key)
      continue
    }
    const label = row.querySelector<HTMLElement>('.oc-tree__label')
    const controls = row.querySelector<HTMLElement>('.oc-tree__controls')
    if (!label || !controls) continue
    const labelWidth = label.getBoundingClientRect().width
    const controlsWidth = controls.getBoundingClientRect().width

    if (!nextCollapsed.has(key)) {
      directActionWidths.set(key, controlsWidth)
      if (labelWidth < minimumLabelWidth) nextCollapsed.add(key)
      continue
    }

    const directWidth = directActionWidths.get(key)
    if (directWidth === undefined) continue
    const projectedLabelWidth = labelWidth - Math.max(0, directWidth - controlsWidth)
    if (projectedLabelWidth >= minimumLabelWidth) nextCollapsed.delete(key)
  }

  const current = collapsedActionKeys.value
  if (nextCollapsed.size === current.size && [...nextCollapsed].every(key => current.has(key))) return
  collapsedActionKeys.value = nextCollapsed
}

function syncTreeMetrics(): void {
  syncVirtualMetrics()
  syncActionOverflow()
}

function resolveSelectionAncestorKeys(key: OcTreeKey): OcTreeKey[] {
  const ancestors: OcTreeKey[] = []
  const visited = new Set<OcTreeKey>([key])
  let currentKey = key

  while (true) {
    const parentKey = parentKeyLookup.value.get(currentKey)
    if (!parentKey || visited.has(parentKey)) return ancestors
    ancestors.push(parentKey)
    visited.add(parentKey)
    currentKey = parentKey
  }
}

function isSameOrDescendantKey(key: OcTreeKey, ancestorKey: OcTreeKey): boolean {
  const visited = new Set<OcTreeKey>()
  let currentKey: OcTreeKey | undefined = key

  while (currentKey && !visited.has(currentKey)) {
    if (currentKey === ancestorKey) return true
    visited.add(currentKey)
    currentKey = parentKeyLookup.value.get(currentKey)
  }

  return false
}

watch(
  [
    () => props.selectedKeys,
    () => props.selectionExpansionMode,
    parentKeyLookup,
  ],
  ([selectedKeys, mode]) => {
    if (selectedKeys.length === 0 || mode === 'none') return

    const ancestorKeys = selectedKeys.flatMap(resolveSelectionAncestorKeys)
    const nextKeys = mode === 'expand-exclusive'
      ? [...new Set([
          ...ancestorKeys,
          ...props.expandedKeys.filter((key) => selectedKeys.some(selectedKey => (
            isSameOrDescendantKey(key, selectedKey)
          ))),
        ])]
      : [...new Set([...props.expandedKeys, ...ancestorKeys])]

    if (
      nextKeys.length === props.expandedKeys.length
      && nextKeys.every((key, index) => key === props.expandedKeys[index])
    ) {
      return
    }

    emit('intent', {
      type: 'expansion.sync',
      expandedKeys: nextKeys,
      reason: 'selection',
    })
  },
  { immediate: true },
)

const selectionRevealKey = computed(() => {
  if (activeKey.value && selectedKeySet.value.has(activeKey.value)) return activeKey.value
  return props.selectedKeys[props.selectedKeys.length - 1] ?? null
})

function scrollRowIntoTreeViewport(key: OcTreeKey): void {
  const root = treeRootElement.value
  if (!root) return
  if (props.virtualized) {
    const index = visibleEntries.value.findIndex(entry => entry.key === key)
    if (index < 0) return
    const rowTop = index * virtualRowHeight.value
    const rowBottom = rowTop + virtualRowHeight.value
    if (rowTop < root.scrollTop) root.scrollTop = rowTop
    else if (rowBottom > root.scrollTop + root.clientHeight) root.scrollTop = rowBottom - root.clientHeight
    virtualScrollTop.value = root.scrollTop
    return
  }

  const row = rowRefs.get(key)
  if (!row) return

  const rootRect = root.getBoundingClientRect()
  const rowRect = row.getBoundingClientRect()
  if (rowRect.top < rootRect.top) {
    root.scrollTop -= rootRect.top - rowRect.top
  } else if (rowRect.bottom > rootRect.bottom) {
    root.scrollTop += rowRect.bottom - rootRect.bottom
  }
}

watch(
  [selectionRevealKey, () => props.scrollToSelection, visibleEntries],
  async ([selectedKey]) => {
    if (!props.scrollToSelection || !selectedKey) return
    await nextTick()
    scrollRowIntoTreeViewport(selectedKey)
  },
  { flush: 'post', immediate: true },
)
watch(
  visibleEntries,
  async (entries) => {
    if (renamingKey.value && !props.data.items.has(renamingKey.value)) cancelRename()
    if (activeKey.value && entries.some((entry) => entry.key === activeKey.value)) return
    activeKey.value = entries.find((entry) => !entry.item.disabled)?.key ?? null
    await nextTick()
  },
  { immediate: true },
)
watch(renderedEntries, entries => {
  if (!props.virtualized || entries.some(entry => entry.key === activeKey.value)) return
  const selectedKey = selectionRevealKey.value
  activeKey.value = entries.find(entry => entry.key === selectedKey && !entry.item.disabled)?.key
    ?? entries.find(entry => !entry.item.disabled)?.key
    ?? null
})

function isSelected(key: OcTreeKey): boolean {
  return selectedKeySet.value.has(key)
}

function isExpandable(key: OcTreeKey): boolean {
  return (props.data.children.get(key)?.length ?? 0) > 0
}

function formatChildCount(key: OcTreeKey): string {
  const count = props.data.children.get(key)?.length ?? 0
  return count > 99 ? '99+' : String(count)
}

function isExpanded(key: OcTreeKey): boolean {
  return expandedKeySet.value.has(key)
}

function toggleExpanded(key: OcTreeKey): void {
  if (!isExpandable(key)) return
  emit('intent', { type: 'expansion.change', key, expanded: !isExpanded(key) })
}

function handleIconMouseDown(event: MouseEvent, key: OcTreeKey): void {
  if (isExpandable(key)) event.stopPropagation()
}

function handleIconClick(event: MouseEvent, key: OcTreeKey): void {
  if (!isExpandable(key)) return
  event.stopPropagation()
  focusRowFromPointer(key)
  toggleExpanded(key)
}

function emitSelectionIntent(
  key: OcTreeKey,
  toggle: boolean,
  input: OcTreeSelectionInput,
  range: boolean,
): void {
  if (props.selectionMode === 'none') return
  const canRangeSelect = props.selectionMode === 'multiple' && range
  const mode = canRangeSelect
    ? 'range'
    : props.selectionMode === 'multiple' && toggle ? 'toggle' : 'replace'
  let selectedKeys: OcTreeKey[]
  if (mode === 'range') {
    const anchorKey = selectionAnchorKey.value && visibleEntries.value.some(entry => entry.key === selectionAnchorKey.value)
      ? selectionAnchorKey.value
      : props.selectedKeys[0] ?? key
    const anchorIndex = visibleEntries.value.findIndex(entry => entry.key === anchorKey)
    const targetIndex = visibleEntries.value.findIndex(entry => entry.key === key)
    const rangeKeys = anchorIndex < 0 || targetIndex < 0
      ? [key]
      : visibleEntries.value
        .slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1)
        .map(entry => entry.key)
    const selectedSet = new Set(toggle ? [...props.selectedKeys, ...rangeKeys] : rangeKeys)
    selectedKeys = visibleEntries.value
      .filter(entry => selectedSet.has(entry.key))
      .map(entry => entry.key)
  } else if (mode === 'toggle') {
    selectedKeys = [...props.selectedKeys]
    const index = selectedKeys.indexOf(key)
    if (index >= 0) selectedKeys.splice(index, 1)
    else selectedKeys.push(key)
  } else {
    selectedKeys = [key]
  }
  if (input !== 'right' && mode !== 'range') selectionAnchorKey.value = key
  emit('intent', { type: 'selection.change', triggerKey: key, selectedKeys, mode, input })
}

function handleRowClick(event: MouseEvent, key: OcTreeKey): void {
  if (props.data.items.get(key)?.disabled || suppressClick.value || renamingKey.value === key) return
  focusRowFromPointer(key)
  emitSelectionIntent(key, event.ctrlKey || event.metaKey, 'left', event.shiftKey)
  if (props.activationMode === 'single-click') emit('intent', { type: 'node.activate', key })
}

function focusRowFromPointer(key: OcTreeKey): void {
  activeKey.value = key
  rowRefs.get(key)?.focus({ preventScroll: true })
}

function handleRowAuxClick(event: MouseEvent, key: OcTreeKey): void {
  if (event.button !== 1 || props.data.items.get(key)?.disabled) return
  event.preventDefault()
  emitSelectionIntent(key, event.ctrlKey || event.metaKey, 'middle', event.shiftKey)
}

function handleRowDoubleClick(event: MouseEvent, key: OcTreeKey): void {
  if (props.data.items.get(key)?.disabled) return
  event.preventDefault()
  if (props.activationMode === 'double-click') emit('intent', { type: 'node.activate', key })
}

function resolveAction(
  itemKey: OcTreeKey,
  actionKey: string,
  ancestors: Set<string>,
): OcActionButtonAction | null {
  const definition = props.actions.get(actionKey)
  if (!definition) {
    warnContract(`Missing action definition for key "${actionKey}".`)
    return null
  }
  if (ancestors.has(actionKey)) {
    warnContract(`Action children cycle detected at key "${actionKey}".`)
    return null
  }

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(actionKey)
  const disabledReason = props.data.items.get(itemKey)?.disabledActions?.get(actionKey)
  const children = definition.children
    ?.map((childKey) => resolveAction(itemKey, childKey, nextAncestors))
    .filter((child): child is OcActionButtonAction => child !== null)

  return {
    key: actionKey,
    icon: definition.icon,
    iconTone: definition.iconTone,
    title: disabledReason ? `${definition.title}: ${disabledReason}` : definition.title,
    shortcut: definition.shortcut,
    disabled: disabledReason !== undefined,
    children,
  }
}

function resolveItemActions(key: OcTreeKey): OcActionButtonAction[] {
  const actions = (props.data.items.get(key)?.actions ?? [])
    .map((actionKey) => resolveAction(key, actionKey, new Set()))
    .filter((action): action is OcActionButtonAction => action !== null)
  if (actions.length <= 1 || !collapsedActionKeys.value.has(key)) return actions
  return [{
    key: `__oc-tree-action-overflow__:${key}`,
    icon: 'nav.more',
    title: props.actionOverflowTitle,
    children: actions,
  }]
}

function resolveContextActions(key: OcTreeKey): OcActionButtonAction[] {
  return (props.data.items.get(key)?.contextActions ?? [])
    .map((actionKey) => resolveAction(key, actionKey, new Set()))
    .filter((action): action is OcActionButtonAction => action !== null)
}

function openItemContextMenu(key: OcTreeKey, event?: MouseEvent): boolean {
  const item = props.data.items.get(key)
  if (!item || item.disabled) return false
  const actions = resolveContextActions(key)
  if (actions.length === 0) return false
  if (!isSelected(key)) emitSelectionIntent(key, false, 'right', false)
  return openContextMenu({
    event,
    anchor: event ? undefined : rowRefs.get(key),
    items: actions,
    onSelect: actionKey => emitActionIntent(key, actionKey, 'context'),
  })
}

function handleRowContextMenu(event: MouseEvent, key: OcTreeKey): void {
  openItemContextMenu(key, event)
}

function emitActionIntent(key: OcTreeKey, actionKey: string, source: 'inline' | 'context' = 'inline'): void {
  const disabledReason = props.data.items.get(key)?.disabledActions?.get(actionKey)
  if (disabledReason !== undefined) return
  emit('intent', { type: 'action.invoke', key, actionKey, source })
}

async function startRename(key: OcTreeKey): Promise<void> {
  const item = props.data.items.get(key)
  if (!item?.renamable || item.disabled) return
  renamingKey.value = key
  renameDraft.value = item.label
  if (props.virtualized) scrollRowIntoTreeViewport(key)
  await nextTick()
  renameInputRefs.get(key)?.focus()
  const element = renameInputRefs.get(key)?.$el
  if (element instanceof HTMLInputElement) {
    const selection = item.renameSelection
    if (!selection) {
      element.select()
      return
    }

    const length = renameDraft.value.length
    const start = Math.max(0, Math.min(selection.start, length))
    const end = Math.max(start, Math.min(selection.end, length))
    element.setSelectionRange(start, end)
  }
}

defineExpose({ beginRename: startRename })

function cancelRename(): void {
  renamingKey.value = null
  renameDraft.value = ''
}

function commitRename(key: OcTreeKey): void {
  if (renamingKey.value !== key) return
  const name = renameDraft.value
  cancelRename()
  emit('intent', { type: 'rename.commit', key, name })
}

function handleRenameInput(event: Event): void {
  const target = event.target
  if (target instanceof HTMLInputElement) renameDraft.value = target.value
}

function handleRenameKeydown(event: KeyboardEvent, key: OcTreeKey): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    commitRename(key)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelRename()
    rowRefs.get(key)?.focus()
  }
}

async function focusEntry(index: number): Promise<void> {
  const entry = visibleEntries.value[index]
  if (!entry || entry.item.disabled) return
  activeKey.value = entry.key
  if (props.virtualized) scrollRowIntoTreeViewport(entry.key)
  await nextTick()
  rowRefs.get(entry.key)?.focus()
}

function findFocusableIndex(start: number, direction: -1 | 1): number {
  const entries = visibleEntries.value
  for (let offset = 1; offset <= entries.length; offset += 1) {
    const index = (start + offset * direction + entries.length) % entries.length
    if (!entries[index]?.item.disabled) return index
  }
  return start
}

function handleRowKeydown(event: KeyboardEvent, key: OcTreeKey, index: number): void {
  if (props.data.items.get(key)?.disabled) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    focusEntry(findFocusableIndex(index, 1))
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    focusEntry(findFocusableIndex(index, -1))
  } else if (event.key === 'Home') {
    event.preventDefault()
    focusEntry(visibleEntries.value.findIndex((entry) => !entry.item.disabled))
  } else if (event.key === 'End') {
    event.preventDefault()
    const reverseIndex = [...visibleEntries.value].reverse().findIndex((entry) => !entry.item.disabled)
    if (reverseIndex >= 0) focusEntry(visibleEntries.value.length - reverseIndex - 1)
  } else if (event.key === 'ArrowRight' && isExpandable(key) && !isExpanded(key)) {
    event.preventDefault()
    toggleExpanded(key)
  } else if (event.key === 'ArrowLeft' && isExpandable(key) && isExpanded(key)) {
    event.preventDefault()
    toggleExpanded(key)
  } else if (event.key === 'F2') {
    event.preventDefault()
    if (props.data.items.get(key)?.renamable) emit('intent', { type: 'rename.request', key })
  } else if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
    if (openItemContextMenu(key)) event.preventDefault()
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emitSelectionIntent(key, event.ctrlKey || event.metaKey, 'keyboard', event.shiftKey)
    if (props.activationMode !== 'none') emit('intent', { type: 'node.activate', key })
  }
}

function setRowRef(key: OcTreeKey, element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLElement) rowRefs.set(key, element)
  else rowRefs.delete(key)
}

function setRenameInputRef(key: OcTreeKey, element: Element | ComponentPublicInstance | null): void {
  if (element && '$el' in element) renameInputRefs.set(key, element as InstanceType<typeof OcFieldInput>)
  else renameInputRefs.delete(key)
}

function handleRowMouseDown(event: MouseEvent, key: OcTreeKey): void {
  const item = props.data.items.get(key)
  if (event.button !== 0 || !item?.draggable || item.disabled) return
  const target = event.target
  if (target instanceof HTMLElement && target.closest('[data-tree-interactive="true"]')) return
  pendingDrag.value = { key, startX: event.clientX, startY: event.clientY }
}

function clearDragState(): void {
  pendingDrag.value = null
  draggedKey.value = null
  dropTargetKey.value = null
  dropPosition.value = null
}

function handleGlobalMouseMove(event: MouseEvent): void {
  const pending = pendingDrag.value
  if (!pending && !draggedKey.value) return
  if (!draggedKey.value && pending) {
    const distance = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY)
    if (distance < 4) return
    draggedKey.value = pending.key
  }

  const targetElement = document.elementFromPoint(event.clientX, event.clientY)
  const rowElement = targetElement instanceof Element
    ? targetElement.closest<HTMLElement>('[data-oc-tree-key]')
    : null
  if (rowElement) {
    const rect = rowElement.getBoundingClientRect()
    const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5
    dropTargetKey.value = rowElement.dataset.ocTreeKey ?? null
    dropPosition.value = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside'
    return
  }

  const rootRect = treeRootElement.value?.getBoundingClientRect()
  const insideRoot = rootRect
    && event.clientX >= rootRect.left
    && event.clientX <= rootRect.right
    && event.clientY >= rootRect.top
    && event.clientY <= rootRect.bottom
  dropTargetKey.value = null
  dropPosition.value = insideRoot ? 'inside' : null
}

function handleGlobalMouseUp(): void {
  const key = draggedKey.value
  const targetKey = dropTargetKey.value
  const position = dropPosition.value
  if (key && position) {
    emit('intent', { type: 'move.request', key, targetKey, position })
    suppressClick.value = true
    window.setTimeout(() => { suppressClick.value = false }, 0)
  }
  clearDragState()
}

function resolveNodeClass(key: OcTreeKey): Record<string, boolean> {
  const draggingSelection = Boolean(draggedKey.value && isSelected(draggedKey.value))
  return {
    'is-selected': isSelected(key),
    'is-drag-source': draggedKey.value === key || (draggingSelection && isSelected(key)),
    'is-drop-before': dropTargetKey.value === key && dropPosition.value === 'before',
    'is-drop-inside': dropTargetKey.value === key && dropPosition.value === 'inside',
    'is-drop-after': dropTargetKey.value === key && dropPosition.value === 'after',
  }
}

watch([() => props.virtualized, () => visibleEntries.value.length], async () => {
  await nextTick()
  syncVirtualMetrics()
  const root = treeRootElement.value
  if (!props.virtualized || !root) return
  const maximum = Math.max(0, visibleEntries.value.length * virtualRowHeight.value - root.clientHeight)
  if (root.scrollTop > maximum) root.scrollTop = maximum
  virtualScrollTop.value = root.scrollTop
})
watch([renderedEntries, () => props.data, () => props.actions], async () => {
  await nextTick()
  syncActionOverflow()
})

onMounted(() => {
  window.addEventListener('mousemove', handleGlobalMouseMove)
  window.addEventListener('mouseup', handleGlobalMouseUp)
  syncTreeMetrics()
  if (typeof ResizeObserver !== 'undefined' && treeRootElement.value) {
    treeResizeObserver = new ResizeObserver(syncTreeMetrics)
    treeResizeObserver.observe(treeRootElement.value)
  }
})

onBeforeUnmount(() => {
  treeResizeObserver?.disconnect()
  window.removeEventListener('mousemove', handleGlobalMouseMove)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
})
</script>

<style scoped>
.oc-tree {
  display: flex;
  flex-direction: column;
  min-width: 0;
  user-select: none;
}

.oc-tree__content {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
}

.oc-tree__content.is-virtualized {
  position: relative;
  flex: 0 0 auto;
}

.oc-tree__content.is-virtualized > .oc-tree__node {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
}

.oc-tree__thumbnail {
  display: inline-block;
  flex: none;
  font-size: var(--oc-size-sm);
  background-repeat: no-repeat;
  vertical-align: text-bottom;
}

.oc-tree.is-fill {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
}

.oc-tree.is-root-drop {
  box-shadow: inset 0 0 0 1px var(--oc-border-accent);
}

.oc-tree__node {
  position: relative;
  flex: 0 0 auto;
}

.oc-tree__branch-guide {
  position: absolute;
  z-index: 1;
  top: calc(var(--oc-size-md) * 0.5 + 7px);
  left: calc(var(--oc-space-3) + var(--oc-tree-indent, 0px) + 7px);
  width: 1px;
  height: calc(var(--oc-tree-guide-rows) * var(--oc-size-md) - 7px);
  background: var(--oc-border-muted);
  pointer-events: none;
}

.oc-tree__branch-connector {
  position: absolute;
  z-index: 1;
  top: calc(var(--oc-size-md) * 0.5);
  left: calc(var(--oc-space-3) + var(--oc-tree-indent, 0px) - 5px);
  width: 12px;
  height: 1px;
  background: var(--oc-border-muted);
  pointer-events: none;
}

.oc-tree__row {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  width: 100%;
  height: var(--oc-size-md);
  min-width: 0;
  padding: 0 var(--oc-space-3) 0 calc(var(--oc-space-3) + var(--oc-tree-indent, 0px));
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--oc-fg-default);
  font: var(--oc-text-base);
  text-align: left;
  cursor: default;
  transition: background-color var(--oc-duration-fast) var(--oc-ease);
}

.oc-tree__row:hover:not(.is-disabled),
.oc-tree__row:focus-visible {
  background: var(--oc-bg-hover);
}

.oc-tree__node.is-selected .oc-tree__row {
  background: var(--oc-bg-selected);
}

.oc-tree__row.is-disabled {
  opacity: 0.5;
}

.oc-tree__icon-slot {
  position: relative;
  z-index: 2;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: var(--oc-icon-size-md);
  height: var(--oc-icon-size-md);
}

.oc-tree__icon-slot.is-expandable {
  cursor: pointer;
}

.oc-tree__node-icon {
  flex: 0 0 auto;
  transform-origin: center;
  transition: transform var(--oc-duration-fast) var(--oc-ease);
}

.oc-tree__node-icon.is-expanded {
  transform: rotate(45deg);
}

.oc-tree__child-count {
  position: absolute;
  z-index: 1;
  top: -6px;
  right: -9px;
  transition:
    border-color var(--oc-duration-fast) var(--oc-ease),
    color var(--oc-duration-fast) var(--oc-ease),
    background-color var(--oc-duration-fast) var(--oc-ease);
}

.oc-tree__icon-slot:hover .oc-tree__child-count,
.oc-tree__child-count.is-expanded {
  border-color: var(--oc-border-accent);
  background: var(--oc-bg-raised);
  color: var(--oc-fg-accent);
}

.oc-tree__label {
  flex: 1 1 auto;
  min-width: 0;
}

.oc-tree__tail {
  flex: 0 1 auto;
  min-width: 0;
}

.oc-tree__rename-input {
  flex: 1 1 auto;
  min-width: 0;
  height: calc(var(--oc-size-md) - var(--oc-space-1));
}

.oc-tree__controls {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--oc-space-1);
  visibility: hidden;
}

.oc-tree__display-action { display: inline-flex; align-items: center; flex: 0 0 auto; }

.oc-tree__row:hover .oc-tree__controls,
.oc-tree__row:focus-within .oc-tree__controls,
.oc-tree__node.is-selected .oc-tree__controls,
.oc-tree.are-actions-always-visible .oc-tree__controls {
  visibility: visible;
}

.oc-tree__node.is-drag-source {
  opacity: 0.45;
}

.oc-tree__node.is-drop-before::before,
.oc-tree__node.is-drop-after::after {
  content: '';
  position: absolute;
  z-index: 2;
  left: calc(var(--oc-space-3) + var(--oc-tree-indent, 0px));
  right: 0;
  height: 2px;
  background: var(--oc-border-accent);
  pointer-events: none;
}

.oc-tree__node.is-drop-before::before {
  top: 0;
}

.oc-tree__node.is-drop-after::after {
  bottom: 0;
}

.oc-tree__node.is-drop-inside .oc-tree__row {
  background: var(--oc-bg-accent-subtle);
}
</style>
