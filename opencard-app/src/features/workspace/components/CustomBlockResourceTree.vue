<template>
  <div class="custom-block-resource-tree" role="tree" :aria-label="ariaLabel">
    <label v-for="row in rows" :key="row.id" class="custom-block-resource-tree__row"
      :class="{ 'is-automatic': row.automatic, 'is-suggested': row.suggested }"
      :style="{ '--oc-resource-tree-depth': String(row.depth) }" role="treeitem"
      :aria-level="row.depth + 1">
      <OcCheckbox :checked="row.checked" :indeterminate="row.indeterminate"
        @update:checked="toggleRow(row, $event)" />
      <OcIcon :name="row.isFolder ? 'status.folder-open' : iconForKind(row.kind)" size="sm" />
      <OcText class="custom-block-resource-tree__label" size="sm" truncate>
        {{ row.label }}
      </OcText>
      <OcText v-if="row.status" size="xs" :tone="row.suggested ? 'warning' : row.automatic ? 'accent' : 'muted'">
        {{ row.status }}
      </OcText>
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcCheckbox from '../../../components/base/OcCheckbox.vue'
import OcIcon from '../../../components/base/OcIcon.vue'
import OcText from '../../../components/base/OcText.vue'
import type { IconToken } from '../../../shared/ui/icon/iconRegistry'
import type {
  ProjectCustomBlockResourceCandidate,
  ProjectCustomBlockResourceCandidateKind,
} from '../services/projectCustomBlockResources'

const props = defineProps<{
  candidates: readonly ProjectCustomBlockResourceCandidate[]
  selectedIds: readonly string[]
  ariaLabel: string
  automaticLabel: string
  suggestedLabel: string
  manualLabel: string
  excludedLabel: string
  missingLabel: string
  nestedLabel: string
}>()
const emit = defineEmits<{ 'update:selectedIds': [value: Set<string>] }>()

type ResourceTreeNode = {
  id: string
  label: string
  children: Map<string, ResourceTreeNode>
  candidate?: ProjectCustomBlockResourceCandidate
}
type ResourceTreeRow = {
  id: string
  label: string
  depth: number
  isFolder: boolean
  descendantIds: readonly string[]
  checked: boolean
  indeterminate: boolean
  automatic: boolean
  suggested: boolean
  status: string
  kind?: ProjectCustomBlockResourceCandidateKind
}

const selectedIdSet = computed(() => new Set(props.selectedIds))

const rows = computed<ResourceTreeRow[]>(() => {
  const root: ResourceTreeNode = { id: 'root', label: '', children: new Map() }
  for (const candidate of props.candidates) {
    const segments = candidate.path.split('/').filter(Boolean)
    let parent = root
    segments.forEach((segment, index) => {
      const path = segments.slice(0, index + 1).join('/')
      let node = parent.children.get(segment)
      if (!node) {
        node = { id: `path:${path}`, label: segment, children: new Map() }
        parent.children.set(segment, node)
      }
      if (index === segments.length - 1) {
        node.id = candidate.id
        node.candidate = candidate
        node.label = candidate.label
      }
      parent = node
    })
  }

  const result: ResourceTreeRow[] = []
  const collectCandidateIds = (node: ResourceTreeNode): string[] => [
    ...(node.candidate ? [node.candidate.id] : []),
    ...[...node.children.values()].flatMap(collectCandidateIds),
  ]
  const visit = (node: ResourceTreeNode, depth: number): void => {
    const descendantIds = collectCandidateIds(node)
    const selectedCount = descendantIds.filter(id => selectedIdSet.value.has(id)).length
    const candidate = node.candidate
    result.push({
      id: node.id,
      label: node.label,
      depth,
      isFolder: node.children.size > 0 && !candidate,
      descendantIds,
      checked: descendantIds.length > 0 && selectedCount === descendantIds.length,
      indeterminate: selectedCount > 0 && selectedCount < descendantIds.length,
      automatic: candidate?.automatic ?? false,
      suggested: candidate?.suggested ?? false,
      status: candidate?.missing
        ? props.missingLabel
        : candidate?.kind === 'custom-block'
          ? props.nestedLabel
          : candidate?.automatic
            ? selectedCount > 0 ? props.automaticLabel : props.excludedLabel
            : candidate?.suggested
              ? props.suggestedLabel
              : candidate && selectedCount > 0 ? props.manualLabel : '',
      kind: candidate?.kind,
    })
    for (const child of [...node.children.values()].sort((left, right) => left.label.localeCompare(right.label))) {
      visit(child, depth + 1)
    }
  }
  for (const child of [...root.children.values()].sort((left, right) => left.label.localeCompare(right.label))) {
    visit(child, 0)
  }
  return result
})

function toggleRow(row: ResourceTreeRow, checked: boolean): void {
  const next = new Set(selectedIdSet.value)
  for (const id of row.descendantIds) {
    if (checked) next.add(id)
    else next.delete(id)
  }
  emit('update:selectedIds', next)
}

function iconForKind(kind?: ProjectCustomBlockResourceCandidateKind): IconToken {
  if (kind === 'font') return 'file.font'
  if (kind === 'custom-block') return 'file.custom-block'
  return 'file.image'
}
</script>

<style scoped>
.custom-block-resource-tree { display: grid; align-content: start; min-width: 0; }
.custom-block-resource-tree__row { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto; align-items: center; gap: var(--oc-space-2); min-height: var(--oc-property-row-height); padding-inline: calc(var(--oc-space-2) + var(--oc-resource-tree-depth) * var(--oc-tree-indent)); border-bottom: var(--oc-border-width) solid var(--oc-border-muted); }
.custom-block-resource-tree__row.is-automatic { background: var(--oc-bg-accent-subtle); }
.custom-block-resource-tree__row.is-suggested { background: var(--oc-bg-warning-subtle); }
.custom-block-resource-tree__label { min-width: 0; }
</style>
