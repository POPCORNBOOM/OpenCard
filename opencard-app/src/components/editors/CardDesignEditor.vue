<!--
  使用说明：
  - 输入 `filePath` 与 `modelValue` 作为卡牌编辑源
  - 通过 `save/modified/update:modelValue` 与外层会话同步

  职责边界：
  - 负责卡牌编辑器编排 实例树 结构树 画布与属性面板协同
  - 只上抛编辑意图与内容变更 不负责文件系统持久化规则

  主要输出事件：
  - `update:modelValue`（同步文档文本）
  - `modified`（同步脏状态）
  - `save`（请求外层执行保存）
-->
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import {
  toViewDoc,
  applyInstance,
  type CardBlock,
  type CardDocument,
  type CardTreeNodeMetadata,
  type PropertyEditorInput,
  getBlockTreeIcon,
} from '../../entities/card/model'
import {
  getDefault,
  resolveNulls,
  type PropertyEditorSchemaOverride,
} from '../../entities/card/schema'
import CardViewport from '../card/CardViewport.vue'
import NodeTree from '../ui/NodeTree.vue'
import PropertyEditor from './PropertyEditor.vue'
import OcButton from '../base/OcButton.vue'
import OcPanelSection from '../base/OcPanelSection.vue'
import { useCdePanelResize } from '../../composables/useCdePanelResize'
import { useCdeDocumentState } from '../../composables/useCdeDocumentState'
import { useCdeInstanceOps } from '../../composables/useCdeInstanceOps'
import { useCdeTreeOps } from '../../composables/useCdeTreeOps'
import { resetInstanceOverrideField } from '../../composables/cdeInstanceOverride'
import type { ActionDefinition } from '../../shared/ui/tree/tree.types'

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

// 文档状态与读写协议。
const {
  rawContent,
  cardDoc,
  parentLookup,
  markDocumentChanged,
  loadRawDoc,
  saveFile: saveDocumentFile,
} = useCdeDocumentState({
  emitModelValueUpdate: (content) => emit('update:modelValue', content),
  emitModified: (modified) => emit('modified', modified),
  emitSave: () => emit('save'),
  resetSelection: () => {
    selectedBlockKeys.value = []
    selectedCardKeys.value = []
    selectedCardId.value = BLUEPRINT_CARD_ID
  },
})

// 实例树与实例编辑协议。
const {
  selectedCard,
  instanceTree,
  onInstanceTreeSelect,
  handleInstanceTreeAction,
  handleInstanceTreeRename,
  getInstanceTreeAllowedDropPositions,
  canDropInstanceTreeNode,
  handleInstanceTreeDrop,
} = useCdeInstanceOps({
  cardDoc,
  blueprintCardId: BLUEPRINT_CARD_ID,
  selectedCardId,
  selectedCardKeys,
  markDocumentChanged,
})

// 结构树与块编辑协议。
const {
  blockTree,
  selectedNode,
  selectedBlock,
  onTreeSelect,
  handleViewportBlockClick,
  clearSelection,
  handleTreeAction,
  handleTreeRename,
  canDropTreeNode,
  handleTreeDrop,
} = useCdeTreeOps({
  cardDoc,
  parentLookup,
  selectedBlockKeys,
  markDocumentChanged,
})

// 当前选择派生信息

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

function toggleInstancePanel() {
  isInstancePanelExpanded.value = !isInstancePanelExpanded.value
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
    const didResetOverride = resetInstanceOverrideField(selectedCard.value.data, block.id, fieldKey)
    if (!didResetOverride) {
      return
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

async function saveFile() {
  await saveDocumentFile()
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
