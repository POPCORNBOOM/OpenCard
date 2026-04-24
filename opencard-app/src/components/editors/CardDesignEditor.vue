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
    <OcOverlay :inset="'var(--card-editor-overlay-inset-y) var(--card-editor-overlay-inset-x)'" :interactive="false">
      <OcBox class="card-design-editor__viewport-host" stack fill relative :pointer="panelPointerEvents">
        <CardViewport v-if="viewDoc" class="card-design-editor__viewport" :document="viewDoc"
          :restore-key="props.filePath" :initial-transform="viewportTransform"
          :selected-block-id="selectedBlock?.id ?? null" :selected-location-type="selectedLocationType"
          :selected-anchor="selectedAnchor" :selected-parent-block-id="selectedParentBlockId"
          :transform-disabled-block-ids="transformDisabledBlockIds" @block-click="handleViewportBlockClick"
          @blank-click="clearSelection" @resize-selection="handleSelectionResize" @move-selection="handleSelectionMove"
          @viewport-transform-change="handleViewportTransformChange" />
        <OcEmptyHint v-else>无法解析 .opencard 文件</OcEmptyHint>
      </OcBox>
      <template #overlay>
        <OcAxisLayout class="card-design-editor__overlay-layout" axis="horizontal" :regions="overlayHorizontalRegions"
          fill :interactive="false">
          <template #left-cardtree>
            <OcSurface variant="glass" radius="lg" shadow="overlay" fill class="card-design-editor__floating-shell"
              :style="{ pointerEvents: panelPointerEvents }">
              <OcPanelSection fill tone="glass" :collapsed="!isInstancePanelExpanded" body-padding="var(--oc-space-1) 0"
                :scroll-body="true">
                <template #title>
                  <span v-if="isInstancePanelExpanded">创建的卡牌</span>
                </template>
                <template #actions>
                  <OcToolButton kind="panel" icon-only
                    :icon="isInstancePanelExpanded ? 'icon.chevron-left' : 'icon.chevron-right'"
                    :title="isInstancePanelExpanded ? '收起侧栏' : '展开侧栏'"
                    :aria-label="isInstancePanelExpanded ? '收起侧栏' : '展开侧栏'" @click="toggleInstancePanel" />
                </template>
                <template #default>
                  <NodeTree v-if="isInstancePanelExpanded" title="创建的卡牌" :nodes="instanceTree" :expanded="true"
                    :multi-select="false" :selected-keys="selectedCardKeys" :actions="instanceTreeActions"
                    :action-keys="instanceTreeActionKeys" :allowed-drop-positions="getInstanceTreeAllowedDropPositions"
                    :can-drop="canDropInstanceTreeNode" @update:selected-keys="onInstanceTreeSelect"
                    @action-called="handleInstanceTreeAction" @node-rename="handleInstanceTreeRename"
                    @node-drop="handleInstanceTreeDrop" />
                </template>
              </OcPanelSection>
            </OcSurface>
          </template>
          <template #left-position>
            <OcSurface variant="glass" radius="lg" shadow="overlay"
              class="card-design-editor__floating-shell card-design-editor__floating-shell--padding-sm">
              <OcText>

                x: {{ Math.round(viewportTransform.x) }}, y: {{ Math.round(viewportTransform.y) }}, scale: {{
                  viewportTransform.scale.toFixed(2) }}</OcText>
            </OcSurface>
          </template>
          <template #center-spacer>

          </template>
          <template #transform-preview>
            <OcSurface v-if="showTransformPreview && viewDoc" variant="glass" radius="lg" shadow="overlay"
              class="card-design-editor__floating-shell card-design-editor__floating-shell--padding-sm"
              :style="{ pointerEvents: 'none' }">
              <OcBar kind="section">
                <OcChip tone="info">{{ t('panels.transformPreview') }}</OcChip>
              </OcBar>
              <div class="transform-preview-viewport" :style="transformPreviewViewportStyle">
                <OcSurface fill pattern="checker-preview" />
                <div class="transform-preview-shell" :style="transformPreviewShellStyle">
                  <div class="transform-preview-stage" :style="transformPreviewStageStyle">
                    <CardRenderer :document="viewDoc" />
                  </div>
                </div>
              </div>
            </OcSurface>

          </template>
          <template #right-resizer>
            <OcResizer orientation="vertical" variant="edge" dock="left" dock-offset="-10px"
              :active="resizeState === 'right-panel'" @mousedown="startRightPanelResize" />
          </template>
          <template #right-structuretree>

            <OcSurface variant="glass" radius="lg" shadow="overlay" fill class="card-design-editor__floating-shell"
              :style="{ pointerEvents: panelPointerEvents }">
              <OcTrackLayout class="card-design-editor__right-split" axis="vertical" :regions="rightPanelTrackRegions"
                @resize-end="handleRightPanelTrackResizeEnd">
                <template #tree-panel>
                  <OcPanelSection fill title="结构树" tone="glass" body-padding="var(--oc-space-1) 0">
                    <NodeTree title="模板结构" :nodes="blockTree" :multi-select="false" :selected-keys="selectedBlockKeys"
                      :actions="treeActions" v-model:expanded="blockTreeExpanded" :action-keys="treeActionKeys"
                      :can-drop="canDropTreeNode" @update:selected-keys="onTreeSelect" @action-called="handleTreeAction"
                      @node-rename="handleTreeRename" @node-drop="handleTreeDrop" />
                  </OcPanelSection>
                </template>
                <template #property-panel>
                  <OcPanelSection fill title="属性" tone="glass" :scroll-body="true"
                    body-class="card-design-editor__property-scroll-body">
                    <template #actions>
                      <OcToolbar kind="panel" :shrink="false" aria-label="Property sort tools">
                        <OcToolButton kind="panel" icon-only icon="icon.list-tree"
                          :active="propertySortMode === 'category'" title="Category" aria-label="Category"
                          @click="propertySortMode = 'category'" />
                        <OcToolButton kind="panel" icon-only icon="icon.symbol-string"
                          :active="propertySortMode === 'alphabetical'" title="A-Z" aria-label="A-Z"
                          @click="propertySortMode = 'alphabetical'" />
                      </OcToolbar>
                    </template>

                    <PropertyEditor :inputs="propertyInputs" :sort-mode="propertySortMode"
                      @update-property="updateBlockProp" @add-property="addBlockProp"
                      @reset-property="resetBlockProp" />

                  </OcPanelSection>
                </template>
              </OcTrackLayout>
            </OcSurface>
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
  getBlockTreeIcon,
} from '../../entities/card/model'
import { OcBox, OcSurface } from '../../shared/ui/primitives'
import CardRenderer from '../card/CardRenderer.vue'
import CardViewport from '../card/CardViewport.vue'
import NodeTree from '../ui/NodeTree.vue'
import PropertyEditor from './PropertyEditor.vue'
import OcAxisLayout, { type AxisRegion } from '../base/OcAxisLayout.vue'
import OcBar from '../base/OcBar.vue'
import OcChip from '../base/OcChip.vue'
import OcEmptyHint from '../base/OcEmptyHint.vue'
import OcOverlay from '../base/OcOverlay.vue'
import OcPanelSection from '../base/OcPanelSection.vue'
import OcResizer from '../base/OcResizer.vue'
import OcTrackLayout from '../base/OcTrackLayout.vue'
import OcToolButton from '../base/OcToolButton.vue'
import OcToolbar from '../base/OcToolbar.vue'
import { useCdePanelResize } from '../../composables/useCdePanelResize'
import { useCdeDocumentState } from '../../composables/useCdeDocumentState'
import { useCdeInstanceOps } from '../../composables/useCdeInstanceOps'
import {
  useCdePropertyPanelState,
  type CdePropertySortMode,
} from '../../composables/useCdePropertyPanelState'
import { useCdeTreeOps } from '../../composables/useCdeTreeOps'
import type { OcTrackRegion } from '../../shared/ui/foundation/tokenRegistry'
import type { ActionDefinition } from '../../shared/ui/tree/tree.types'
import OcText from '../../shared/ui/primitives/OcText.vue'

// 蓝图实例固定 ID
const BLUEPRINT_CARD_ID = '__blueprint__'

// 组件输入输出
const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()

// 文档与编辑器状态
const blockTreeExpanded = ref(true)
const propertySortMode = ref<CdePropertySortMode>('category')
const isInstancePanelExpanded = ref(true)
const currentLeftPanelWidth = computed(() => (isInstancePanelExpanded.value ? 272 : 32))
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
  '--card-editor-center-safe-width': '0px',
  '--card-editor-center-track-min-width': '220px',
  '--oc-axis-layout-track-sidebar': 'minmax(0, var(--card-editor-left-panel-width))',
  '--oc-axis-layout-track-inspector': 'minmax(0, var(--card-editor-right-panel-width))',
  '--card-editor-left-panel-width-expanded': '272px',
  '--card-editor-left-panel-width-collapsed': '32px',
  '--card-editor-left-panel-width': `${currentLeftPanelWidth.value}px`,
}))
const DEFAULT_VIEWPORT_TRANSFORM = { x: 0, y: 0, scale: 1 }

const viewportTransform = ref({
  x: 0,
  y: 0,
  scale: 1,
})
const loadedFilePath = ref<string | null>(null)
const overlayHorizontalRegions: AxisRegion[] = [
  { slot: 'left-cardtree', track: 'auto' },
  { slot: 'left-position', track: 'auto' },
  { slot: 'center-spacer', track: 'fill' },
  { slot: 'transform-preview', track: 'auto' },
  { slot: 'right-resizer', track: 'auto' },
  { slot: 'right-structuretree', track: 'size-3xl' },
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
  editorStyle,
  resizeState,
  startRightPanelResize,
  mountPanelResizeListeners,
  unmountPanelResizeListeners,
} = useCdePanelResize()

const rightPanelTrackRegions = ref<OcTrackRegion[]>([
  {
    slot: 'tree-panel',
    size: 'workspace-tree',
    min: 'panel-sm',
    resizable: true,
    resizerAriaLabel: '调整信息树高度',
  },
  {
    slot: 'property-panel',
    size: 'fill',
    min: 'panel-md',
  },
])

function handleRightPanelTrackResizeEnd(payload: { index: number; size: string }) {
  if (payload.index !== 0) {
    return
  }

  const root = editorRootRef.value
  if (root) {
    root.style.setProperty('--card-editor-tree-panel-height', payload.size)
  }
}

// 结构树操作定义
const treeActions = new Map<string, ActionDefinition>([
  ['add-root', {
    key: 'add-root',
    icon: 'icon.add',
    title: '添加',
    children: [
      { key: 'add-text-block', icon: getBlockTreeIcon('text-block'), title: '文本块' },
      { key: 'add-image-block', icon: getBlockTreeIcon('image-block'), title: '图片块' },
      { key: 'add-simple-container-block', icon: getBlockTreeIcon('simple-container-block'), title: '简单容器' },
      { key: 'add-flow-container-block', icon: getBlockTreeIcon('flow-container-block'), title: '流式容器' },
    ],
  }],
  ['duplicate-selected', { key: 'duplicate-selected', icon: 'icon.copy', title: '复制选中' }],
  ['delete-selected', { key: 'delete-selected', icon: 'icon.trash', title: '删除选中' }],
  ['add', {
    key: 'add',
    icon: 'icon.add',
    title: '添加',
    children: [
      { key: 'add-text-block', icon: getBlockTreeIcon('text-block'), title: '文本块' },
      { key: 'add-image-block', icon: getBlockTreeIcon('image-block'), title: '图片块' },
      { key: 'add-simple-container-block', icon: getBlockTreeIcon('simple-container-block'), title: '简单容器' },
      { key: 'add-flow-container-block', icon: getBlockTreeIcon('flow-container-block'), title: '流式容器' },
    ],
  }],
  ['duplicate', { key: 'duplicate', icon: 'icon.copy', title: '复制' }],
  ['delete', { key: 'delete', icon: 'icon.trash', title: '删除' }],
])
const treeActionKeys = ['add-root', 'duplicate-selected', 'delete-selected']
const instanceTreeActions = new Map<string, ActionDefinition>([
  ['add-instance', { key: 'add-instance', icon: 'icon.add', title: '新建实例' }],
  ['duplicate-instance', { key: 'duplicate-instance', icon: 'icon.copy', title: '复制' }],
  ['delete-instance', { key: 'delete-instance', icon: 'icon.trash', title: '删除' }],
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
  documentRevision,
  parentLookup,
  canUndo,
  canRedo,
  markDocumentChanged,
  refreshDocumentState,
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
  documentRevision,
  refreshDocumentState,
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
  documentRevision,
  parentLookup,
  selectedBlockKeys,
  refreshDocumentState,
  markDocumentChanged,
})

// 当前选择派生信息
const {
  propertyInputs,
  updateProperty: updateBlockProp,
  addProperty: addBlockProp,
  resetProperty: resetBlockProp,
} = useCdePropertyPanelState({
  selectedNode,
  selectedBlock,
  selectedCard,
  selectedCardId,
  documentRevision,
  blueprintCardId: BLUEPRINT_CARD_ID,
  refreshDocumentState,
  markDocumentChanged,
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

// Build the render/view document by projecting the selected instance onto the blueprint document.
const viewDoc = computed<CardDocument | null>(() => {
  documentRevision.value
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
  emit('update-viewport-transform', payload)
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

  refreshDocumentState()
  markDocumentChanged('action')
}

function handleSelectionMove(payload: { x: number; y: number }) {
  const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
  if (metadata?.location?.type !== 'simple-container-location') {
    return
  }

  metadata.location.x = formatViewportCssValue(payload.x)
  metadata.location.y = formatViewportCssValue(payload.y)
  refreshDocumentState()
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
  () => [props.filePath, props.modelValue] as const,
  ([nextFilePath, nextValue]) => {
    const content = nextValue ?? ''
    if (!content) {
      return
    }

    const fileChanged = nextFilePath !== loadedFilePath.value
    if (!fileChanged && content === rawContent.value) {
      return
    }

    loadedFilePath.value = nextFilePath
    viewportTransform.value = props.viewportTransform ?? DEFAULT_VIEWPORT_TRANSFORM
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

<style scoped>
.card-design-editor__viewport-host {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.card-design-editor__viewport {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.card-design-editor__overlay-layout {
  min-width: 0;
  min-height: 0;
}

.card-design-editor__right-split {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.card-design-editor__floating-shell {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--oc-border-overlay-soft);
  background: var(--oc-bg-overlay-soft);
  backdrop-filter: blur(14px);
}

.card-design-editor__floating-shell--padding-sm {
  padding: var(--oc-space-2);
}

.card-design-editor__center-track {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.card-design-editor__center-hud {
  position: absolute;
  z-index: 1;
  pointer-events: none;
}

.card-design-editor__center-hud--xy {
  left: 0;
  bottom: 0;
}

.card-design-editor__center-hud--preview {
  top: 0;
  right: 0;
}

.transform-preview-viewport {
  position: relative;
  overflow: hidden;
}

.transform-preview-shell {
  position: absolute;
  inset: 0 auto auto 0;
}

.transform-preview-stage {
  line-height: 0;
}

/* CDE: layer + track-width safeguards for overlay side panes */
.card-design-editor {
  --oc-axis-layout-track-sidebar: var(--card-editor-left-panel-width, 272px);
  --oc-axis-layout-track-inspector: var(--card-editor-right-panel-width, 320px);
  --card-editor-overlay-xy-track-width: 160px;
  --card-editor-overlay-preview-track-width: 260px;
  --card-editor-center-safe-width: 0px !important;
}

.card-design-editor .oc-overlay__base {
  position: relative;
  z-index: 0;
}

.card-design-editor .oc-overlay__layer {
  z-index: 2;
}

.card-design-editor__overlay-layout :deep(.oc-axis-layout__region[data-slot='center-spacer']),
.card-design-editor__overlay-layout :deep(.oc-axis-layout__region--slot-center-spacer) {
  min-width: 0 !important;
}

.card-design-editor__center-hud--xy {
  width: var(--card-editor-overlay-xy-track-width);
}

.card-design-editor__center-hud--preview {
  width: var(--card-editor-overlay-preview-track-width);
}

.card-design-editor__overlay-layout :deep(.oc-axis-layout__region[data-slot='left-cardtree']),
.card-design-editor__overlay-layout :deep(.oc-axis-layout__region--slot-left-cardtree),
.card-design-editor__overlay-layout :deep(.oc-axis-layout__region[data-slot='right-structuretree']),
.card-design-editor__overlay-layout :deep(.oc-axis-layout__region--slot-right-structuretree) {
  position: relative;
  z-index: 1;
}
</style>
