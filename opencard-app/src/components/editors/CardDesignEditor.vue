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
  <div ref="editorRootRef" class="card-design-editor" :style="editorShellStyle">
    <OcOverlay
      :inset="'var(--card-editor-overlay-inset-y) var(--card-editor-overlay-inset-x)'"
      :interactive="false"
    >
      <OcBox stack fill relative :pointer="panelPointerEvents">
        <CardViewport v-if="viewDoc" :document="viewDoc" :selected-block-id="selectedBlock?.id ?? null"
          :selected-location-type="selectedLocationType" :selected-anchor="selectedAnchor"
          :selected-parent-block-id="selectedParentBlockId" :transform-disabled-block-ids="transformDisabledBlockIds"
          @block-click="handleViewportBlockClick" @blank-click="clearSelection" @resize-selection="handleSelectionResize"
          @move-selection="handleSelectionMove" @viewport-transform-change="handleViewportTransformChange" />
        <OcEmptyHint v-else>无法解析 .opencard 文件</OcEmptyHint>
      </OcBox>
      <template #overlay>
        <OcAxisLayout axis="horizontal" :regions="overlayHorizontalRegions" fill :interactive="false">
          <template #left-cardtree>
            <OcFloatingPanelShell
              width="var(--card-editor-left-panel-width)"
              height="100%"
              :pointer-events="panelPointerEvents"
            >
              <OcPanelSection
                fill
                tone="overlay"
                :collapsed="!isInstancePanelExpanded"
                body-padding="var(--oc-space-1) 0"
                :scroll-body="true"
              >
                <template #title>
                  <span v-if="isInstancePanelExpanded">创建的卡牌</span>
                </template>
                <template #actions>
                  <OcToolButton
                    kind="panel"
                    icon-only
                    :icon="isInstancePanelExpanded ? 'codicon-chevron-left' : 'codicon-chevron-right'"
                    :title="isInstancePanelExpanded ? '收起侧栏' : '展开侧栏'"
                    :aria-label="isInstancePanelExpanded ? '收起侧栏' : '展开侧栏'"
                    @click="toggleInstancePanel"
                  />
                </template>
                <template #default>
                  <NodeTree v-if="isInstancePanelExpanded" title="创建的卡牌" :nodes="instanceTree" :expanded="true"
                    :selected-keys="selectedCardKeys" :actions="instanceTreeActions" :action-keys="instanceTreeActionKeys"
                    :allowed-drop-positions="getInstanceTreeAllowedDropPositions" :can-drop="canDropInstanceTreeNode"
                    @update:selected-keys="onInstanceTreeSelect" @action-called="handleInstanceTreeAction"
                    @node-rename="handleInstanceTreeRename" @node-drop="handleInstanceTreeDrop" />
                </template>
              </OcPanelSection>
            </OcFloatingPanelShell>
          </template>
          <template #xy-info>
            <OcBox inline height="100%" pointer="none" align="end">
              <OcBar kind="section" padding="0 0 12px 12px">
                <OcChip>
                  x: {{ Math.round(viewportTransform.x) }}, y: {{ Math.round(viewportTransform.y) }}, scale: {{ viewportTransform.scale.toFixed(2) }}
                </OcChip>
              </OcBar>
            </OcBox>
          </template>
          <template #center-spacer>
            <div />
          </template>
          <template #preview-panel>
            <OcBox inline height="100%" pointer="none" align="start">
              <OcFloatingPanelShell
                v-if="showTransformPreview && viewDoc"
                padding="sm"
                margin-top="calc(var(--card-editor-overlay-inset-y, 20px) - 6px)"
                pointer-events="none"
                aria-hidden="true"
              >
                <OcBar kind="section" padding="0 0 6px 0">
                  <OcChip tone="info">{{ t('panels.transformPreview') }}</OcChip>
                </OcBar>
                <OcBox relative overflow="hidden" :style="transformPreviewViewportStyle">
                  <OcSurface fill pattern="checker-preview" />
                  <OcBox absolute inset="0 auto auto 0" :style="transformPreviewShellStyle">
                    <OcBox :style="transformPreviewStageStyle">
                      <CardRenderer :document="viewDoc" />
                    </OcBox>
                  </OcBox>
                </OcBox>
              </OcFloatingPanelShell>
            </OcBox>
          </template>
          <template #right-structuretree>
            <div ref="rightPanelRef" :style="rightPanelShellStyle">
              <OcResizer
                orientation="vertical"
                variant="edge"
                dock="left"
                dock-offset="-14px"
                aria-label="调整右侧检查器宽度"
                :active="resizeState === 'right-panel'"
                @mousedown="startRightPanelResize"
              />

              <OcFloatingPanelShell width="100%" height="100%" :pointer-events="panelPointerEvents">
                <OcSplitPane
                  orientation="vertical"
                  fixedPane="primary"
                  fixedSize="var(--card-editor-tree-panel-height)"
                  primaryMinSize="140px"
                  secondaryMinSize="var(--card-editor-min-property-panel-height)"
                  clip
                  radius="lg"
                >
                  <template #primary>
                    <OcPanelSection
                      fill
                      title="结构树"
                      tone="overlay"
                      body-padding="var(--oc-space-1) 0"
                      :scroll-body="true"
                    >
                      <NodeTree title="模板结构" :nodes="blockTree" :selected-keys="selectedBlockKeys" :actions="treeActions"
                        v-model:expanded="blockTreeExpanded" :action-keys="treeActionKeys" :can-drop="canDropTreeNode"
                        @update:selected-keys="onTreeSelect" @action-called="handleTreeAction" @node-rename="handleTreeRename"
                        @node-drop="handleTreeDrop" />
                    </OcPanelSection>
                  </template>
                  <template #resizer>
                    <OcResizer
                      orientation="horizontal"
                      variant="edge"
                      aria-label="调整信息树高度"
                      :active="resizeState === 'tree-panel'"
                      @mousedown="startTreePanelResize"
                    />
                  </template>
                  <template #secondary>
                    <OcPanelSection fill title="属性" tone="overlay">
                      <template #actions>
                        <OcToolbar kind="panel" :shrink="false" aria-label="Property sort tools">
                          <OcToolButton
                            kind="panel"
                            icon-only
                            icon="codicon-list-tree"
                            :active="propertySortMode === 'category'"
                            title="Category"
                            aria-label="Category"
                            @click="propertySortMode = 'category'"
                          />
                          <OcToolButton
                            kind="panel"
                            icon-only
                            icon="codicon-symbol-string"
                            :active="propertySortMode === 'alphabetical'"
                            title="A-Z"
                            aria-label="A-Z"
                            @click="propertySortMode = 'alphabetical'"
                          />
                        </OcToolbar>
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
                  </template>
                </OcSplitPane>
              </OcFloatingPanelShell>
            </div>
          </template>
        </OcAxisLayout>
      </template>
    </OcOverlay>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import {
  prepareDocumentForRender,
  applyInstance,
  resolveReferences,
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
import { OcBox, OcSurface } from '../../shared/ui/primitives'
import CardRenderer from '../card/CardRenderer.vue'
import CardViewport from '../card/CardViewport.vue'
import NodeTree from '../ui/NodeTree.vue'
import PropertyEditor from './PropertyEditor.vue'
import OcAxisLayout from '../base/OcAxisLayout.vue'
import OcBar from '../base/OcBar.vue'
import OcChip from '../base/OcChip.vue'
import OcEmptyHint from '../base/OcEmptyHint.vue'
import OcFloatingPanelShell from '../base/OcFloatingPanelShell.vue'
import OcOverlay from '../base/OcOverlay.vue'
import OcPanelSection from '../base/OcPanelSection.vue'
import OcResizer from '../base/OcResizer.vue'
import OcSplitPane from '../base/OcSplitPane.vue'
import OcToolButton from '../base/OcToolButton.vue'
import OcToolbar from '../base/OcToolbar.vue'
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
const { t } = useI18n()

// 文档与编辑器状态
const blockTreeExpanded = ref(true)
const propertySortMode = ref<PropertySortMode>('category')
const isInstancePanelExpanded = ref(true)
const currentLeftPanelWidth = computed(() => (isInstancePanelExpanded.value ? 272 : 56))
const editorShellStyle = computed<CSSProperties>(() => ({
  display: 'flex',
  flex: '1 1 auto',
  width: '100%',
  height: '100%',
  minWidth: '0',
  minHeight: '0',
  position: 'relative',
  overflow: 'hidden',
  ...editorStyle.value,
  '--card-editor-overlay-inset-x': '24px',
  '--card-editor-overlay-inset-y': '20px',
  '--card-editor-center-safe-width': '420px',
  '--card-editor-left-panel-width-expanded': '272px',
  '--card-editor-left-panel-width-collapsed': '56px',
  '--card-editor-left-panel-width': `${currentLeftPanelWidth.value}px`,
}))
const viewportTransform = ref({
  x: 0,
  y: 0,
  scale: 1,
})
const overlayHorizontalRegions = [
  { slot: 'left-cardtree', track: 'auto' },
  { slot: 'xy-info', track: 'auto' },
  { slot: 'center-spacer', track: '*' },
  { slot: 'preview-panel', track: 'auto' },
  { slot: 'right-structuretree', track: 'var(--card-editor-right-panel-width)' },
]
const panelPointerEvents = computed<'auto' | 'none'>(() => (resizeState.value ? 'none' : 'auto'))
const rightPanelStyle = computed<CSSProperties>(() => ({
  pointerEvents: panelPointerEvents.value,
  ...(resizeState.value === 'right-panel' ? { willChange: 'width' } : {}),
}))
const rightPanelShellStyle = computed<CSSProperties>(() => ({
  width: '100%',
  height: '100%',
  minWidth: '0',
  minHeight: '0',
  position: 'relative',
  ...rightPanelStyle.value,
}))

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
  ['duplicate-selected', { key: 'duplicate-selected', icon: 'codicon-copy', title: '复制选中' }],
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
  ['duplicate', { key: 'duplicate', icon: 'codicon-copy', title: '复制' }],
  ['delete', { key: 'delete', icon: 'codicon-trash', title: '删除' }],
])
const treeActionKeys = ['add-root', 'duplicate-selected', 'delete-selected']
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
  canUndo,
  canRedo,
  markDocumentChanged,
  flushPendingChanges,
  undo: undoDocumentState,
  redo: redoDocumentState,
  loadRawDoc,
  saveFile: saveDocumentFile,
  dispose: disposeDocumentState,
} = useCdeDocumentState({
  emitModelValueUpdate: (content) => emit('update:modelValue', content),
  emitModified: (modified) => emit('modified', modified),
  emitSave: () => emit('save'),
  getDefaultDocumentName: () => t('fileTypes.opencard'),
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

  const projected = applyInstance(
    cardDoc.value,
    selectedCardId.value === BLUEPRINT_CARD_ID ? null : selectedCard.value ?? null,
  )
  const resolved = resolveReferences(projected)
  if (resolved.issues.length > 0) {
    console.warn('[cde] resolveReferences issues:', resolved.issues)
  }

  return prepareDocumentForRender(resolved.document)
})
const showTransformPreview = computed(() => Boolean(selectedBlock.value?.id) && Boolean(viewDoc.value))
const transformPreviewScale = computed(() => {
  const document = viewDoc.value
  if (!document) {
    return 1
  }

  const previewWidth = 220
  const previewHeight = 150
  return Math.min(
    previewWidth / document.width,
    previewHeight / document.height,
    1,
  )
})
const transformPreviewStageStyle = computed(() => {
  const document = viewDoc.value
  if (!document) {
    return {}
  }

  return {
    transform: `scale(${transformPreviewScale.value})`,
    transformOrigin: '0 0',
    lineHeight: '0',
    width: `${document.width}px`,
    height: `${document.height}px`,
  }
})
const transformPreviewShellStyle = computed(() => {
  const document = viewDoc.value
  if (!document) {
    return {}
  }

  return {
    width: `${document.width}px`,
    height: `${document.height}px`,
  }
})
const transformPreviewViewportStyle = computed(() => {
  const document = viewDoc.value
  if (!document) {
    return {}
  }

  return {
    width: `${Math.round(document.width * transformPreviewScale.value)}px`,
    height: `${Math.round(document.height * transformPreviewScale.value)}px`,
  }
})

function toggleInstancePanel() {
  isInstancePanelExpanded.value = !isInstancePanelExpanded.value
}

function handleViewportTransformChange(payload: { x: number; y: number; scale: number }) {
  viewportTransform.value = payload
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
    markDocumentChanged('typing')
    return
  }

  const block = selectedBlock.value
  if (!block) {
    return
  }

  if (selectedCardId.value !== BLUEPRINT_CARD_ID && selectedCard.value) {
    const instanceBlockData = selectedCard.value.data[block.id] ?? (selectedCard.value.data[block.id] = {})
    instanceBlockData[fieldKey] = value
    markDocumentChanged('typing')
    return
  }

  ; (block as Record<string, unknown>)[fieldKey] = value
  if (block.type === 'image-block' && fieldKey === 'image') {
    delete (block as Record<string, unknown>).imagePath
  }

  markDocumentChanged('typing')
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
    markDocumentChanged('action')
    return
  }

  const block = selectedBlock.value
  if (!block) {
    return
  }

  if (selectedCardId.value !== BLUEPRINT_CARD_ID && selectedCard.value) {
    const instanceBlockData = selectedCard.value.data[block.id] ?? (selectedCard.value.data[block.id] = {})
    instanceBlockData[fieldKey] = value
    markDocumentChanged('action')
    return
  }

  ; (block as Record<string, unknown>)[fieldKey] = value
  markDocumentChanged('action')
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
    markDocumentChanged('action')
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
    markDocumentChanged('action')
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
  markDocumentChanged('action')
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

  markDocumentChanged('action')
}

function handleSelectionMove(payload: { x: number; y: number }) {
  const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
  if (metadata?.location?.type !== 'simple-container-location') {
    return
  }

  metadata.location.x = formatViewportCssValue(payload.x)
  metadata.location.y = formatViewportCssValue(payload.y)
  markDocumentChanged('action')
}

async function saveFile() {
  await flushPendingChanges()
  await saveDocumentFile()
}

function ensureSelectionValidity() {
  if (selectedBlockKeys.value.length > 0 && !selectedNode.value) {
    selectedBlockKeys.value = []
  }

  if (selectedCardId.value !== BLUEPRINT_CARD_ID && !selectedCard.value) {
    selectedCardId.value = BLUEPRINT_CARD_ID
  }
}

async function undoFile() {
  await undoDocumentState()
  ensureSelectionValidity()
}

async function redoFile() {
  await redoDocumentState()
  ensureSelectionValidity()
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

defineExpose({
  save: saveFile,
  undo: undoFile,
  redo: redoFile,
  canUndo,
  canRedo,
})

onMounted(() => {
  mountPanelResizeListeners()
})

onUnmounted(() => {
  disposeDocumentState()
  unmountPanelResizeListeners()
})

</script>
