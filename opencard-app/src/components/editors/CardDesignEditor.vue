<template>
  <div ref="editorRootRef" class="card-design-editor" :class="{ 'card-design-editor--resizing': Boolean(resizeState) }"
    :style="editorStyle">
    <OcPanelSection class="left-panel" :class="{ collapsed: !isInstancePanelExpanded }"
      header-class="panel-header left-panel-header" body-class="left-panel-content" :scroll-body="true">
      <template #title>
        <span v-if="isInstancePanelExpanded">创建的卡牌</span>
      </template>
      <template #actions>
        <OcButton class="panel-icon-button left-panel-toggle" variant="icon" icon-only @click="toggleInstancePanel"
          :title="isInstancePanelExpanded ? '收起侧栏' : '展开侧栏'">
          <span class="codicon" :class="isInstancePanelExpanded ? 'codicon-chevron-left' : 'codicon-chevron-right'" />
        </OcButton>
      </template>
      <template #default>
        <NodeTree v-if="isInstancePanelExpanded" title="创建的卡牌" :nodes="instanceTree" :expanded="true"
          :selected-keys="selectedCardKeys" :actions="instanceTreeActions" :action-keys="instanceTreeActionKeys"
          :allowed-drop-positions="getInstanceTreeAllowedDropPositions" :can-drop="canDropInstanceTreeNode"
          @update:selected-keys="onInstanceTreeSelect" @action-called="handleInstanceTreeAction"
          @node-rename="handleInstanceTreeRename" @node-drop="handleInstanceTreeDrop" />
      </template>
    </OcPanelSection>

    <div class="canvas-area oc-editor-stage">
      <CardViewport v-if="viewDoc" :document="viewDoc" :selected-block-id="selectedBlock?.id ?? null"
        :selected-location-type="selectedLocationType" :selected-anchor="selectedAnchor"
        :selected-parent-block-id="selectedParentBlockId" :transform-disabled-block-ids="transformDisabledBlockIds"
        @block-click="handleViewportBlockClick" @blank-click="clearSelection" @resize-selection="handleSelectionResize"
        @move-selection="handleSelectionMove" />
      <div v-else class="empty-hint oc-empty-hint">无法解析 .opencard 文件</div>
    </div>

    <div class="panel-resizer panel-resizer--vertical" :class="{ active: resizeState === 'right-panel' }"
      @mousedown.prevent="startRightPanelResize($event)" />

    <div ref="rightPanelRef" class="right-panel oc-panel-stack">
      <OcPanelSection class="block-list-panel" title="信息树" header-class="panel-header" body-class="block-list"
        :scroll-body="true">
        <NodeTree title="模板结构" :nodes="blockTree" :selected-keys="selectedBlockKeys" :actions="treeActions"
          v-model:expanded="blockTreeExpanded" :action-keys="treeActionKeys" :can-drop="canDropTreeNode"
          @update:selected-keys="onTreeSelect" @action-called="handleTreeAction" @node-rename="handleTreeRename"
          @node-drop="handleTreeDrop" />
      </OcPanelSection>
      <div class="panel-resizer panel-resizer--horizontal" :class="{ active: resizeState === 'tree-panel' }"
        @mousedown.prevent="startTreePanelResize($event)" />

      <OcPanelSection class="property-panel" title="属性" header-class="panel-header">
        <template #actions>
          <div class="panel-header-actions">
            <OcButton class="panel-icon-button" variant="icon" icon-only radius="none"
              :class="{ active: propertySortMode === 'category' }" :active="propertySortMode === 'category'"
              title="Category" @click="propertySortMode = 'category'">
              <span class="codicon codicon-list-tree" />
            </OcButton>
            <OcButton class="panel-icon-button" variant="icon" icon-only radius="none"
              :class="{ active: propertySortMode === 'alphabetical' }" :active="propertySortMode === 'alphabetical'"
              title="A-Z" @click="propertySortMode = 'alphabetical'">
              <span class="codicon codicon-symbol-string" />
            </OcButton>
          </div>
        </template>
        <template #default>
          <PropertyEditor
            :inputs="propertyInputs"
            :sort-mode="propertySortMode"
            @update-property="updateBlockProp"
            @add-property="addBlockProp"
            @reset-property="resetBlockProp"
          />
        </template>
      </OcPanelSection>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRaw, watch } from 'vue'
import type { EditorEmits, EditorProps } from '../../core/Editor'
import {
  addBlockToContainer,
  buildParentLookup,
  blockToTreeNode,
  BlockContainer,
  createBlock,
  toViewDoc,
  applyInstance,
  type ParentLookup,
  removeBlockFromContainer,
  type CardBlock,
  type CardDocument,
  type CardInstanceRecord,
  type CardTreeNodeMetadata,
  type PropertyEditorInput,
  isBlockContainer,
  isCardBlock,
  getBlockTreeIcon,
  moveBlockBetweenContainers,
  type FlowContainerLocationInfo,
  type SimpleContainerLocationInfo,
} from '../../core/Card'
import {
  getDefault,
  resolveNulls,
  type PropertyEditorSchemaOverride,
} from '../../core/propertyEditorSchema'
import CardViewport from '../card/CardViewport.vue'
import NodeTree, {
  type ActionDefinition,
  type NodeTreeActionCalledPayload,
  type NodeTreeCanDropPayload,
  type NodeTreeDropPayload,
  type NodeTreeDropPosition,
  type NodeTreeRenamePayload,
} from '../ui/NodeTree.vue'
import type { ITreeNode } from '../ui/TreeNode.vue'
import PropertyEditor from './PropertyEditor.vue'
import OcButton from '../base/OcButton.vue'
import OcPanelSection from '../base/OcPanelSection.vue'
import { useCdePanelResize } from '../../composables/useCdePanelResize'

type PropertySortMode = 'category' | 'alphabetical'
type PropertyEditorMutation = {
  sourceKey: string
  fieldKey: string
  value: unknown
}
type PropertyEditorResetMutation = {
  sourceKey: string
  fieldKey: string
}

// 蓝图实例固定 ID
const BLUEPRINT_CARD_ID = '__blueprint__'

// 组件输入输出
const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()

// 文档与编辑器状态
const blockTreeExpanded = ref(true)
const rawContent = ref('')
const cardDoc = ref<CardDocument | null>(null)
const parentLookup = ref<ParentLookup>(new Map())
const isModified = ref(false)
const propertySortMode = ref<PropertySortMode>('category')
const isInstancePanelExpanded = ref(true)

// 面板尺寸与拖拽状态。
const {
  editorRootRef,
  rightPanelRef,
  editorStyle,
  resizeState,
  startRightPanelResize,
  startTreePanelResize,
  mountPanelResizeListeners,
  unmountPanelResizeListeners,
} = useCdePanelResize()

// 结构树操作定义
const treeActions = new Map<string, ActionDefinition>([
  ['add-root', {
    key: 'add-root',
    icon: 'codicon-add',
    title: '添加',
    children: [
      { key: 'add-text-block', icon: getBlockTreeIcon('text-block'), title: '文本块' },
      { key: 'add-image-block', icon: getBlockTreeIcon('image-block'), title: '图片块' },
      { key: 'add-simple-container-block', icon: getBlockTreeIcon('simple-container-block'), title: '简单容器' },
      { key: 'add-flow-container-block', icon: getBlockTreeIcon('flow-container-block'), title: '流式容器' },
    ],
  }],
  ['delete-selected', { key: 'delete-selected', icon: 'codicon-trash', title: '删除选中' }],
  ['add', {
    key: 'add',
    icon: 'codicon-add',
    title: '添加',
    children: [
      { key: 'add-text-block', icon: getBlockTreeIcon('text-block'), title: '文本块' },
      { key: 'add-image-block', icon: getBlockTreeIcon('image-block'), title: '图片块' },
      { key: 'add-simple-container-block', icon: getBlockTreeIcon('simple-container-block'), title: '简单容器' },
      { key: 'add-flow-container-block', icon: getBlockTreeIcon('flow-container-block'), title: '流式容器' },
    ],
  }],
  ['delete', { key: 'delete', icon: 'codicon-trash', title: '删除' }],
])
const treeActionKeys = ['add-root', 'delete-selected']
const instanceTreeActions = new Map<string, ActionDefinition>([
  ['add-instance', { key: 'add-instance', icon: 'codicon-add', title: '新建实例' }],
  ['duplicate-instance', { key: 'duplicate-instance', icon: 'codicon-copy', title: '复制' }],
  ['delete-instance', { key: 'delete-instance', icon: 'codicon-trash', title: '删除' }],
])
const instanceTreeActionKeys = ['add-instance']

// 当前选择状态
const selectedBlockKeys = ref<string[]>([])
const selectedCardKeys = ref<string[]>([])
const selectedCardId = ref<string | null>(BLUEPRINT_CARD_ID)

// 当前选择派生信息
const selectedNode = computed<ITreeNode | null>(() => {
  const selectedKey = selectedBlockKeys.value[0]
  if (!selectedKey) return null
  return findTreeNodeByKey(blockTree.value, selectedKey)
})
const selectedCard = computed<CardInstanceRecord | null>(() => {
  if (!selectedCardId.value) {
    return null
  }

  return cardDoc.value?.instances?.find((instance) => instance.id === selectedCardId.value) ?? null
})

const selectedBlock = computed<CardBlock | null>(() => {
  const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
  return metadata?.block ?? null
})

const selectedLayout = computed<Record<string, unknown> | null>(() => {
  const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
  return metadata?.location ? (metadata.location as Record<string, unknown>) : null
})

const selectedLocationType = computed<'simple-container-location' | 'flow-container-location' | null>(() => {
  const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
  return metadata?.location?.type ?? null
})
const selectedAnchor = computed(() => {
  const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
  return metadata?.location?.type === 'simple-container-location' ? metadata.location.anchor : null
})
const selectedParentBlockId = computed(() => {
  const block = selectedBlock.value
  if (!block) {
    return null
  }

  const parent = parentLookup.value.get(block.id)
  return parent?.id ?? null
})
const transformDisabledBlockIds = computed(() => {
  const block = selectedBlock.value
  if (!block) {
    return []
  }

  const ids: string[] = []
  let current: CardBlock | null = block
  while (current) {
    ids.push(current.id)
    const parent = parentLookup.value.get(current.id)
    if (!parent || parent.type === 'card-document') {
      break
    }
    current = parent
  }
  return ids
})

// 属性面板输入源
// Build the property-editor input for the selected block with instance overrides and null resolution.
const blockPropsView = computed<Record<string, unknown> & { type?: string } | null>(() => {
  const block = selectedBlock.value
  if (!block) {
    return null
  }

  if (selectedCardId.value === BLUEPRINT_CARD_ID || !selectedCard.value) {
    return resolveNulls(
      block.type,
      block as Record<string, unknown>
    ) as Record<string, unknown> & { type?: string }
  }

  const blockOverrides = selectedCard.value.data[block.id] ?? {}
  return resolveNulls(block.type, {
    ...block,
    ...blockOverrides,
  }) as Record<string, unknown> & { type?: string }
})

const blockInputOverride = computed<PropertyEditorSchemaOverride | undefined>(() => {
  const block = selectedBlock.value
  if (!block || selectedCardId.value === BLUEPRINT_CARD_ID || !selectedCard.value) {
    return undefined
  }

  const instanceBlockData = selectedCard.value.data[block.id]
  if (!instanceBlockData) {
    return undefined
  }

  const overrideEntries = Object.keys(instanceBlockData).map((fieldKey) => [
    fieldKey,
    { resettable: true },
  ] as const)

  if (overrideEntries.length === 0) {
    return undefined
  }

  return Object.fromEntries(overrideEntries)
})

const propertyInputs = computed<PropertyEditorInput[]>(() => {
  const inputs: PropertyEditorInput[] = []

  if (blockPropsView.value) {
    inputs.push({
      key: 'block',
      record: blockPropsView.value,
      override: blockInputOverride.value,
    })
  }

  if (selectedLayout.value) {
    inputs.push({
      key: 'layout',
      record: selectedLayout.value as Record<string, unknown> & { type?: string },
    })
  }

  return inputs
})

// 结构树与渲染视图
const blockTree = computed(() => {
  if (!cardDoc.value) return []
  return cardDoc.value.children.map((child) =>
    blockToTreeNode(child.block, null, child.location)
  )
})

// Build the render/view document by projecting the selected instance onto the blueprint document.
const viewDoc = computed<CardDocument | null>(() => {
  if (!cardDoc.value) {
    return null
  }

  if (selectedCardId.value === BLUEPRINT_CARD_ID || !selectedCard.value) {
    return toViewDoc(cardDoc.value)
  }

  const projected = applyInstance(cardDoc.value, selectedCard.value)
  return toViewDoc(projected)
})

const instanceTree = computed<ITreeNode[]>(() => {
  if (!cardDoc.value) {
    return []
  }

  const instances = cardDoc.value?.instances
  const blueprintNode: ITreeNode = {
    key: BLUEPRINT_CARD_ID,
    name: '蓝图',
    path: [BLUEPRINT_CARD_ID],
    parent: null,
    renamable: false,
    isExpandable: false,
    icon: 'codicon-symbol-class',
    metadata: {
      instanceId: BLUEPRINT_CARD_ID,
      kind: 'blueprint',
    },
  }

  if (!instances || instances.length === 0) {
    return [blueprintNode]
  }

  return [
    blueprintNode,
    ...instances.map((instance: CardInstanceRecord, index) => {
      const instanceId = instance.id?.trim() || `instance-${index + 1}`
      const displayName = instance.name?.trim() || instanceId

      const rootNode: ITreeNode = {
        key: instanceId,
        name: displayName,
        path: [instanceId],
        parent: null,
        icon: 'codicon-account',
        actionKeys: ['duplicate-instance', 'delete-instance'],
        metadata: {
          instance,
          instanceId,
        },
      }

      return rootNode
    }),
  ]
})

function toggleInstancePanel() {
  isInstancePanelExpanded.value = !isInstancePanelExpanded.value
}

function syncDocumentContent() {
  if (!cardDoc.value) {
    return
  }

  const content = JSON.stringify(cardDoc.value, null, 2)
  if (content === rawContent.value) {
    return
  }

  rawContent.value = content
  emit('update:modelValue', content)
}

function markDocumentChanged() {
  isModified.value = true
  emit('modified', true)
  syncDocumentContent()
}

function updateBlockProp({
  sourceKey,
  fieldKey,
  value,
}: PropertyEditorMutation) {
  if (sourceKey === 'layout') {
    const layout = selectedLayout.value
    if (!layout) {
      return
    }

    layout[fieldKey] = value
    markDocumentChanged()
    return
  }

  const block = selectedBlock.value
  if (!block) {
    return
  }

  if (selectedCardId.value !== BLUEPRINT_CARD_ID && selectedCard.value) {
    const instanceBlockData = selectedCard.value.data[block.id] ?? (selectedCard.value.data[block.id] = {})
    instanceBlockData[fieldKey] = value
    markDocumentChanged()
    return
  }

  ; (block as Record<string, unknown>)[fieldKey] = value
  if (block.type === 'image-block' && fieldKey === 'image') {
    delete (block as Record<string, unknown>).imagePath
  }

  markDocumentChanged()
}

function addBlockProp({
  sourceKey,
  fieldKey,
  value,
}: PropertyEditorMutation) {
  if (sourceKey === 'layout') {
    const layout = selectedLayout.value
    if (!layout) {
      return
    }

    layout[fieldKey] = value
    markDocumentChanged()
    return
  }

  const block = selectedBlock.value
  if (!block) {
    return
  }

  if (selectedCardId.value !== BLUEPRINT_CARD_ID && selectedCard.value) {
    const instanceBlockData = selectedCard.value.data[block.id] ?? (selectedCard.value.data[block.id] = {})
    instanceBlockData[fieldKey] = value
    markDocumentChanged()
    return
  }

  ; (block as Record<string, unknown>)[fieldKey] = value
  markDocumentChanged()
}

function resetBlockProp({
  sourceKey,
  fieldKey,
}: PropertyEditorResetMutation) {
  if (sourceKey === 'layout') {
    const layout = selectedLayout.value
    if (!layout) {
      return
    }

    const layoutType = typeof layout.type === 'string' ? layout.type : undefined
    const defaultValue = getDefault(layoutType, fieldKey)
    if (defaultValue === undefined) {
      delete layout[fieldKey]
    } else {
      layout[fieldKey] = defaultValue
    }
    markDocumentChanged()
    return
  }

  const block = selectedBlock.value
  if (!block) {
    return
  }

  if (selectedCardId.value !== BLUEPRINT_CARD_ID && selectedCard.value) {
    const instanceBlockData = selectedCard.value.data[block.id]
    if (!instanceBlockData || !Object.prototype.hasOwnProperty.call(instanceBlockData, fieldKey)) {
      return
    }

    delete instanceBlockData[fieldKey]
    if (Object.keys(instanceBlockData).length === 0) {
      delete selectedCard.value.data[block.id]
    }
    markDocumentChanged()
    return
  }

  const defaultValue = getDefault(block.type, fieldKey)
  if (defaultValue === undefined) {
    delete (block as Record<string, unknown>)[fieldKey]
  } else {
    ; (block as Record<string, unknown>)[fieldKey] = defaultValue
  }
  if (block.type === 'image-block' && fieldKey === 'image') {
    delete (block as Record<string, unknown>).imagePath
  }
  markDocumentChanged()
}

function onTreeSelect(nextSelectedKeys: string[]) {
  selectedBlockKeys.value = nextSelectedKeys
}

function onInstanceTreeSelect(nextSelectedKeys: string[]) {
  selectedCardKeys.value = nextSelectedKeys
  const selectedNode = nextSelectedKeys[0] ? findTreeNodeByKey(instanceTree.value, nextSelectedKeys[0]) : null
  const instanceId = selectedNode?.metadata && typeof selectedNode.metadata === 'object'
    ? (selectedNode.metadata as { instanceId?: unknown }).instanceId
    : undefined

  selectedCardId.value = typeof instanceId === 'string' ? instanceId : null
}

function handleInstanceTreeAction({ actionKey, caller, node }: NodeTreeActionCalledPayload) {
  if (caller === 'node' && node) {
    selectedCardKeys.value = [node.key]
    selectedCardId.value = node.key
  }

  switch (actionKey) {
    case 'add-instance':
      createInstance()
      return
    case 'duplicate-instance':
      if (node) {
        duplicateInstance(node.key)
      }
      return
    case 'delete-instance':
      if (node) {
        deleteInstance(node.key)
      }
      return
  }
}

function handleInstanceTreeRename({ node, name }: NodeTreeRenamePayload) {
  if (!cardDoc.value?.instances || node.key === BLUEPRINT_CARD_ID) {
    return
  }

  const nextName = name.trim()
  if (!nextName) {
    return
  }

  const instance = cardDoc.value.instances.find((item) => item.id === node.key)
  if (!instance || instance.name === nextName) {
    return
  }

  instance.name = nextName
  markDocumentChanged()
}

function handleViewportBlockClick(blockId: string) {
  const clickedNode = findTreeNodeByBlockId(blockTree.value, blockId)
  if (!clickedNode) {
    return
  }

  selectedBlockKeys.value = [clickedNode.key]
}

function clearSelection() {
  if (selectedBlockKeys.value.length === 0) {
    return
  }

  selectedBlockKeys.value = []
}

function getInstanceTreeAllowedDropPositions(target: ITreeNode | null) {
  if (!target) {
    return ['inside'] as NodeTreeDropPosition[]
  }

  if (target.key === BLUEPRINT_CARD_ID) {
    return ['after'] as NodeTreeDropPosition[]
  }

  return ['before', 'after'] as NodeTreeDropPosition[]
}

function canDropInstanceTreeNode({ dragged, target, position }: NodeTreeCanDropPayload) {
  if (dragged.key === BLUEPRINT_CARD_ID) {
    return false
  }

  if (target && target.key === dragged.key) {
    return false
  }

  if (target && target.key === BLUEPRINT_CARD_ID) {
    return position === 'after'
  }

  if (target === null) {
    return position === 'inside'
  }

  return position === 'before' || position === 'after'
}

function handleInstanceTreeDrop({ dragged, target, position }: NodeTreeDropPayload) {
  if (!cardDoc.value?.instances || !canDropInstanceTreeNode({ dragged, target, position })) {
    return
  }

  const instances = [...cardDoc.value.instances]
  const sourceIndex = instances.findIndex((instance) => instance.id === dragged.key)
  if (sourceIndex === -1) {
    return
  }

  const [draggedInstance] = instances.splice(sourceIndex, 1)
  let insertionIndex = instances.length

  if (target && target.key !== BLUEPRINT_CARD_ID) {
    const targetIndex = instances.findIndex((instance) => instance.id === target.key)
    if (targetIndex === -1) {
      return
    }
    insertionIndex = position === 'before' ? targetIndex : targetIndex + 1
  } else if (target?.key === BLUEPRINT_CARD_ID) {
    insertionIndex = 0
  }

  instances.splice(insertionIndex, 0, draggedInstance)
  cardDoc.value.instances = instances
  markDocumentChanged()
}

function createInstance() {
  if (!cardDoc.value) {
    return
  }

  const nextIndex = (cardDoc.value.instances?.length ?? 0) + 1
  const nextInstance: CardInstanceRecord = {
    id: `instance-${crypto.randomUUID()}`,
    name: `新实例 ${nextIndex}`,
    data: {},
  }

  cardDoc.value.instances = [...(cardDoc.value.instances ?? []), nextInstance]
  selectedCardId.value = nextInstance.id
  markDocumentChanged()
}

function duplicateInstance(instanceId: string) {
  if (!cardDoc.value?.instances || instanceId === BLUEPRINT_CARD_ID) {
    return
  }

  const sourceInstance = cardDoc.value.instances.find((item) => item.id === instanceId)
  if (!sourceInstance) {
    return
  }

  const rawInstance = toRaw(sourceInstance)
  const duplicatedInstance: CardInstanceRecord = {
    ...structuredClone(rawInstance),
    id: `instance-${crypto.randomUUID()}`,
    name: `${sourceInstance.name} 副本`,
  }

  const sourceIndex = cardDoc.value.instances.findIndex((item) => item.id === instanceId)
  const nextInstances = [...cardDoc.value.instances]
  nextInstances.splice(sourceIndex + 1, 0, duplicatedInstance)
  cardDoc.value.instances = nextInstances
  selectedCardId.value = duplicatedInstance.id
  markDocumentChanged()
}

function deleteInstance(instanceId: string) {
  if (!cardDoc.value?.instances || instanceId === BLUEPRINT_CARD_ID) {
    return
  }

  const instance = cardDoc.value.instances.find((item) => item.id === instanceId)
  if (!instance) {
    return
  }

  cardDoc.value.instances = cardDoc.value.instances.filter((item) => item.id !== instanceId)
  if (selectedCardId.value === instanceId) {
    selectedCardId.value = BLUEPRINT_CARD_ID
  }
  markDocumentChanged()
}

function formatViewportCssValue(value: number): string {
  const normalized = Math.round(value * 100) / 100
  const safeValue = Object.is(normalized, -0) ? 0 : normalized
  return `${safeValue}px`
}

function handleSelectionResize(payload: { width: number; height: number; x?: number; y?: number }) {
  //console.log('handleSelectionResize', payload)
  const block = selectedBlock.value
  if (!block) {
    return
  }

  block.width = formatViewportCssValue(payload.width)
  block.height = formatViewportCssValue(payload.height)

  const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
  if (metadata?.location?.type === 'simple-container-location') {
    metadata.location.x = formatViewportCssValue(payload.x ?? 0)
    metadata.location.y = formatViewportCssValue(payload.y ?? 0)
  }

  markDocumentChanged()
}

function handleSelectionMove(payload: { x: number; y: number }) {
  const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
  if (metadata?.location?.type !== 'simple-container-location') {
    return
  }

  metadata.location.x = formatViewportCssValue(payload.x)
  metadata.location.y = formatViewportCssValue(payload.y)
  markDocumentChanged()
}

function handleTreeAction({ actionKey, caller, node }: NodeTreeActionCalledPayload) {
  if (caller === 'node' && node) {
    selectedBlockKeys.value = [node.key]
  }

  const callerObject = caller === 'node' ? getNodeBlock(node) : cardDoc.value
  if (!callerObject) {
    return
  }

  switch (actionKey) {
    case 'add-text-block':
      if (isBlockContainer(callerObject)) createBlockAt(callerObject, 'text-block')
      return
    case 'add-image-block':
      if (isBlockContainer(callerObject)) createBlockAt(callerObject, 'image-block')
      return
    case 'add-simple-container-block':
      if (isBlockContainer(callerObject)) createBlockAt(callerObject, 'simple-container-block')
      return
    case 'add-flow-container-block':
      if (isBlockContainer(callerObject)) createBlockAt(callerObject, 'flow-container-block')
      return
    case 'delete':
      if (isCardBlock(callerObject)) deleteBlock(callerObject)
      return
    case 'delete-selected':
      if (isCardBlock(selectedBlock.value)) deleteBlock(selectedBlock.value)
      return
  }
}

function handleTreeRename({ node, name }: NodeTreeRenamePayload) {
  const block = getNodeBlock(node)
  if (!block) {
    return
  }

  const nextName = name.trim()
  if (!nextName || block.name === nextName) {
    return
  }

  block.name = nextName
  markDocumentChanged()
}

function getNodeBlock(node?: ITreeNode): CardBlock | null {
  const metadata = node?.metadata as CardTreeNodeMetadata | undefined
  return metadata?.block ?? null
}

function findTreeNodeByKey(nodes: ITreeNode[], key: string): ITreeNode | null {
  for (const node of nodes) {
    if (node.key === key) {
      return node
    }

    const childNode = findTreeNodeByKey(node.children ?? [], key)
    if (childNode) {
      return childNode
    }
  }

  return null
}

function findTreeNodeByBlockId(nodes: ITreeNode[], blockId: string): ITreeNode | null {
  for (const node of nodes) {
    const block = getNodeBlock(node)
    if (block?.id === blockId) {
      return node
    }

    const childNode = findTreeNodeByBlockId(node.children ?? [], blockId)
    if (childNode) {
      return childNode
    }
  }

  return null
}

function isDescendantOrSelfNode(targetNode: ITreeNode, ancestorNode: ITreeNode) {
  return targetNode.path?.includes(ancestorNode.key) ?? false
}

function getContainerForDropTarget(targetNode: ITreeNode | null, position: NodeTreeCanDropPayload['position']): BlockContainer | null {
  if (!targetNode) {
    return cardDoc.value
  }

  const targetBlock = getNodeBlock(targetNode)
  if (!targetBlock) {
    return null
  }

  if (position === 'inside') {
    return isBlockContainer(targetBlock) ? targetBlock : null
  }

  return parentLookup.value.get(targetBlock.id) ?? null
}

function getInsertionIndexForDropTarget(targetNode: ITreeNode | null, position: NodeTreeCanDropPayload['position']): number | null {
  if (!targetNode) {
    return cardDoc.value?.children.length ?? null
  }

  const targetBlock = getNodeBlock(targetNode)
  if (!targetBlock) {
    return null
  }

  if (position === 'inside') {
    const targetContainer = getContainerForDropTarget(targetNode, position)
    return targetContainer ? targetContainer.children.length : null
  }

  const targetContainer = parentLookup.value.get(targetBlock.id)
  if (!targetContainer) {
    return null
  }

  const targetIndex = targetContainer.children.findIndex((child) => child.block.id === targetBlock.id)
  if (targetIndex === -1) {
    return null
  }

  return position === 'before' ? targetIndex : targetIndex + 1
}

function createDropLocation(
  draggedNode: ITreeNode,
  targetContainer: BlockContainer,
  insertionIndex: number,
): SimpleContainerLocationInfo | FlowContainerLocationInfo {
  const metadata = draggedNode.metadata as CardTreeNodeMetadata | undefined
  const currentLocation = metadata?.location

  if (targetContainer.type === 'flow-container-block') {
    const align = currentLocation?.type === 'flow-container-location' ? currentLocation.align : undefined
    return {
      type: 'flow-container-location',
      index: insertionIndex,
      align,
    }
  }

  if (currentLocation?.type === 'simple-container-location') {
    return { ...currentLocation }
  }

  return {
    type: 'simple-container-location',
    anchor: 'lt',
    x: 0,
    y: 0,
  }
}

function canDropTreeNode({ dragged, target, position }: NodeTreeCanDropPayload) {
  if (target && dragged.key === target.key) {
    console.debug('[blocktree] canDrop=false same-node', { dragged: dragged.key, target: target.key, position })
    return false
  }

  if (target && isDescendantOrSelfNode(target, dragged)) {
    console.debug('[blocktree] canDrop=false descendant', { dragged: dragged.key, target: target.key, position })
    return false
  }

  const draggedBlock = getNodeBlock(dragged)
  if (!draggedBlock) {
    return false
  }

  const sourceContainer = parentLookup.value.get(draggedBlock.id)
  const targetContainer = getContainerForDropTarget(target, position)
  const insertionIndex = getInsertionIndexForDropTarget(target, position)

  if (!sourceContainer || !targetContainer || insertionIndex === null) {
    console.debug('[blocktree] canDrop=false missing-target', {
      dragged: dragged.key,
      target: target?.key ?? null,
      position,
      sourceContainer: sourceContainer?.type ?? null,
      targetContainer: targetContainer?.type ?? null,
      insertionIndex,
    })
    return false
  }

  console.debug('[blocktree] canDrop=true', {
    dragged: dragged.key,
    target: target?.key ?? null,
    position,
    sourceContainer: sourceContainer.type,
    targetContainer: targetContainer.type,
    insertionIndex,
  })
  return true
}

function handleTreeDrop({ dragged, target, position }: NodeTreeDropPayload) {
  const draggedBlock = getNodeBlock(dragged)
  if (!draggedBlock || !canDropTreeNode({ dragged, target, position })) {
    return
  }

  const sourceContainer = parentLookup.value.get(draggedBlock.id)
  const targetContainer = getContainerForDropTarget(target, position)
  let insertionIndex = getInsertionIndexForDropTarget(target, position)

  if (!sourceContainer || !targetContainer || insertionIndex === null) {
    return
  }

  if (sourceContainer === targetContainer) {
    const sourceIndex = sourceContainer.children.findIndex((child) => child.block.id === draggedBlock.id)
    if (sourceIndex !== -1 && sourceIndex < insertionIndex) {
      insertionIndex -= 1
    }
  }

  const location = createDropLocation(dragged, targetContainer, insertionIndex)
  const movedBlock = moveBlockBetweenContainers(
    sourceContainer,
    targetContainer,
    draggedBlock.id,
    parentLookup.value,
    location,
    insertionIndex,
  )

  if (!movedBlock) {
    return
  }

  const updatedNode = findTreeNodeByBlockId(blockTree.value, draggedBlock.id)
  selectedBlockKeys.value = updatedNode ? [updatedNode.key] : []
  markDocumentChanged()
}

// Load raw document JSON into editor state and reset current selections safely.
function loadRawDoc(content: string) {
  rawContent.value = content
  selectedBlockKeys.value = []
  selectedCardKeys.value = []
  selectedCardId.value = BLUEPRINT_CARD_ID

  try {
    const parsed = JSON.parse(content) as CardDocument
    cardDoc.value = parsed
    parentLookup.value = buildParentLookup(parsed)
    isModified.value = false
    emit('modified', false)
  } catch (e) {
    console.error('读取 .opencard 文件失败:', e)
    cardDoc.value = null
    parentLookup.value = new Map()
    isModified.value = false
    emit('modified', false)
  }
}

function createBlockAt(container: BlockContainer, type: CardBlock['type']) {
  let newBlock: CardBlock

  switch (type) {
    case 'text-block':
      newBlock = createBlock('text-block')
      break
    case 'image-block':
      newBlock = createBlock('image-block')
      break
    case 'simple-container-block':
      newBlock = createBlock('simple-container-block')
      break
    case 'flow-container-block':
      newBlock = createBlock('flow-container-block')
      break
  }

  addBlockToContainer(container, newBlock, parentLookup.value)
  markDocumentChanged()
}

function deleteBlock(block: CardBlock) {
  const container = parentLookup.value.get(block.id)
  if (!container) {
    return
  }

  const removedBlock = removeBlockFromContainer(container, block.id, parentLookup.value)
  if (!removedBlock) {
    return
  }

  selectedBlockKeys.value = selectedBlockKeys.value.filter((key) => key !== block.id)
  markDocumentChanged()
}

async function saveFile() {
  if (!cardDoc.value) return
  try {
    const content = JSON.stringify(cardDoc.value, null, 2)
    rawContent.value = content
    isModified.value = false
    emit('update:modelValue', content)
    emit('modified', false)
    emit('save')
  } catch (e) {
    console.error('保存失败:', e)
  }
}

watch(
  () => props.modelValue,
  (nextValue) => {
    const content = nextValue ?? ''
    if (!content || content === rawContent.value) {
      return
    }

    loadRawDoc(content)
  },
  { immediate: true },
)

watch(
  [instanceTree, selectedCardId],
  ([nodes, instanceId]) => {
    if (!instanceId) {
      if (selectedCardKeys.value.length > 0) {
        selectedCardKeys.value = []
      }
      return
    }

    const matchedNode = nodes.find((node) => node.key === instanceId) ?? null
    const nextSelectedKeys = matchedNode ? [matchedNode.key] : []

    const currentKey = selectedCardKeys.value[0] ?? null
    const nextKey = nextSelectedKeys[0] ?? null
    if (currentKey === nextKey && selectedCardKeys.value.length === nextSelectedKeys.length) {
      return
    }

    selectedCardKeys.value = nextSelectedKeys
  },
  { immediate: true },
)

defineExpose({ save: saveFile })

onMounted(() => {
  mountPanelResizeListeners()
})

onUnmounted(() => {
  unmountPanelResizeListeners()
})

</script>

<style scoped>
.card-design-editor {
  display: flex;
  height: 100%;
  background: var(--oc-bg-base);
  color: var(--oc-text-primary);
  --card-editor-right-panel-width: 320px;
  --card-editor-tree-panel-height: 320px;
}

.left-panel {
  width: 260px;
  border-right: 1px solid var(--oc-border-strong);
  overflow: hidden;
  flex-shrink: 0;
  transition: width 160ms ease;
}

.left-panel.collapsed {
  width: 44px;
}

.left-panel.collapsed :deep(.oc-panel-header) {
  padding: 0;
  justify-content: center;
}

.left-panel.collapsed :deep(.oc-panel-section__title) {
  display: none;
}

.left-panel.collapsed :deep(.oc-panel-section__actions) {
  width: 100%;
  margin-left: 0;
  justify-content: center;
}

.left-panel.collapsed :deep(.oc-panel-section__body) {
  display: none;
}

.left-panel-header {
  justify-content: space-between;
}

.left-panel-toggle {
  margin-left: auto;
}

.left-panel.collapsed .left-panel-toggle {
  margin-left: 0;
}

.left-panel-content {
  padding: 4px 0;
}

.canvas-area {
  background: var(--oc-bg-elevated);
}

.right-panel {
  width: var(--card-editor-right-panel-width);
  border-left: 1px solid var(--oc-border-strong);
}

.block-list-panel {
  height: var(--card-editor-tree-panel-height);
  flex: 0 0 auto;
  border-bottom: 1px solid var(--oc-border-strong);
  overflow: hidden;
}

.property-panel {
  height: calc(100% - var(--card-editor-tree-panel-height) - var(--card-editor-horizontal-resizer-height));
  min-height: var(--card-editor-min-property-panel-height);
  flex: 0 0 auto;
  position: relative;
  overflow: hidden;
}

.panel-header {
  position: relative;
}

.panel-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.panel-icon-button {
  flex-shrink: 0;
}

.block-list {
  padding: 4px 0;
}

.block-item {
  padding: 4px 10px;
  cursor: pointer;
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.block-item:hover {
  background: #2a2d2e;
}

.block-item.selected {
  background: #094771;
}

.block-type {
  color: #569cd6;
}

.block-id {
  color: #888;
}

.panel-resizer {
  position: relative;
  flex-shrink: 0;
  background: transparent;
  touch-action: none;
}

.panel-resizer::before {
  content: '';
  position: absolute;
  border-radius: 999px;
  background: var(--oc-border-strong);
  transition: background-color 120ms ease, box-shadow 120ms ease;
}

.panel-resizer:hover::before {
  background: var(--oc-bg-hover-strong);
}

.panel-resizer.active::before {
  background: var(--oc-bg-accent);
  box-shadow: 0 0 0 1px var(--oc-bg-accent-soft);
}

.panel-resizer--vertical {
  width: 6px;
  cursor: col-resize;
}

.panel-resizer--vertical::before {
  inset: 0 2px;
}

.panel-resizer--horizontal {
  height: 6px;
  cursor: row-resize;
}

.panel-resizer--horizontal::before {
  inset: 2px 0;
}

.card-design-editor--resizing .canvas-area,
.card-design-editor--resizing .left-panel,
.card-design-editor--resizing .block-list-panel,
.card-design-editor--resizing .property-panel {
  pointer-events: none;
}

.card-design-editor--resizing .right-panel {
  will-change: width;
}

.card-design-editor--resizing .block-list-panel {
  will-change: height;
}

:global(body.is-resizing-panels) {
  user-select: none;
}
</style>
