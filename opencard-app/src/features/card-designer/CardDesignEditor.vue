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
  <div ref="editorRootRef" class="card-design-editor" :style="editorShellStyle" tabindex="-1"
    @keydown="handleRootKeydown">
    <div
      class="card-design-editor__stage"
      :class="{ 'is-layer-view-active': layerViewActive }"
    >
      <Transition name="card-designer-view-fade">
        <div :key="workspaceMode" class="card-design-editor__mode-view">
          <div v-if="workspaceMode === 'design'" class="card-design-editor__stage-base">
        <OcPanel fill tone="transparent" border="none" padding="none" overflow="hidden">
        <CardViewport ref="cardViewportRef" v-if="viewFace" class="card-design-editor__viewport" :face="viewFace"
          :clip-to-face="clipToFace"
          :resource-root-path="props.resourceRootPath"
          :remote-resource-policy="props.remoteResourcePolicy"
          :project-icon-catalog="projectStore.renderEnvironment.value.projectIconCatalog"
          :restore-key="props.filePath" :transform="viewportTransform"
          :selected-block-id="selectedBlock?.id ?? null" :selected-location-type="selectedLocationType"
          :selected-anchor="selectedAnchor" :selected-parent-block-id="selectedParentBlockId"
          :selected-parent-flow-direction="selectedParentFlowDirection"
          :selected-flow-align="selectedFlowAlign"
          :selection-info="selectionInfo"
          :selection-action-labels="selectionActionLabels"
          :selection-command-actions="selectionCommandActions"
          :layer-view-active="layerViewActive"
          :layer-view-base-plane-label="t('cardDesigner.layerView.basePlane')"
          :space-modifier-active="spaceHeld"
          :layer-view-shortcut-legend-label="t('cardDesigner.layerView.shortcutLegend')"
          :layer-view-shortcut-hints="layerViewShortcutHints"
          :show-info="!selectedBlock"
          :show-position-on-move="props.showSelectionPositionOnMove ?? true"
          :show-size-on-resize="props.showSelectionSizeOnResize ?? true"
          :alignment-snapping-enabled="alignmentSnappingEnabled"
          :transform-disabled-block-ids="transformDisabledBlockIds"
          @pointerdown.capture="handleCanvasPointerDown"
          @block-click="handleViewportBlockClick"
          @blank-click="clearSelection" @resize-selection="handleSelectionResize" @move-selection="handleSelectionMove"
          @selection-action="handleSelectionAction"
          @selection-command="handleSelectionCommand"
          @z-index-step="handleLayerZIndexStep"
          @face-dimension-change="handleFaceDimensionChange"
          @viewport-transform-change="handleViewportTransformChange"
          @viewport-size-change="handleViewportSizeChange">
          <template #info>
            <section class="card-design-editor__card-info" :aria-label="t('cardDesigner.info.title')">
              <span v-for="item in viewportCardInfo" :key="item.key"
                :class="{
                  'is-highlighted': highlightedInfoKeys.has(item.key),
                  'is-group-separated': item.separated,
                  'is-multiline': item.multiline,
                }" :data-tooltip="item.value">
                {{ item.value }}
              </span>
            </section>
          </template>
          <template #left-info>
            <span class="card-design-editor__dimension-info"
              :class="{ 'is-highlighted': highlightedInfoKeys.has('height') }">
              {{ viewportCardDimensions.height }}
            </span>
          </template>
          <template #bottom-info>
            <span class="card-design-editor__dimension-info"
              :class="{ 'is-highlighted': highlightedInfoKeys.has('width') }">
              {{ viewportCardDimensions.width }}
            </span>
          </template>
        </CardViewport>
        <OcEmpty v-else>无法解析 .ocdocument 文件</OcEmpty>
        </OcPanel>
      </div>

      <CardDataTable
        v-else
        ref="cardDataTableRef"
        :columns="dataTableColumns"
        :catalog-face-groups="dataTableCatalogFaceGroups"
        :face-groups="dataTableFaceGroups"
        :binding-interpreter="propertyBindingInterpreter"
        :get-cell-definition="getDataTableCellDefinition"
        @add-instance="createInstance"
        @rename-instance="renameInstance"
        @duplicate-card="duplicateDataTableCard"
        @delete-instance="deleteInstance"
        @set-instance-exported="setDataTableInstanceExported"
        @add-block="includeDataTableBlock"
        @remove-block="removeDataTableBlock"
        @include-field="includeDataTableField"
        @exclude-field="excludeDataTableField"
        @create-field="openDataTableFieldDialog"
        @delete-field="deleteDataTableField"
        @update-cell="updateDataTableCell"
        @reset-cell="resetDataTableCell"
      />

      <div v-if="workspaceMode === 'design'" class="card-design-editor__stage-layer"
        :class="{ 'is-sidebar-width-resizing': isSidebarWidthResizing }">
        <div class="card-design-editor__overlay-layout">
          <aside
            ref="leftSidebarRef"
            class="card-design-editor__sidebar card-design-editor__sidebar--left"
            :class="{
              'is-collapsed': isLeftSidebarCollapsed,
            }"
          >
            <div class="card-design-editor__sidebar-panel">
              <OcCard fill variant="glass" title="卡牌树" :actions="instanceCardActions"
                :collapsed="!isInstancePanelExpanded"
                @action="handleInstanceCardAction">
                <OcPanel fill tone="transparent" border="none" padding="none" overflow="auto"
                  align="stretch">

                  <OcTree v-if="isInstancePanelExpanded" ref="instanceTreeRef" fill role="listbox"
                    :data="instanceTreeData" :actions="treeActions"
                    :selected-keys="selectedCardKeys" selection-mode="single"
                    @intent="handleInstanceTreeIntent" />
                </OcPanel>
              </OcCard>
            </div>

            <div
              v-if="canResizeLeftSidebar"
              class="card-design-editor__resizebar card-design-editor__resizebar--horizontal"
              :class="{ 'is-active': activeResizeTarget === 'left-stack' }"
              role="separator"
              aria-orientation="horizontal"
              aria-label="调整卡牌树与预览高度"
              tabindex="0"
              @mousedown="startSidebarResize('left', $event)"
            >
              <span class="card-design-editor__resizebar-visual" aria-hidden="true" />
            </div>

            <div class="card-design-editor__sidebar-panel">
              <OcCard fill variant="glass" title="预览" :actions="previewCardActions"
                :collapsed="!isPreviewPanelExpanded" @action="handlePreviewCardAction">
                <OcPanel align="stretch" fill radius="none" tone="transparent" border="none"
                  shadow="lg" padding="none">
                  <div ref="transformPreviewHostRef" class="card-design-editor__transform-preview-host"
                    @wheel.prevent.stop="handlePreviewViewportWheel">
                    <div ref="transformPreviewViewportRef" class="card-design-editor__transform-preview-viewport"
                      :style="transformPreviewViewportStyle">
                      <CardFaceRenderer v-if="viewFace" :face="viewFace" :clip-to-face="true"
                        :resource-root-path="props.resourceRootPath"
                        :remote-resource-policy="props.remoteResourcePolicy"
                        :project-icon-catalog="projectStore.renderEnvironment.value.projectIconCatalog"
                        :style="transformPreviewRendererStyle" />
                      <button v-if="transformPreviewFrameStyle" type="button"
                        class="card-design-editor__transform-preview-frame"
                        :class="{
                          'is-visible': isTransformPreviewFrameVisible,
                          'is-dragging': isPreviewViewportDragging,
                        }"
                        :style="transformPreviewFrameStyle" aria-label="移动画布视口"
                        :aria-hidden="!isTransformPreviewFrameVisible || undefined"
                        :tabindex="isTransformPreviewFrameVisible ? 0 : -1"
                        @keydown="handlePreviewViewportKeydown" @pointerdown="startPreviewViewportDrag"
                        @pointermove="handlePreviewViewportDrag"
                        @pointerup="stopPreviewViewportDrag"
                        @pointercancel="stopPreviewViewportDrag" />
                    </div>
                  </div>
                </OcPanel>
              </OcCard>
            </div>
          </aside>

          <div
            class="card-design-editor__resizebar card-design-editor__resizebar--vertical"
            :class="{
              'is-active': activeResizeTarget === 'left-width',
              'is-sidebar-collapsed': isLeftSidebarCollapsed,
            }"
            role="separator"
            aria-orientation="vertical"
            aria-label="调整左侧栏宽度"
            tabindex="0"
            @mousedown="startOverlayResize('left', $event)"
            @keydown.enter.prevent="toggleSidebarMinimumWidth('left')"
            @keydown.space.prevent="toggleSidebarMinimumWidth('left')"
          >
            <span class="card-design-editor__resizebar-visual" aria-hidden="true" />
          </div>

          <div ref="centerSpacerRef" class="card-design-editor__center-spacer" aria-hidden="true" />

          <div
            class="card-design-editor__resizebar card-design-editor__resizebar--vertical"
            :class="{
              'is-active': activeResizeTarget === 'right-width',
              'is-sidebar-collapsed': isRightSidebarCollapsed,
            }"
            role="separator"
            aria-orientation="vertical"
            aria-label="调整右侧栏宽度"
            tabindex="0"
            @mousedown="startOverlayResize('right', $event)"
            @keydown.enter.prevent="toggleSidebarMinimumWidth('right')"
            @keydown.space.prevent="toggleSidebarMinimumWidth('right')"
          >
            <span class="card-design-editor__resizebar-visual" aria-hidden="true" />
          </div>

          <aside
            ref="rightSidebarRef"
            class="card-design-editor__sidebar card-design-editor__sidebar--right"
            :class="{
              'is-collapsed': isRightSidebarCollapsed,
            }"
          >
            <div class="card-design-editor__sidebar-panel">
              <OcCard fill variant="glass" title="结构树" :actions="structureTreeCardActions"
                :collapsed="!isStructureTreePanelExpanded"
                @action="handleStructureTreeCardAction">
                <OcPanel align="stretch" fill tone="transparent" border="none" padding="none"
                  overflow="auto">
                  <OcTree ref="structureTreeRef" fill :data="blockTreeData" :actions="treeActions"
                    :selected-keys="selectedBlockKeys" :expanded-keys="expandedBlockKeys"
                    :selection-expansion-mode="forceStructureTreeReveal
                      ? 'expand'
                      : props.structureTreeSelectionBehavior ?? 'expand-exclusive'"
                    :scroll-to-selection="forceStructureTreeReveal || (props.structureTreeScrollToSelection ?? true)"
                    selection-mode="single" activation-mode="double-click"
                    @intent="handleStructureTreeIntent" />
                </OcPanel>
              </OcCard>
            </div>

            <div
              v-if="canResizeRightSidebar"
              class="card-design-editor__resizebar card-design-editor__resizebar--horizontal"
              :class="{ 'is-active': activeResizeTarget === 'right-stack' }"
              role="separator"
              aria-orientation="horizontal"
              aria-label="调整结构树与属性高度"
              tabindex="0"
              @mousedown="startSidebarResize('right', $event)"
            >
              <span class="card-design-editor__resizebar-visual" aria-hidden="true" />
            </div>

            <div class="card-design-editor__sidebar-panel">
              <OcCard fill variant="glass" title="属性" :actions="propertyCardActions"
                :collapsed="!isPropertyPanelExpanded"
                @action="handlePropertyCardAction">
                <OcPanel fill tone="transparent" border="none" padding="none" overflow="auto">
                  <PropertyEditor ref="propertyEditorRef" :inputs="propertyEditorInputs"
                    :categories="propertyCategories" :sort-mode="propertySortMode"
                    :binding-interpreter="propertyBindingInterpreter"
                    :delete-mode="propertyDeleteMode"
                    @update-property="updateBlockProp" @add-property="addBlockProp"
                    @reset-property="resetBlockProp"
                    @delete-property="deleteProperty" />
                </OcPanel>
              </OcCard>
            </div>
          </aside>
        </div>

        <OcOverlayToolbar v-if="viewFace" class="card-design-editor__face-tools" orientation="vertical"
          :class="{ 'is-right-sidebar-collapsed': isRightSidebarCollapsed }">
          <OcViewportControls
            class="card-design-editor__viewport-controls"
            orientation="vertical"
            embedded
            button-size="sm"
            icon-size="action"
            aria-label="卡牌画布缩放控制"
            :scale-label="viewportScaleLabel"
            @zoom-out="zoomViewportOut"
            @reset="fitViewport"
            @zoom-in="zoomViewportIn"
          />
          <span class="card-design-editor__face-tools-divider" aria-hidden="true" />
          <OcActionButton
            :action="alignmentSnappingAction"
            size="sm"
            icon-size="action"
            :variant="alignmentSnappingEnabled ? 'soft' : 'ghost'"
            @select="toggleAlignmentSnapping"
          />
          <OcActionButton
            :action="clipAction"
            size="sm"
            icon-size="action"
            :variant="clipToFace ? 'soft' : 'ghost'"
            @select="toggleFaceClip"
          />
          <OcActionButton
            :action="faceSwitchAction"
            size="sm"
            icon-size="action"
            variant="ghost"
            @select="toggleActiveFace"
          />
        </OcOverlayToolbar>
      </div>
        </div>
      </Transition>
    </div>

    <AdditionalFieldCreateDialog
      :open="additionalFieldCreateDialogOpen"
      :field-types="additionalFieldTypeOptions"
      :field-type="additionalFieldCreateDraft.fieldType"
      :field-key="additionalFieldCreateDraft.fieldKey"
      :title="additionalFieldCreateDraft.title"
      :error-text="additionalFieldCreateErrorText"
      :invalid="Boolean(additionalFieldCreateError)"
      @update-field-type="updateAdditionalFieldType"
      @update-field-key="updateAdditionalFieldKey"
      @update-title="updateAdditionalFieldTitle"
      @close="closeAdditionalFieldDialog"
      @submit="submitAdditionalFieldDialog"
    />
    <DataTableWorkbookImportDialog
      :result="pendingDataTableWorkbookImport"
      @cancel="cancelDataTableWorkbookImport"
      @confirm="confirmDataTableWorkbookImport"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../editor-runtime/registry/editorRegistry'
import type { SessionNavigationToken } from '../editor-runtime/model/editorIssue'
import {
  getCardFieldDefinition,
  type CardBlock,
  type CardFaceKey,
  type FlowDirection,
} from '../../entities/card/model'
import { getBlockPresentation } from './blockPresentation'
import OcPanel from '../../components/base/OcPanel.vue'
import CardFaceRenderer from '../card-rendering/components/CardFaceRenderer.vue'
import CardViewport, {
  type CardViewportSelectionActionLabels,
  type CardViewportSelectionCommand,
  type CardViewportSelectionInfo,
} from '../card-rendering/components/CardViewport.vue'
import { buildCardLayerGroups } from '../card-rendering/components/cardLayerModel'
import PropertyEditor from '../../shared/ui/property-editor/PropertyEditor.vue'
import AdditionalFieldCreateDialog from '../../shared/ui/property-editor/AdditionalFieldCreateDialog.vue'
import OcEmpty from '../../components/base/OcEmpty.vue'
import OcTree from '../../components/standard/OcTree.vue'
import OcViewportControls from '../../components/standard/OcViewportControls.vue'
import OcActionButton, { type OcActionButtonAction } from '../../components/standard/OcActionButton.vue'
import OcOverlayToolbar from '../../components/standard/OcOverlayToolbar.vue'
import { useCdeDocumentState } from './useCdeDocumentState'
import { useCdeInstanceOps } from './useCdeInstanceOps'
import { useCdeOverlayLayout } from './useCdeOverlayLayout'
import { useCdePropertyEditorProjection } from './useCdePropertyEditorProjection'
import { useCdeDataTableCellProjection } from './useCdeDataTableCellProjection'
import {
  useCdePropertyPanelState,
  type CdeAdditionalFieldType,
  type CdePropertySortMode,
} from './useCdePropertyPanelState'
import { useCdeTreeOps } from './useCdeTreeOps'
import CardDataTable from './CardDataTable.vue'
import DataTableWorkbookImportDialog from './DataTableWorkbookImportDialog.vue'
import { useCdeDataTableModel } from './useCdeDataTableModel'
import { useCdeDataTableCommands } from './useCdeDataTableCommands'
import { useCdeDataTableWorkbook } from './useCdeDataTableWorkbook'
import { useCdeRenderProjection } from './useCdeRenderProjection'
import {
  useCdeViewportController,
  type CdeViewportPort,
} from './useCdeViewportController'
import { useCdeSelectionCommands } from './useCdeSelectionCommands'
import {
  useCdeLayerViewInteraction,
  type CdeLayerViewPort,
} from './useCdeLayerViewInteraction'
import {
  useCdeBlockFieldCommands,
} from './useCdeBlockFieldCommands'
import type { OcTreeActionDefinition, OcTreeIntent } from '../../shared/ui/tree/tree.types'
import { isBlockContainer } from '../../entities/card/tree'
import OcCard, { type OcCardAction } from '../../components/standard/OcCard.vue'
import type { CardDesignerViewState } from '../editor-runtime/model/editorUiState'
import { createCardDesignerIssueSnapshot } from './cardDesignerIssues'
import { isBindingExpression } from '../editor-runtime/model/binding'
import type { FilePathDirectoryProvider } from '../../shared/model/filePath'
import { useProjectStore } from '../workspace/store/projectStore'
import { fileSystemService } from '../workspace/services/fileSystemService'
import {
  getEditorResourceRelativePath,
  resolveEditorResourcePath,
} from '../editor-runtime/services/editorResource'
import {
  isCardDesignerNavigationToken,
  type CardDesignerNavigationResult,
  type CardDesignerNavigationToken,
} from './cardDesignerNavigation'

// 蓝图实例固定 ID
const BLUEPRINT_CARD_ID = '__blueprint__'
const EDIT_RICH_TEXT_ACTION_KEY = 'content.edit-rich-text'
const FLOW_DIRECTION_ACTIONS = [
  { key: 'flow.direction.left', direction: 'rl', icon: 'nav.arrow-left', titleKey: 'flowLeft' },
  { key: 'flow.direction.up', direction: 'bt', icon: 'nav.arrow-up', titleKey: 'flowUp' },
  { key: 'flow.direction.down', direction: 'tb', icon: 'nav.arrow-down', titleKey: 'flowDown' },
  { key: 'flow.direction.right', direction: 'lr', icon: 'nav.arrow-right', titleKey: 'flowRight' },
] as const satisfies readonly {
  key: string
  direction: FlowDirection
  icon: OcActionButtonAction['icon']
  titleKey: string
}[]

// 组件输入输出
const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t, te, locale } = useI18n()
const projectStore = useProjectStore()
const propertyBindingInterpreter = { isExpression: isBindingExpression }

const editorRootRef = ref<HTMLElement | null>(null)
const {
  activeResizeTarget,
  canResizeLeftSidebar,
  canResizeRightSidebar,
  editorShellStyle,
  ensurePanelsExpanded,
  isInstancePanelExpanded,
  isLeftSidebarCollapsed,
  isPreviewPanelExpanded,
  isPropertyPanelExpanded,
  isRightSidebarCollapsed,
  isSidebarWidthResizing,
  isStructureTreePanelExpanded,
  leftSidebarRef,
  rightSidebarRef,
  startOverlayResize,
  startSidebarResize,
  togglePanel,
  toggleSidebarMinimumWidth,
} = useCdeOverlayLayout({
  layout: toRef(props, 'cardDesignerLayout'),
  rootElement: editorRootRef,
  commitLayout: layout => emit('update-card-designer-layout', layout),
})

// 文档与编辑器状态
const propertySortMode = ref<CdePropertySortMode>('category')
const propertyDeleteMode = ref(false)
const workspaceMode = computed(() => props.cardDesignerMode ?? 'design')
const dataTableCustomFieldTargetBlockId = ref<string | null>(null)
const activeFaceKey = ref<CardFaceKey>(props.cardDesignerView?.activeFace ?? 'front')
const clipToFace = ref(props.cardDesignerView?.clipToFace ?? false)
const alignmentSnappingEnabled = ref(
  props.cardDesignerView?.alignmentSnappingEnabled
    ?? props.alignmentSnappingEnabledByDefault
    ?? true,
)

function createViewState(): CardDesignerViewState {
  return {
    activeFace: activeFaceKey.value,
    clipToFace: clipToFace.value,
    alignmentSnappingEnabled: alignmentSnappingEnabled.value,
    selectedInstanceId: selectedCardId.value === BLUEPRINT_CARD_ID
      ? null
      : selectedCardId.value,
  }
}

function commitViewState(): void {
  emit('update-card-designer-view', createViewState())
}

const clipAction = computed<OcActionButtonAction>(() => ({
  key: 'toggle-face-clip',
  icon: clipToFace.value ? 'tool.box-cutter' : 'tool.box-cutter-off',
  iconTone: clipToFace.value ? 'active' : 'default',
  title: clipToFace.value
    ? t('cardDesigner.view.disableClip')
    : t('cardDesigner.view.enableClip'),
}))

const alignmentSnappingAction = computed<OcActionButtonAction>(() => ({
  key: 'toggle-alignment-snapping',
  icon: alignmentSnappingEnabled.value ? 'tool.snap-grid-on' : 'tool.snap-grid',
  iconTone: alignmentSnappingEnabled.value ? 'active' : 'default',
  title: alignmentSnappingEnabled.value
    ? t('cardDesigner.view.disableAlignmentSnapping')
    : t('cardDesigner.view.enableAlignmentSnapping'),
}))

const faceSwitchAction = computed<OcActionButtonAction>(() => ({
  key: 'switch-face',
  icon: activeFaceKey.value === 'front'
    ? 'tool.flip-to-front'
    : 'tool.flip-to-back',
  title: activeFaceKey.value === 'front'
    ? t('cardDesigner.view.switchToBack')
    : t('cardDesigner.view.switchToFront'),
}))
function toggleFaceClip(): void {
  clipToFace.value = !clipToFace.value
  commitViewState()
}

function toggleAlignmentSnapping(): void {
  alignmentSnappingEnabled.value = !alignmentSnappingEnabled.value
  commitViewState()
}

function toggleActiveFace(): void {
  activeFaceKey.value = activeFaceKey.value === 'front' ? 'back' : 'front'
  selectedBlockKeys.value = []
  forceStructureTreeReveal.value = false
  commitViewState()
}

type CardViewportHandle = CdeViewportPort & CdeLayerViewPort

type PropertyEditorHandle = {
  revealField: (inputKey: string, fieldKey: string, characterOffset?: number) => Promise<boolean>
  activateField: (inputKey: string, fieldKey: string) => Promise<boolean>
}

type CardDataTableHandle = {
  revealCell: (
    cardId: string,
    blockId: string,
    fieldKey: string,
    characterOffset?: number,
  ) => Promise<boolean>
}

const cardViewportRef = ref<CardViewportHandle | null>(null)
const propertyEditorRef = ref<PropertyEditorHandle | null>(null)
const cardDataTableRef = ref<CardDataTableHandle | null>(null)
const instanceTreeRef = ref<{ beginRename: (key: string) => Promise<void> } | null>(null)
const structureTreeRef = ref<{ beginRename: (key: string) => Promise<void> } | null>(null)
const loadedFilePath = ref<string | null>(null)

// 结构树操作定义
const treeActions = new Map<string, OcTreeActionDefinition>([
  ['instance-more', {
    icon: 'nav.more',
    title: '更多操作',
    children: ['rename', 'duplicate-instance', 'delete-instance'],
  }],
  ['block-more', {
    icon: 'nav.more',
    title: '更多操作',
    children: ['rename', 'duplicate', 'delete'],
  }],
  ['container-more', {
    icon: 'nav.more',
    title: '更多操作',
    children: ['rename', 'add', 'duplicate', 'delete'],
  }],
  ['add-root', {
    icon: 'action.add',
    title: '添加',
    children: ['add-text-block', 'add-markdown-text-block', 'add-image-block', 'add-qrcode-block', 'add-shape-block', 'add-simple-container-block', 'add-flow-container-block'],
  }],
  ['duplicate-selected', { icon: 'action.copy', title: '复制选中' }],
  ['delete-selected', { icon: 'action.delete', title: '删除选中' }],
  ['add', {
    icon: 'action.add',
    title: '添加子块',
    children: ['add-text-block', 'add-markdown-text-block', 'add-image-block', 'add-qrcode-block', 'add-shape-block', 'add-simple-container-block', 'add-flow-container-block'],
  }],
  ['add-text-block', { ...getBlockPresentation('text-block'), title: '文本块' }],
  ['add-markdown-text-block', { ...getBlockPresentation('markdown-text-block'), title: 'Markdown 文本块' }],
  ['add-image-block', { ...getBlockPresentation('image-block'), title: '图片块' }],
  ['add-qrcode-block', { ...getBlockPresentation('qrcode-block'), title: '二维码' }],
  ['add-shape-block', { ...getBlockPresentation('shape-block'), title: '形状' }],
  ['add-simple-container-block', { ...getBlockPresentation('simple-container-block'), title: '简单容器' }],
  ['add-flow-container-block', { ...getBlockPresentation('flow-container-block'), title: '流式容器' }],
  ['duplicate', { icon: 'action.copy', title: '复制' }],
  ['delete', { icon: 'action.delete', title: '删除' }],
  ['rename', { icon: 'action.edit', title: '重命名' }],
  ['hide-block', { icon: 'status.eye', title: '隐藏' }],
  ['show-block', { icon: 'status.eye-off', title: '显示' }],
  ['duplicate-instance', { icon: 'action.copy', title: '复制实例' }],
  ['delete-instance', { icon: 'action.delete', title: '删除实例' }],
])
const treeActionKeys = ['add-root', 'duplicate-selected', 'delete-selected']

function toCardActionDefinition(actionKey: string, disabled = false): OcCardAction | null {
  const action = treeActions.get(actionKey)
  if (!action) return null
  return {
    key: actionKey,
    icon: action.icon,
    iconTone: action.iconTone,
    title: action.title,
    disabled,
    children: action.children
      ?.map((childKey) => toCardActionDefinition(childKey))
      .filter((child): child is OcCardAction => child !== null),
  }
}

function createPanelToggleAction(key: string, expanded: boolean): OcCardAction {
  return {
    key,
    icon: expanded ? 'nav.chevron-down' : 'nav.chevron-up',
    title: expanded ? '收起' : '展开',
  }
}

// 当前选择状态
const selectedBlockKeys = ref<string[]>([])
const selectedCardKeys = ref<string[]>([])
const selectedCardId = ref<string | null>(
  props.cardDesignerView?.selectedInstanceId ?? BLUEPRINT_CARD_ID,
)
const forceStructureTreeReveal = ref(false)

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
  markSaved: markSavedDocument,
  dispose: disposeDocumentState,
} = useCdeDocumentState({
  emitModelValueUpdate: (content) => emit('update:modelValue', content),
  emitModified: (modified) => emit('modified', modified),
  emitSave: () => emit('save'),
  resetSelection: () => {
    selectedBlockKeys.value = []
    selectedCardKeys.value = []
    selectedCardId.value = props.cardDesignerView?.selectedInstanceId ?? BLUEPRINT_CARD_ID
  },
})

const activeFace = computed(() => cardDoc.value?.faces[activeFaceKey.value] ?? null)

const blockFieldCommands = useCdeBlockFieldCommands({
  cardDoc,
  blueprintCardId: BLUEPRINT_CARD_ID,
  refreshDocumentState,
  markDocumentChanged,
})

const {
  createField: createDataTableField,
  applyWorkbookImport: applyDataTableWorkbookImport,
  deleteField: deleteDataTableField,
  excludeField: excludeDataTableField,
  fieldSelection: dataTableFields,
  exportInstanceIds: dataTableExportInstanceIds,
  includeBlock: includeDataTableBlock,
  includeField: includeDataTableField,
  removeBlock: removeDataTableBlock,
  resetCell: resetDataTableCell,
  setInstanceExported: setDataTableInstanceExported,
  updateCell: updateDataTableCell,
} = useCdeDataTableCommands({
  cardDoc,
  documentRevision,
  blueprintCardId: BLUEPRINT_CARD_ID,
  refreshDocumentState,
  markDocumentChanged,
  updateBlockField: blockFieldCommands.updateField,
  resetBlockField: blockFieldCommands.resetField,
  createBlockField: blockFieldCommands.createField,
  deleteBlockField: blockFieldCommands.deleteField,
})

const {
  columns: dataTableColumns,
  catalogFaceGroups: dataTableCatalogFaceGroups,
  faceGroups: dataTableFaceGroups,
} = useCdeDataTableModel({
  cardDoc,
  documentRevision,
  fieldSelection: dataTableFields,
  exportInstanceIds: dataTableExportInstanceIds,
  blueprintCardId: BLUEPRINT_CARD_ID,
  blueprintTitle: () => t('cardDesigner.dataTable.blueprint'),
  faceTitle: faceKey => t(`cardDesigner.info.${faceKey}`),
  translate: messageKey => t(messageKey),
  hasMessage: messageKey => te(messageKey),
})

const {
  busy: dataTableWorkbookBusy,
  canExport: canExportDataTableWorkbook,
  pendingImport: pendingDataTableWorkbookImport,
  exportWorkbook: exportDataTableWorkbook,
  importWorkbook: importDataTableWorkbook,
  confirmImport: confirmDataTableWorkbookImport,
  cancelImport: cancelDataTableWorkbookImport,
} = useCdeDataTableWorkbook({
  cardDoc,
  columns: dataTableColumns,
  faceGroups: dataTableFaceGroups,
  exportInstanceIds: dataTableExportInstanceIds,
  flushPendingChanges,
  applyImport: applyDataTableWorkbookImport,
  translate: (key, parameters) => t(key, parameters ?? {}),
})

// 实例树与实例编辑协议。
const {
  selectedCard,
  instanceTreeData,
  handleInstanceTreeIntent: handleInstanceModelTreeIntent,
  createInstance,
  renameInstance,
  duplicateInstance,
  deleteInstance,
} = useCdeInstanceOps({
  cardDoc,
  blueprintCardId: BLUEPRINT_CARD_ID,
  selectedCardId,
  selectedCardKeys,
  documentRevision,
  refreshDocumentState,
  markDocumentChanged,
})

function duplicateDataTableCard(cardId: string): void {
  if (cardId === BLUEPRINT_CARD_ID) createInstance()
  else duplicateInstance(cardId)
}

function openDataTableFieldDialog(blockId: string): void {
  dataTableCustomFieldTargetBlockId.value = openAdditionalFieldCreateDialog(blockId, BLUEPRINT_CARD_ID)
    ? blockId
    : null
}

function closeAdditionalFieldDialog(): void {
  dataTableCustomFieldTargetBlockId.value = null
  closeAdditionalFieldCreateDialog()
}

function submitAdditionalFieldDialog(): void {
  const blockId = dataTableCustomFieldTargetBlockId.value
  if (!blockId) {
    submitAdditionalFieldCreate()
    return
  }
  const result = createDataTableField({
    blockId,
    fieldKey: additionalFieldCreateDraft.value.fieldKey,
    fieldType: additionalFieldCreateDraft.value.fieldType,
    title: additionalFieldCreateDraft.value.title,
  })
  if (result) return
  dataTableCustomFieldTargetBlockId.value = null
  closeAdditionalFieldCreateDialog()
}

const canMutateSelectedInstance = computed(() =>
  Boolean(selectedCardKeys.value[0] && selectedCardKeys.value[0] !== BLUEPRINT_CARD_ID),
)

function handleInstanceTreeIntent(intent: OcTreeIntent): void {
  handleInstanceModelTreeIntent(intent)
  if (intent.type === 'rename.request'
    || (intent.type === 'action.invoke' && intent.actionKey === 'rename')) {
    void instanceTreeRef.value?.beginRename(intent.key)
  }
}

const instanceCardActions = computed<OcCardAction[]>(() => [
  {
    key: 'add-instance',
    icon: 'action.add',
    title: '新建实例',
  },
  {
    key: 'duplicate-instance',
    icon: 'action.copy',
    title: '复制实例',
    disabled: !canMutateSelectedInstance.value,
  },
  {
    key: 'delete-instance',
    icon: 'action.delete',
    title: '删除实例',
    disabled: !canMutateSelectedInstance.value,
  },
  createPanelToggleAction('toggle-instance-panel', isInstancePanelExpanded.value),
])

const previewCardActions = computed<OcCardAction[]>(() => [
  createPanelToggleAction('toggle-preview-panel', isPreviewPanelExpanded.value),
])

const propertyCardActions = computed<OcCardAction[]>(() => [
  ...(canCreateAdditionalField.value
    ? [{
        key: 'additional-field.create',
        icon: 'action.add' as const,
        title: t('propertyEditor.customFields.create'),
      }]
    : []),
  {
    key: 'toggle-property-delete-mode',
    icon: 'action.delete',
    iconTone: propertyDeleteMode.value ? 'danger' : 'default',
    title: t('propertyEditor.actions.delete'),
  },
  {
    key: 'toggle-property-sort',
    icon: propertySortMode.value === 'category'
      ? 'action.sort-alphabetical-ascending'
      : 'action.sort-category',
    title: propertySortMode.value === 'category'
      ? t('propertyEditor.actions.switchToAlphabetical')
      : t('propertyEditor.actions.switchToCategory'),
  },
  createPanelToggleAction('toggle-property-panel', isPropertyPanelExpanded.value),
])

function triggerInstanceAction(actionKey: 'add-instance' | 'duplicate-instance' | 'delete-instance') {
  const selectedKey = selectedCardKeys.value[0]
  if (actionKey === 'add-instance') createInstance()
  else if (actionKey === 'duplicate-instance' && selectedKey) duplicateInstance(selectedKey)
  else if (actionKey === 'delete-instance' && selectedKey) deleteInstance(selectedKey)
}

function handleInstanceCardAction(payload: { key: string }) {
  if (payload.key === 'toggle-instance-panel') {
    togglePanel('instance')
    return
  }

  if (
    payload.key !== 'add-instance' &&
    payload.key !== 'duplicate-instance' &&
    payload.key !== 'delete-instance'
  ) {
    return
  }

  triggerInstanceAction(payload.key)
}

function handlePreviewCardAction(payload: { key: string }) {
  if (payload.key === 'toggle-preview-panel') {
    togglePanel('preview')
  }
}

function handlePropertyCardAction(payload: { key: string }) {
  if (payload.key === 'additional-field.create') {
    openAdditionalFieldCreateDialog()
    return
  }

  if (payload.key === 'toggle-property-panel') {
    togglePanel('property')
    return
  }

  if (payload.key === 'toggle-property-delete-mode') {
    propertyDeleteMode.value = !propertyDeleteMode.value
    return
  }

  if (payload.key === 'toggle-property-sort') {
    propertySortMode.value = propertySortMode.value === 'category' ? 'alphabetical' : 'category'
  }
}

// 结构树与块编辑协议。
const {
  blockTreeData,
  selectedBlock,
  selectedLocation,
  handleTreeIntent,
  handleRootAction,
  handleViewportBlockClick: selectViewportBlock,
  clearSelection,
} = useCdeTreeOps({
  activeFace,
  documentRevision,
  parentLookup,
  selectedBlockKeys,
  getDefaultBlockName: type => t(`cardDesigner.blockNames.${type}`),
  refreshDocumentState,
  markDocumentChanged,
})
const expandedBlockKeys = ref<string[]>([])

function handleStructureTreeIntent(intent: OcTreeIntent): void {
  if (intent.type === 'expansion.sync') {
    expandedBlockKeys.value = intent.expandedKeys
    return
  }
  if (intent.type === 'expansion.change') {
    const nextKeys = new Set(expandedBlockKeys.value)
    if (intent.expanded) nextKeys.add(intent.key)
    else nextKeys.delete(intent.key)
    expandedBlockKeys.value = [...nextKeys]
    return
  }
  if (intent.type === 'node.activate') {
    if ((blockTreeData.value.children.get(intent.key)?.length ?? 0) === 0) return
    const nextKeys = new Set(expandedBlockKeys.value)
    if (nextKeys.has(intent.key)) nextKeys.delete(intent.key)
    else nextKeys.add(intent.key)
    expandedBlockKeys.value = [...nextKeys]
    return
  }
  if (intent.type === 'rename.request') {
    void structureTreeRef.value?.beginRename(intent.key)
    return
  }
  if (intent.type === 'action.invoke' && intent.actionKey === 'rename') {
    handleTreeIntent(intent)
    void structureTreeRef.value?.beginRename(intent.key)
    return
  }
  if (intent.type === 'action.invoke' && intent.actionKey.startsWith('add-')) {
    const nextKeys = new Set(expandedBlockKeys.value)
    nextKeys.add(intent.key)
    expandedBlockKeys.value = [...nextKeys]
  }
  handleTreeIntent(intent)
}

const structureTreeCardActions = computed<OcCardAction[]>(() =>
  [
    ...treeActionKeys
      .map((actionKey) => {
        const selectionDependent = actionKey === 'duplicate-selected' || actionKey === 'delete-selected'
        return toCardActionDefinition(actionKey, selectionDependent && !selectedBlock.value)
      })
      .filter((action): action is OcCardAction => action !== null),
    createPanelToggleAction('toggle-structure-tree-panel', isStructureTreePanelExpanded.value),
  ],
)

function handleStructureTreeCardAction(payload: { key: string }) {
  if (payload.key === 'toggle-structure-tree-panel') {
    togglePanel('structure')
    return
  }

  handleRootAction(payload.key)
}

// 当前选择派生信息
const {
  propertyInputs: rawPropertyInputs,
  propertyCategories,
  canCreateAdditionalField,
  additionalFieldCreateDialogOpen,
  additionalFieldCreateDraft,
  additionalFieldCreateError,
  additionalFieldTypeOptions,
  updateProperty: updateBlockProp,
  addProperty: addBlockProp,
  resetProperty: resetBlockProp,
  openAdditionalFieldCreateDialog,
  closeAdditionalFieldCreateDialog,
  submitAdditionalFieldCreate,
  deleteProperty,
} = useCdePropertyPanelState({
  cardDoc,
  activeFace,
  selectedLocation,
  selectedBlock,
  selectedCard,
  selectedCardId,
  documentRevision,
  blueprintCardId: BLUEPRINT_CARD_ID,
  refreshDocumentState,
  markDocumentChanged,
  translate: (messageKey) => t(messageKey),
  hasMessage: (messageKey) => te(messageKey),
})

const propertyProjectContext = computed(() => ({
  fonts: projectStore.projectFonts.value,
  information: projectStore.resolvedProject.value,
  dictionary: projectStore.resolvedDictionary.value,
  iconSeries: projectStore.projectIconSeries.value,
  projectIconCatalog: projectStore.projectIconCatalog.value,
}))
const propertyDirectoryProvider = computed<FilePathDirectoryProvider | undefined>(() => {
  const rootPath = props.resourceRootPath
  return rootPath ? createEditorResourceDirectoryProvider(rootPath) : undefined
})
const { propertyEditorInputs } = useCdePropertyEditorProjection({
  cardDoc,
  documentRevision,
  activeFaceKey,
  selectedCardId,
  selectedBlock,
  parentLookup,
  rawPropertyInputs,
  projectContext: propertyProjectContext,
  directoryProvider: propertyDirectoryProvider,
  blueprintCardId: BLUEPRINT_CARD_ID,
  translate: (messageKey, parameters) => parameters ? t(messageKey, parameters) : t(messageKey),
  hasMessage: messageKey => te(messageKey),
})
const { getDataTableCellDefinition } = useCdeDataTableCellProjection({
  cardDoc,
  documentRevision,
  parentLookup,
  projectContext: propertyProjectContext,
  directoryProvider: propertyDirectoryProvider,
  locale,
  blueprintCardId: BLUEPRINT_CARD_ID,
  translate: (messageKey, parameters) => parameters ? t(messageKey, parameters) : t(messageKey),
  hasMessage: messageKey => te(messageKey),
})

const additionalFieldCreateErrorText = computed(() => {
  const error = additionalFieldCreateError.value
  if (!error || error === 'invalid-target') return ''
  const messageKey = `propertyEditor.customFields.errors.${error}`
  return te(messageKey) ? t(messageKey) : error
})

function updateAdditionalFieldType(value: string): void {
  additionalFieldCreateDraft.value.fieldType = value as CdeAdditionalFieldType
}

function updateAdditionalFieldKey(value: string): void {
  additionalFieldCreateDraft.value.fieldKey = value
}

function updateAdditionalFieldTitle(value: string): void {
  additionalFieldCreateDraft.value.title = value
}

function createEditorResourceDirectoryProvider(rootPath: string): FilePathDirectoryProvider {
  return async (relativeDirectory) => {
    const directoryPath = relativeDirectory
      ? resolveEditorResourcePath(rootPath, relativeDirectory)
      : rootPath
    if (!directoryPath) return []
    return await fileSystemService.readDirectoryEntries(directoryPath, 1, relativeDirectory)
  }
}

const selectedLocationType = computed<'simple-container-location' | 'flow-container-location' | null>(() => {
  return selectedLocation.value?.type ?? null
})
const selectedAnchor = computed(() => {
  return selectedLocation.value?.type === 'simple-container-location' ? selectedLocation.value.anchor : null
})
const selectedParentBlockId = computed(() => {
  const block = selectedBlock.value
  if (!block) {
    return null
  }

  const parent = parentLookup.value.get(block.id)
  return parent?.type === 'card-face' ? null : parent?.id ?? null
})
const selectedParentFlowDirection = computed(() => {
  const block = selectedBlock.value
  if (!block) return null
  const parent = parentLookup.value.get(block.id)
  return parent?.type === 'flow-container-block' ? parent.direction : null
})
const selectedFlowAlign = computed(() => (
  selectedLocation.value?.type === 'flow-container-location' ? selectedLocation.value.align : null
))
function withShortcut(label: string, shortcut: string): string {
  return `${label} (${shortcut})`
}
const selectionActionLabels = computed<CardViewportSelectionActionLabels>(() => ({
  label: t('cardDesigner.selectionActions.label'),
  fillParent: withShortcut(t('cardDesigner.selectionActions.fillParent'), 'F'),
  centerInParent: withShortcut(t('cardDesigner.selectionActions.centerInParent'), 'C'),
  inset: withShortcut(t('cardDesigner.selectionActions.inset'), 'I'),
  outset: withShortcut(t('cardDesigner.selectionActions.outset'), 'O'),
  fillCrossAxis: withShortcut(t('cardDesigner.selectionActions.fillCrossAxis'), 'F'),
  centerCrossAxis: withShortcut(t('cardDesigner.selectionActions.centerCrossAxis'), 'C'),
}))
const selectionCommandActions = computed<OcActionButtonAction[]>(() => {
  const block = selectedBlock.value
  if (!block) return []
  const actions: OcActionButtonAction[] = []
  if (block.type === 'flow-container-block') {
    actions.push(...FLOW_DIRECTION_ACTIONS.map(action => ({
      key: action.key,
      icon: action.icon,
      iconTone: block.direction === action.direction ? 'primary' : 'default',
      title: t(`cardDesigner.selectionActions.${action.titleKey}`),
    } satisfies OcActionButtonAction)))
  }

  const input = propertyEditorInputs.value.find(candidate => candidate.key === block.id)
  const definition = input?.fields.content ?? getCardFieldDefinition(block, 'content')
  if (
    definition?.fieldType !== 'string'
    || !definition.richText
    || definition.isReadonly
    || isBindingExpression(input?.record.content)
  ) return actions

  actions.push({
    key: EDIT_RICH_TEXT_ACTION_KEY,
    icon: 'format.text-variant-outline',
    title: t('cardDesigner.selectionActions.editRichText'),
  })
  return actions
})

async function handleSelectionCommand(intent: CardViewportSelectionCommand): Promise<void> {
  const block = selectedBlock.value
  if (!block || block.id !== intent.blockId) return

  const flowDirectionAction = FLOW_DIRECTION_ACTIONS.find(action => action.key === intent.key)
  if (flowDirectionAction) {
    if (block.type !== 'flow-container-block' || block.direction === flowDirectionAction.direction) return
    blockFieldCommands.updateField({
      cardId: selectedCardId.value ?? BLUEPRINT_CARD_ID,
      blockId: block.id,
      fieldKey: 'direction',
    }, flowDirectionAction.direction, 'action')
    return
  }

  if (intent.key !== EDIT_RICH_TEXT_ACTION_KEY) return

  ensurePanelsExpanded(['property'])
  await nextTick()
  await propertyEditorRef.value?.activateField(block.id, 'content')
}
const layerViewShortcutHints = computed(() => [
  {
    keys: [
      { icon: 'input.mouse-scroll-wheel' as const },
      { separator: t('cardDesigner.layerView.shortcutOr') },
      '↑ / ↓',
    ],
    label: t('cardDesigner.layerView.stepPlane'),
  },
  {
    keys: [
      { icon: 'input.keyboard-shift' as const },
      { icon: 'input.mouse-scroll-wheel' as const },
      { separator: t('cardDesigner.layerView.shortcutOr') },
      '↑ / ↓',
    ],
    label: t('cardDesigner.layerView.stepLayer'),
  },
  {
    keys: ['A-Z'],
    label: t('cardDesigner.layerView.cycleByInitial'),
  },
  {
    keys: [{ icon: 'input.keyboard-shift' as const }, 'A-Z'],
    label: t('cardDesigner.layerView.cycleCurrentLayer'),
  },
  {
    keys: [{ icon: 'input.keyboard-space' as const }],
    label: t('cardDesigner.layerView.selectFocused'),
  },
  {
    keys: [
      { icon: 'input.keyboard-space' as const },
      { icon: 'input.mouse-scroll-wheel' as const },
      { separator: t('cardDesigner.layerView.shortcutOr') },
      '↑ / ↓',
    ],
    label: t('cardDesigner.layerView.adjustZIndex'),
  },
  {
    keys: [
      { icon: 'input.keyboard-shift' as const },
      { icon: 'input.keyboard-space' as const },
      { icon: 'input.mouse-scroll-wheel' as const },
      { separator: t('cardDesigner.layerView.shortcutOr') },
      '↑ / ↓',
    ],
    label: t('cardDesigner.layerView.switchExistingLayer'),
  },
])
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
    if (!parent || parent.type === 'card-face') {
      break
    }
    current = parent
  }
  return ids
})

const renderTargetInstance = computed(() => (
  selectedCardId.value === BLUEPRINT_CARD_ID ? null : selectedCard.value ?? null
))

const renderContext = computed(() => ({
  ...projectStore.renderEnvironment.value,
}))
const {
  findViewBlock,
  renderPipelineResult,
  viewDocument: viewDoc,
  viewFace,
} = useCdeRenderProjection({
  cardDoc,
  documentRevision,
  instance: renderTargetInstance,
  activeFaceKey,
  renderContext,
})
watch(renderPipelineResult, (result) => {
  if (result && result.issues.length > 0) console.warn('[cde] render pipeline issues:', result.issues)
}, { immediate: true })

const viewportFaceSize = computed(() => {
  const face = viewFace.value
  return face ? { width: face.width, height: face.height } : null
})
const {
  centerSpacerRef,
  completeFileLoad,
  fitViewport,
  handlePreviewViewportDrag,
  handlePreviewViewportKeydown,
  handlePreviewViewportWheel,
  handleViewportSizeChange,
  handleViewportTransformChange,
  isPreviewViewportDragging,
  isTransformPreviewFrameVisible,
  prepareForFileChange,
  startPreviewViewportDrag,
  stopPreviewViewportDrag,
  transformPreviewFrameStyle,
  transformPreviewHostRef,
  transformPreviewRendererStyle,
  transformPreviewViewportRef,
  transformPreviewViewportStyle,
  viewportScaleLabel,
  viewportTransform,
  zoomViewportIn,
  zoomViewportOut,
} = useCdeViewportController({
  faceSize: viewportFaceSize,
  viewportPort: cardViewportRef,
  leftSidebarElement: leftSidebarRef,
  rightSidebarElement: rightSidebarRef,
  commitTransform: transform => emit('update-viewport-transform', transform),
})

const availableLayerZIndices = computed(() => (
  viewFace.value
    ? buildCardLayerGroups(viewFace.value).map(layer => layer.zIndex)
    : []
))
const {
  applySelectionLayout: handleSelectionAction,
  changeFaceDimension: handleFaceDimensionChange,
  changeSelectionZIndex,
  moveSelection: handleSelectionMove,
  resizeSelection: handleSelectionResize,
} = useCdeSelectionCommands({
  cardDoc,
  parentLookup,
  availableLayerZIndices,
  refreshDocumentState,
  markDocumentChanged,
})

const interactionSelectedBlockId = computed(() => selectedBlock.value?.id ?? null)
const hasRenderableFace = computed(() => viewFace.value !== null)
const {
  handleCanvasPointerDown,
  handleLayerZIndexStep,
  handleRootKeydown,
  handleViewportBlockClick,
  layerViewActive,
  spaceHeld,
} = useCdeLayerViewInteraction({
  rootElement: editorRootRef,
  hasRenderableFace,
  selectedBlockId: interactionSelectedBlockId,
  selectedLocationType,
  viewportPort: cardViewportRef,
  selectBlock: selectViewportBlock,
  changeZIndex: changeSelectionZIndex,
})

const selectionInfo = computed<CardViewportSelectionInfo | null>(() => {
  const block = selectedBlock.value
  const face = viewFace.value
  if (!block || !face) return null

  const renderedBlock = findViewBlock(block.id)
  const presentation = getBlockPresentation(block.type)
  return {
    icon: presentation.icon,
    iconTone: presentation.iconTone,
    name: renderedBlock?.name.trim() || block.name?.trim() || block.id,
    notes: renderedBlock?.notes.trim() || '',
  }
})

type ViewportCardInfoItem = {
  key: string
  value: string
  separated?: boolean
  multiline?: boolean
}
const viewportCardInfo = computed(() => {
  function countBlocks(blocks: readonly CardBlock[]): number {
    return blocks.reduce((count, block) => (
      count + 1 + (isBlockContainer(block)
        ? countBlocks(block.children.map((child) => child.block))
        : 0)
    ), 0)
  }

  const document = cardDoc.value
  const face = activeFace.value
  const filePath = getEditorResourceRelativePath(props.resourceRootPath ?? null, props.filePath)
    || props.fileName?.trim()
    || props.filePath.split(/[\\/]/).filter(Boolean).pop()
    || props.filePath
  const blockCount = face ? countBlocks(face.children.map((child) => child.block)) : 0
  const isBlueprint = selectedCardId.value === BLUEPRINT_CARD_ID
  const documentName = viewDoc.value?.name || '—'
  const documentVersion = viewDoc.value?.version || '—'
  const description = viewDoc.value?.description.trim()
  const notes = viewDoc.value?.notes.trim()
  const items: ViewportCardInfoItem[] = [
    { key: 'fileName', value: filePath },
    { key: 'document', value: `${documentName} @ ${documentVersion}` },
  ]

  if (description) {
    items.push({
      key: 'description',
      value: t('cardDesigner.info.descriptionValue', { description }),
      multiline: true,
    })
  }

  items.push({
    key: 'instanceCount',
    value: t('cardDesigner.info.instanceTotal', { count: document?.instances.length ?? 0 }),
  })

  if (!isBlueprint && selectedCard.value) {
    const instanceIndex = Math.max(0, document?.instances.findIndex(
      (instance) => instance.id === selectedCard.value?.id,
    ) ?? -1) + 1
    items.push({
      key: 'instance',
      value: t('cardDesigner.info.instancePosition', {
        name: selectedCard.value.name || selectedCard.value.id,
        index: instanceIndex,
        total: document?.instances.length ?? 0,
      }),
      separated: true,
    })
  }

  items.push({
    key: 'face',
    value: activeFaceKey.value === 'front'
      ? t('cardDesigner.info.front')
      : t('cardDesigner.info.back'),
    separated: true,
  })
  items.push({ key: 'blockCount', value: t('cardDesigner.info.blockTotal', { count: blockCount }) })
  if (notes) {
    items.push({ key: 'notes', value: notes, separated: true, multiline: true })
  }
  return items
})
const viewportCardDimensions = computed(() => ({
  width: t('cardDesigner.info.widthValue', { value: viewFace.value?.width ?? '—' }),
  height: t('cardDesigner.info.heightValue', { value: viewFace.value?.height ?? '—' }),
}))
const highlightedInfoKeys = ref<ReadonlySet<string>>(new Set())
const previousInfoValues = new Map<string, string>()
const infoHighlightTimers = new Map<string, number>()

function highlightInfoValue(key: string): void {
  const nextKeys = new Set(highlightedInfoKeys.value)
  nextKeys.add(key)
  highlightedInfoKeys.value = nextKeys

  const previousTimer = infoHighlightTimers.get(key)
  if (previousTimer !== undefined) window.clearTimeout(previousTimer)
  infoHighlightTimers.set(key, window.setTimeout(() => {
    const remainingKeys = new Set(highlightedInfoKeys.value)
    remainingKeys.delete(key)
    highlightedInfoKeys.value = remainingKeys
    infoHighlightTimers.delete(key)
  }, 900))
}

watch(viewportCardInfo, (items) => {
  for (const item of items) {
    const previousValue = previousInfoValues.get(item.key)
    previousInfoValues.set(item.key, item.value)
    if (previousValue === undefined || previousValue === item.value) continue
    highlightInfoValue(item.key)
  }
}, { immediate: true })
watch(viewportCardDimensions, (dimensions) => {
  for (const key of ['width', 'height'] as const) {
    const value = dimensions[key]
    const previousValue = previousInfoValues.get(key)
    previousInfoValues.set(key, value)
    if (previousValue === undefined || previousValue === value) continue
    highlightInfoValue(key)
  }
}, { immediate: true })
const editorIssueSnapshot = computed(() => createCardDesignerIssueSnapshot({
  document: cardDoc.value,
  instance: renderTargetInstance.value,
  result: renderPipelineResult.value,
  translate: (key, parameters) => t(key, parameters ?? {}),
  resolveFieldLabel: (fieldKey) => {
    const messageKey = `propertyEditor.fields.${fieldKey}`
    return te(messageKey) ? t(messageKey) : fieldKey
  },
}))

watch(editorIssueSnapshot, (snapshot) => {
  emit('issue-snapshot', snapshot)
})
async function saveFile() {
  await flushPendingChanges()
  await saveDocumentFile()
}

function ensureSelectionValidity() {
  if (selectedBlockKeys.value.length > 0 && !selectedBlock.value) {
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

function resolveNavigationInputKey(
  target: CardDesignerNavigationToken['target'],
): string | null {
  if (target.owner === 'document') return cardDoc.value?.id ?? null
  if (target.owner === 'face') return activeFace.value?.id ?? null
  if (target.owner === 'instance') return selectedCard.value?.id ?? null
  if (target.owner === 'block') return selectedBlock.value?.id ?? null
  return selectedLocation.value?.id ?? null
}

function resolveBlockFaceKey(blockId: string): CardFaceKey | null {
  let currentId = blockId
  while (true) {
    const parent = parentLookup.value.get(currentId)
    if (!parent) return null
    if (parent.type === 'card-face') {
      if (parent.id === cardDoc.value?.faces.front.id) return 'front'
      if (parent.id === cardDoc.value?.faces.back.id) return 'back'
      return null
    }
    currentId = parent.id
  }
}

async function navigate(token: SessionNavigationToken): Promise<CardDesignerNavigationResult> {
  if (!isCardDesignerNavigationToken(token)) return 'invalid-token'

  const document = cardDoc.value
  if (!document) return 'not-found'

  const target = token.target
  const cardKey = target.instanceId ?? BLUEPRINT_CARD_ID
  if (
    target.instanceId !== null
    && !document.instances.some((instance) => instance.id === target.instanceId)
  ) {
    return 'not-found'
  }
  if (target.blockId && resolveBlockFaceKey(target.blockId) !== target.faceKey) return 'not-found'

  selectedCardId.value = cardKey
  selectedCardKeys.value = [cardKey]
  if (target.faceKey) {
    activeFaceKey.value = target.faceKey
  }

  if (workspaceMode.value === 'data-table' && target.owner === 'block') {
    if (!target.blockId) return 'not-found'
    if (dataTableFields.value[target.blockId]?.includes(target.fieldKey)) {
      await nextTick()
      if (!cardDataTableRef.value) return 'not-found'
      return await cardDataTableRef.value.revealCell(
        cardKey,
        target.blockId,
        target.fieldKey,
        target.characterOffset,
      )
        ? 'success'
        : 'not-found'
    }
  }

  if (workspaceMode.value !== 'design') {
    emit('update:card-designer-mode', 'design')
    await nextTick()
    await nextTick()
  }
  if (target.owner === 'block' || target.owner === 'location') {
    forceStructureTreeReveal.value = true
    selectedBlockKeys.value = target.blockId ? [target.blockId] : []
  } else {
    clearSelection()
  }
  commitViewState()

  ensurePanelsExpanded(target.blockId ? ['property', 'structure'] : ['property'])

  await nextTick()
  await nextTick()
  const inputKey = resolveNavigationInputKey(target)
  forceStructureTreeReveal.value = false
  if (!inputKey || !propertyEditorRef.value) return 'not-found'

  return await propertyEditorRef.value.revealField(
    inputKey,
    target.fieldKey,
    target.characterOffset,
  )
    ? 'success'
    : 'not-found'
}

watch(
  () => [props.cardDesignerView, props.alignmentSnappingEnabledByDefault] as const,
  ([view, alignmentSnappingEnabledByDefault]) => {
    const nextFace = view?.activeFace ?? 'front'
    if (activeFaceKey.value !== nextFace) {
      activeFaceKey.value = nextFace
      selectedBlockKeys.value = []
      forceStructureTreeReveal.value = false
    }
    clipToFace.value = view?.clipToFace ?? false
    alignmentSnappingEnabled.value = view?.alignmentSnappingEnabled
      ?? alignmentSnappingEnabledByDefault
      ?? true
    const nextCardId = view?.selectedInstanceId ?? BLUEPRINT_CARD_ID
    selectedCardId.value = nextCardId
  },
  { immediate: true, deep: true },
)

watch(selectedCardId, (cardId) => {
  const storedId = props.cardDesignerView?.selectedInstanceId ?? null
  const nextId = cardId === BLUEPRINT_CARD_ID ? null : cardId
  if (storedId !== nextId) commitViewState()
})

watch(
  () => [props.filePath, props.modelValue] as const,
  ([nextFilePath, nextValue]) => {
    const content = nextValue ?? ''
    const hasLoadedDocument = loadedFilePath.value !== null
    if (!content) {
      if (hasLoadedDocument) {
        emit('issue-snapshot', { scopeKey: BLUEPRINT_CARD_ID, scopeOrder: [], issues: [] })
      }
      return
    }

    const fileChanged = nextFilePath !== loadedFilePath.value
    if (!fileChanged && content === rawContent.value) {
      return
    }

    if (hasLoadedDocument) {
      emit('issue-snapshot', { scopeKey: BLUEPRINT_CARD_ID, scopeOrder: [], issues: [] })
    }
    loadedFilePath.value = nextFilePath
    if (fileChanged) {
      prepareForFileChange()
    }
    loadRawDoc(content)
    if (fileChanged) completeFileLoad()
  },
  { immediate: true },
)

defineExpose({
  save: saveFile,
  markSaved: markSavedDocument,
  flush: flushPendingChanges,
  undo: undoFile,
  redo: redoFile,
  canUndo,
  canRedo,
  navigate,
  importDataTableWorkbook,
  exportDataTableWorkbook,
  dataTableWorkbookBusy,
  canExportDataTableWorkbook,
})

onUnmounted(() => {
  for (const timer of infoHighlightTimers.values()) window.clearTimeout(timer)
  infoHighlightTimers.clear()
  disposeDocumentState()
})

</script>

<style scoped>
.card-design-editor__viewport {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
}

.card-design-editor__card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
  color: var(--oc-fg-default);
  font-size: var(--oc-text-sm);
  line-height: 1.55;
  font-variant-numeric: tabular-nums;
}

.card-design-editor__card-info:hover > span,
.card-design-editor__dimension-info:hover {
  opacity: 1;
}

.card-design-editor__card-info > span {
  overflow: hidden;
  opacity: 0.34;
  text-overflow: ellipsis;
  transition: opacity 140ms ease-out;
  white-space: nowrap;
}

.card-design-editor__card-info > span.is-multiline {
  text-overflow: clip;
  white-space: pre-wrap;
}

.card-design-editor__card-info > span.is-group-separated {
  margin-top: var(--oc-space-4);
}

.card-design-editor__dimension-info {
  display: block;
  color: var(--oc-fg-default);
  font-size: var(--oc-text-sm);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  opacity: 1;
  transition: opacity 140ms ease-out;
  white-space: nowrap;
}

.card-design-editor__card-info > span.is-highlighted,
.card-design-editor__dimension-info.is-highlighted {
  animation: card-info-value-highlight 900ms ease-out;
}

@keyframes card-info-value-highlight {
  0% {
    color: var(--oc-fg-accent);
    opacity: 1;
    text-shadow: 0 0 8px color-mix(in srgb, var(--oc-fg-accent) 70%, transparent);
  }

  100% {
    color: var(--oc-fg-default);
    opacity: 0.34;
    text-shadow: none;
  }
}

.card-design-editor__stage {
  position: relative;
  width: 100%;
  height: 100%;
}

.card-design-editor__mode-view {
  position: absolute;
  inset: 0;
  min-width: 0;
  min-height: 0;
}

.card-designer-view-fade-enter-active,
.card-designer-view-fade-leave-active {
  transition: opacity var(--oc-duration-normal) var(--oc-ease);
}

.card-designer-view-fade-leave-active {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.card-designer-view-fade-enter-from,
.card-designer-view-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .card-designer-view-fade-enter-active,
  .card-designer-view-fade-leave-active {
    transition-duration: 0.01ms;
  }
}

.card-design-editor__stage-base {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 0;
}

.card-design-editor__stage.is-layer-view-active .card-design-editor__stage-base {
  z-index: var(--oc-z-overlay-toolbar);
}

.card-design-editor__stage-layer {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: none;
  z-index: 2;
  opacity: 1;
  transition: opacity var(--oc-duration-normal) var(--oc-ease);
}

.card-design-editor__stage.is-layer-view-active .card-design-editor__stage-layer {
  opacity: 0.45;
}

.card-design-editor__stage.is-layer-view-active .card-design-editor__stage-layer,
.card-design-editor__stage.is-layer-view-active .card-design-editor__stage-layer * {
  pointer-events: none !important;
}

.card-design-editor__viewport-controls {
  pointer-events: auto;
}

.card-design-editor__face-tools {
  position: absolute;
  right: calc(
    var(--card-editor-right-sidebar-visible-width, 320px)
    + var(--card-editor-right-sidebar-edge-inset, var(--oc-space-4))
    + var(--oc-space-2)
  );
  bottom: var(--oc-space-2);
  z-index: 3;
  transition: right var(--oc-duration-slow) var(--oc-ease);
}

.card-design-editor__face-tools.is-right-sidebar-collapsed {
  right: var(--oc-space-2);
}

.card-design-editor__face-tools-divider {
  width: var(--oc-space-4);
  height: var(--oc-border-width);
  background: var(--oc-border-muted);
}

.card-design-editor__overlay-layout {
  width: 100%;
  height: calc(100% - var(--oc-space-2) - var(--oc-space-2));
  margin-block: var(--oc-space-2);
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns:
    minmax(0, calc(
      var(--card-editor-left-sidebar-visible-width, 320px)
      + var(--card-editor-left-sidebar-edge-inset, var(--oc-space-4))
    ))
    8px
    minmax(0, 1fr)
    8px
    minmax(0, calc(
      var(--card-editor-right-sidebar-visible-width, 320px)
      + var(--card-editor-right-sidebar-edge-inset, var(--oc-space-4))
    ));
  grid-template-rows: minmax(0, 1fr);
  align-items: stretch;
  pointer-events: none !important;
  transition: grid-template-columns var(--oc-duration-slow) var(--oc-ease);
}

.card-design-editor__sidebar {
  --card-design-editor-collapsed-sidebar-height: calc((var(--oc-size-md) + 2px) * 2);
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: grid;
  pointer-events: auto;
  transition:
    height var(--oc-duration-slow) var(--oc-ease),
    transform var(--oc-duration-slow) var(--oc-ease);
}

.card-design-editor__stage-layer.is-sidebar-width-resizing .card-design-editor__overlay-layout,
.card-design-editor__stage-layer.is-sidebar-width-resizing .card-design-editor__sidebar,
.card-design-editor__stage-layer.is-sidebar-width-resizing .card-design-editor__face-tools {
  transition-duration: 0s;
}

.card-design-editor__sidebar.is-collapsed {
  height: var(--card-design-editor-collapsed-sidebar-height);
}

.card-design-editor__sidebar--left {
  width: var(--card-editor-left-panel-width, 320px);
  grid-template-rows: var(--card-editor-left-sidebar-rows);
  align-content: var(--card-editor-left-sidebar-align-content);
  align-self: var(--card-editor-left-sidebar-align-self);
  transform: translateX(
    calc(
      var(--card-editor-left-sidebar-visible-width, 320px)
      + var(--card-editor-left-sidebar-edge-inset, var(--oc-space-4))
      - var(--card-editor-left-panel-width, 320px)
    )
  );
}

.card-design-editor__sidebar--right {
  width: var(--card-editor-right-panel-width, 320px);
  grid-template-rows: var(--card-editor-right-sidebar-rows);
  align-content: var(--card-editor-right-sidebar-align-content);
  align-self: var(--card-editor-right-sidebar-align-self);
}

.card-design-editor__sidebar-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
}

.card-design-editor__center-spacer {
  min-width: 0;
  min-height: 0;
}

.card-design-editor__resizebar {
  --card-design-editor-collapsed-sidebar-height: calc((var(--oc-size-md) + 2px) * 2);
  position: relative;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  z-index: 2;
  pointer-events: auto;
}

.card-design-editor__resizebar-visual {
  display: inline-block;
  background: var(--oc-border-muted);
  transition: background-color 0.2s ease;
}

.card-design-editor__resizebar:hover .card-design-editor__resizebar-visual,
.card-design-editor__resizebar:focus-visible .card-design-editor__resizebar-visual,
.card-design-editor__resizebar.is-active .card-design-editor__resizebar-visual {
  background: var(--oc-border-accent);
}

.card-design-editor__resizebar--vertical {
  width: 8px;
  height: 100%;
  cursor: col-resize;
  transition: height var(--oc-duration-slow) var(--oc-ease);
}

.card-design-editor__resizebar--vertical.is-sidebar-collapsed {
  align-self: start;
  height: var(--card-design-editor-collapsed-sidebar-height);
}

.card-design-editor__resizebar--vertical.is-sidebar-collapsed .card-design-editor__resizebar-visual {
  background: var(--oc-border-accent);
  opacity: 0.65;
}

.card-design-editor__resizebar--vertical .card-design-editor__resizebar-visual {
  width: 4px;
  height: 28px;
  border-radius: 999px;
  transition:
    background-color var(--oc-duration-fast) var(--oc-ease),
    opacity var(--oc-duration-fast) var(--oc-ease);
}

.card-design-editor__resizebar--vertical:hover .card-design-editor__resizebar-visual,
.card-design-editor__resizebar--vertical:focus-visible .card-design-editor__resizebar-visual,
.card-design-editor__resizebar--vertical.is-active .card-design-editor__resizebar-visual {
  background: var(--oc-border-accent);
  opacity: 0.9;
}

.card-design-editor__resizebar--horizontal {
  height: 8px;
  cursor: row-resize;
}

.card-design-editor__resizebar--horizontal .card-design-editor__resizebar-visual {
  width: 28px;
  height: 4px;
  border-radius: 999px;
}

@media (prefers-reduced-motion: reduce) {
  .card-design-editor__sidebar,
  .card-design-editor__resizebar--vertical,
  .card-design-editor__resizebar--vertical .card-design-editor__resizebar-visual,
  .card-design-editor__face-tools,
  .card-design-editor__stage-layer,
  .card-design-editor__overlay-layout {
    transition: none;
  }
}

@media (max-width: 760px) {
  .card-design-editor__overlay-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .card-design-editor__sidebar,
  .card-design-editor__resizebar,
  .card-design-editor__face-tools {
    display: none;
  }

  .card-design-editor__center-spacer {
    grid-column: 1;
  }
}

.card-design-editor__transform-preview-host {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.card-design-editor__transform-preview-viewport {
  position: relative;
  flex: 0 0 auto;
}

.card-design-editor__transform-preview-frame {
  position: absolute;
  z-index: 2;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 1px solid var(--oc-border-accent);
  border-radius: 2px;
  outline: none;
  background: color-mix(in srgb, var(--oc-bg-accent) 10%, transparent);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--oc-bg-base) 72%, transparent),
    inset 0 0 0 1px color-mix(in srgb, var(--oc-fg-accent) 22%, transparent);
  cursor: grab;
  touch-action: none;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity var(--oc-duration-fast) var(--oc-ease),
    background-color var(--oc-duration-fast) var(--oc-ease),
    box-shadow var(--oc-duration-fast) var(--oc-ease);
}

.card-design-editor__transform-preview-frame.is-visible {
  opacity: 1;
  pointer-events: auto;
}

.card-design-editor__transform-preview-frame::after {
  content: '';
  position: absolute;
  inset: -5px;
}

.card-design-editor__transform-preview-frame:hover,
.card-design-editor__transform-preview-frame:focus-visible {
  background: color-mix(in srgb, var(--oc-bg-accent) 18%, transparent);
  box-shadow:
    0 0 0 1px var(--oc-bg-base),
    inset 0 0 0 1px color-mix(in srgb, var(--oc-fg-accent) 42%, transparent);
}

.card-design-editor__transform-preview-frame.is-dragging {
  background: color-mix(in srgb, var(--oc-bg-accent) 24%, transparent);
  cursor: grabbing;
}
</style>
