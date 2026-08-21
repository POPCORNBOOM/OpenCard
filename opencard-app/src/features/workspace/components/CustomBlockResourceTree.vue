<template>
  <OcTree fill :data="treeData" :actions="actions" :selected-keys="[]"
    :expanded-keys="expandedKeys" :aria-label="ariaLabel" selection-mode="none"
    action-visibility="always" @intent="handleIntent" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcTree from '../../../components/standard/OcTree.vue'
import type { IconToken } from '../../../shared/ui/icon/iconRegistry'
import type {
  OcTreeActionDefinition,
  OcTreeData,
  OcTreeIntent,
  OcTreeItem,
} from '../../../shared/ui/tree/tree.types'
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
  fontLabel: string
  iconLabel: string
  packageLabel: string
  imageLabel: string
  selectLabel: string
  deselectLabel: string
}>()
const emit = defineEmits<{ 'update:selectedIds': [value: Set<string>] }>()

const SELECT_ACTION = 'resource.select'
const DESELECT_ACTION = 'resource.deselect'

type ResourceNode = {
  key: string
  label: string
  kind?: ProjectCustomBlockResourceCandidateKind
  candidate?: ProjectCustomBlockResourceCandidate
  children: Map<string, ResourceNode>
}

const categoryDefinitions = computed(() => [
  ['font', props.fontLabel],
  ['icon', props.iconLabel],
  ['custom-block', props.packageLabel],
  ['image', props.imageLabel],
] as const)
const selectedSet = computed(() => new Set(props.selectedIds))
const actions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  [SELECT_ACTION, { title: props.selectLabel, icon: 'action.add', iconTone: 'success' }],
  [DESELECT_ACTION, { title: props.deselectLabel, icon: 'action.minus', iconTone: 'danger' }],
]))

const projection = computed(() => {
  const root: ResourceNode = { key: 'resource:root', label: '', children: new Map() }
  for (const [kind, label] of categoryDefinitions.value) {
    root.children.set(kind, { key: `resource:category:${kind}`, label, kind, children: new Map() })
  }
  for (const candidate of props.candidates) {
    const category = root.children.get(candidate.kind)!
    const relativePath = candidate.kind === 'font'
      ? candidate.path.replace(/^\.opencard\/fonts\//i, '')
      : candidate.kind === 'custom-block'
        ? candidate.packageId ?? candidate.path.replace(/^\.opencard\/blocks\//i, '')
        : candidate.kind === 'icon' ? candidate.label : candidate.path
    const segments = relativePath.split('/').filter(Boolean)
    let parent = category
    segments.forEach((segment, index) => {
      const identity = `${candidate.kind}:${segments.slice(0, index + 1).join('/')}`
      let node = parent.children.get(segment)
      if (!node) {
        node = { key: `resource:path:${identity}`, label: segment, kind: candidate.kind, children: new Map() }
        parent.children.set(segment, node)
      }
      if (index === segments.length - 1) {
        node.key = candidate.id
        node.label = candidate.label
        node.candidate = candidate
      }
      parent = node
    })
  }
  return root
})

function candidateIds(node: ResourceNode): string[] {
  return [
    ...(node.candidate ? [node.candidate.id] : []),
    ...[...node.children.values()].flatMap(candidateIds),
  ]
}

const treeData = computed<OcTreeData>(() => {
  const items = new Map<string, OcTreeItem>()
  const children = new Map<string, readonly string[]>()
  const visit = (node: ResourceNode): void => {
    const descendants = candidateIds(node)
    const selectedCount = descendants.filter(id => selectedSet.value.has(id)).length
    const selectedAll = descendants.length > 0 && selectedCount === descendants.length
    const candidate = node.candidate
    const status = candidate?.missing
      ? props.missingLabel
      : candidate?.kind === 'custom-block'
        ? props.nestedLabel
        : candidate?.automatic
          ? selectedCount > 0 ? props.automaticLabel : props.excludedLabel
          : candidate?.suggested
            ? props.suggestedLabel
            : candidate && selectedCount > 0 ? props.manualLabel : ''
    items.set(node.key, {
      label: node.label,
      icon: node.children.size > 0 ? 'status.folder-open' : iconForKind(node.kind),
      ...(status ? { tail: status } : node.children.size > 0 && descendants.length > 0
        ? { tail: `${selectedCount}/${descendants.length}` } : {}),
      ...(descendants.length > 0 ? {
        actions: [selectedAll ? DESELECT_ACTION : SELECT_ACTION],
        contextActions: [selectedAll ? DESELECT_ACTION : SELECT_ACTION],
      } : {}),
    })
    const childNodes = [...node.children.values()].sort((left, right) => left.label.localeCompare(right.label))
    if (childNodes.length > 0) children.set(node.key, childNodes.map(child => child.key))
    childNodes.forEach(visit)
  }
  for (const [kind] of categoryDefinitions.value) visit(projection.value.children.get(kind)!)
  return {
    rootKeys: categoryDefinitions.value.map(([kind]) => projection.value.children.get(kind)!.key),
    items,
    children,
  }
})
const expandedKeys = computed(() => [...treeData.value.items.keys()].filter(key => treeData.value.children.has(key)))

function handleIntent(intent: OcTreeIntent): void {
  if (intent.type !== 'action.invoke') return
  const node = findNode(projection.value, intent.key)
  if (!node) return
  const next = new Set(selectedSet.value)
  for (const id of candidateIds(node)) {
    if (intent.actionKey === SELECT_ACTION) next.add(id)
    else if (intent.actionKey === DESELECT_ACTION) next.delete(id)
  }
  emit('update:selectedIds', next)
}

function findNode(node: ResourceNode, key: string): ResourceNode | null {
  if (node.key === key) return node
  for (const child of node.children.values()) {
    const found = findNode(child, key)
    if (found) return found
  }
  return null
}

function iconForKind(kind?: ProjectCustomBlockResourceCandidateKind): IconToken {
  if (kind === 'font') return 'file.font'
  if (kind === 'custom-block') return 'file.custom-block'
  return 'file.image'
}
</script>
