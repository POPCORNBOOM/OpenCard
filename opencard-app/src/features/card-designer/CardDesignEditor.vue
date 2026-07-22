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
    <div class="card-design-editor__stage">
      <div class="card-design-editor__stage-base">
        <OcPanel fill tone="transparent" border="none" padding="none" overflow="hidden">
        <CardViewport ref="cardViewportRef" v-if="viewFace" class="card-design-editor__viewport" :face="viewFace"
          :clip-to-face="clipToFace"
          :restore-key="props.filePath" :transform="viewportTransform"
          :selected-block-id="selectedBlock?.id ?? null" :selected-location-type="selectedLocationType"
          :selected-anchor="selectedAnchor" :selected-parent-block-id="selectedParentBlockId"
          :transform-disabled-block-ids="transformDisabledBlockIds" @block-click="handleViewportBlockClick"
          @blank-click="clearSelection" @resize-selection="handleSelectionResize" @move-selection="handleSelectionMove"
          @viewport-transform-change="handleViewportTransformChange"
          @viewport-size-change="handleViewportSizeChange">
          <template #info>
            <section class="card-design-editor__card-info" :aria-label="t('cardDesigner.info.title')">
              <dl class="card-design-editor__card-info-list">
                <div v-for="item in viewportCardInfo" :key="item.key">
                  <dt>{{ item.label }}</dt>
                  <dd :class="{ 'is-highlighted': highlightedInfoKeys.has(item.key) }" :title="item.value">
                    {{ item.value }}
                  </dd>
                </div>
              </dl>
            </section>
          </template>
        </CardViewport>
        <OcEmpty v-else>无法解析 .opencard 文件</OcEmpty>
        </OcPanel>
      </div>

      <div class="card-design-editor__stage-layer">
        <div class="card-design-editor__overlay-layout">
          <aside
            ref="leftSidebarRef"
            class="card-design-editor__sidebar card-design-editor__sidebar--left"
            :class="{ 'is-collapsed': isLeftSidebarCollapsed }"
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
                        :style="transformPreviewRendererStyle" />
                      <button v-if="transformPreviewFrameStyle" type="button"
                        class="card-design-editor__transform-preview-frame"
                        :class="{
                          'is-visible': isTransformPreviewFrameVisible,
                          'is-dragging': previewDragState !== null,
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
          >
            <span class="card-design-editor__resizebar-visual" aria-hidden="true" />
          </div>

          <div class="card-design-editor__position-readout">
            <OcCard variant="glass">
              <OcText> x: {{
                Math.round(viewportTransform.x) }}, y: {{ Math.round(viewportTransform.y) }}, scale: {{
                  viewportTransform.scale.toFixed(2) }}</OcText>
            </OcCard>
          </div>

          <div class="card-design-editor__center-spacer" aria-hidden="true" />

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
          >
            <span class="card-design-editor__resizebar-visual" aria-hidden="true" />
          </div>

          <aside
            ref="rightSidebarRef"
            class="card-design-editor__sidebar card-design-editor__sidebar--right"
            :class="{ 'is-collapsed': isRightSidebarCollapsed }"
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
                    selection-mode="single" @intent="handleStructureTreeIntent" />
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
                    @update-property="updateBlockProp" @add-property="addBlockProp"
                    @reset-property="resetBlockProp"
                    @delete-property="deleteAdditionalField" />
                </OcPanel>
              </OcCard>
            </div>
          </aside>
        </div>

        <OcViewportControls
          v-if="viewFace"
          class="card-design-editor__viewport-controls"
          aria-label="卡牌画布缩放控制"
          :scale-label="viewportScaleLabel"
          @zoom-out="zoomViewportBy(1 / VIEWPORT_ZOOM_STEP)"
          @reset="resetViewport"
          @zoom-in="zoomViewportBy(VIEWPORT_ZOOM_STEP)"
        />

        <div v-if="viewFace && !isRightSidebarCollapsed" class="card-design-editor__face-tools">
          <OcActionButton :action="clipAction" size="sm" variant="soft" @select="toggleFaceClip" />
          <OcActionButton :action="faceSwitchAction" size="sm" variant="soft" @select="toggleActiveFace" />
        </div>
      </div>
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
      @close="closeAdditionalFieldCreateDialog"
      @submit="submitAdditionalFieldCreate"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch, type CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../editor-runtime/registry/editorRegistry'
import type { SessionNavigationToken } from '../editor-runtime/model/editorIssue'
import {
  exposesCardFieldReference,
  getCardFieldDefinition,
  getCardFieldKeys,
  getCardFieldValueKind,
  type CardBlock,
  type CardFaceKey,
} from '../../entities/card/model'
import { getBlockTreeIcon } from './blockPresentation'
import OcPanel from '../../components/base/OcPanel.vue'
import CardFaceRenderer from '../card-rendering/components/CardFaceRenderer.vue'
import CardViewport from '../card-rendering/components/CardViewport.vue'
import { runRenderPipeline } from '../card-rendering/renderPipeline'
import type { RenderReadyCardDocument, RenderReadyCardFace } from '../card-rendering/render.types'
import PropertyEditor from '../../shared/ui/property-editor/PropertyEditor.vue'
import AdditionalFieldCreateDialog from '../../shared/ui/property-editor/AdditionalFieldCreateDialog.vue'
import OcEmpty from '../../components/base/OcEmpty.vue'
import OcTree from '../../components/standard/OcTree.vue'
import OcViewportControls from '../../components/standard/OcViewportControls.vue'
import OcActionButton, { type OcActionButtonAction } from '../../components/standard/OcActionButton.vue'
import { useCdeDocumentState } from './useCdeDocumentState'
import { useCdeInstanceOps } from './useCdeInstanceOps'
import {
  useCdePropertyPanelState,
  type CdeAdditionalFieldType,
  type CdePropertySortMode,
} from './useCdePropertyPanelState'
import { useCdeTreeOps } from './useCdeTreeOps'
import type { OcTreeActionDefinition, OcTreeIntent } from '../../shared/ui/tree/tree.types'
import { isBlockContainer } from '../../entities/card/tree'
import OcText from '../../components/base/OcText.vue'
import OcCard, { type OcCardAction } from '../../components/standard/OcCard.vue'
import type { CardDesignerLayoutState, CardDesignerViewState } from '../editor-runtime/model/editorUiState'
import { createCardDesignerIssueSnapshot } from './cardDesignerIssues'
import { isBindingExpression } from '../editor-runtime/model/binding'
import type {
  ReferenceCompletionContext,
  ReferenceCompletionScope,
} from '../editor-runtime/services/referenceCompletion'
import {
  resolveReferenceCompletion,
} from '../editor-runtime/services/referenceCompletion'
import type {
  PropertyCompletionProvider,
  PropertyEditorInput,
} from '../../shared/ui/property-editor/propertyEditor.types'
import { chainPropertyCompletionProviders } from '../../shared/ui/property-editor/propertyCompletion'
import { useProjectStore } from '../workspace/store/projectStore'
import { createFilePathCompletionProvider } from '../workspace/services/filePathCompletion'
import {
  exposesProjectFieldReference,
  getProjectFieldKeys,
  getProjectFieldValueKind,
  type ProjectInformation,
} from '../workspace/model/projectMetadata'
import {
  isCardDesignerNavigationToken,
  type CardDesignerNavigationResult,
  type CardDesignerNavigationToken,
} from './cardDesignerNavigation'

// 蓝图实例固定 ID
const BLUEPRINT_CARD_ID = '__blueprint__'

// 组件输入输出
const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t, te } = useI18n()
const projectStore = useProjectStore()
const propertyBindingInterpreter = { isExpression: isBindingExpression }

type ResizeTarget = 'left-width' | 'right-width' | 'left-stack' | 'right-stack'
type SidebarPairState = {
  topExpanded: boolean
  bottomExpanded: boolean
  topHeight: number | null
}
type ResizeState =
  | {
    target: 'left-width' | 'right-width'
    startX: number
    startWidth: number
  }
  | {
    target: 'left-stack' | 'right-stack'
    startY: number
    startTopHeight: number
    availableHeight: number
  }

const SIDE_PANEL_MIN_WIDTH = 280
const SIDE_PANEL_MAX_WIDTH = 420
const SIDEBAR_TOP_MIN_HEIGHT = 160
const SIDEBAR_BOTTOM_MIN_HEIGHT = 220
const RESIZEBAR_SIZE = 8

// 文档与编辑器状态
const propertySortMode = ref<CdePropertySortMode>('category')
const activeFaceKey = ref<CardFaceKey>(props.cardDesignerView?.activeFace ?? 'front')
const clipToFace = ref(props.cardDesignerView?.clipToFace ?? false)
const isInstancePanelExpanded = ref(true)
const isPreviewPanelExpanded = ref(true)
const isStructureTreePanelExpanded = ref(true)
const isPropertyPanelExpanded = ref(true)
const leftPanelWidth = ref(320)
const rightPanelWidth = ref(320)
const leftSidebarTopHeight = ref<number | null>(null)
const rightSidebarTopHeight = ref<number | null>(null)
const activeResizeTarget = ref<ResizeTarget | null>(null)
const resizeState = ref<ResizeState | null>(null)

function normalizeStoredTopHeight(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(SIDEBAR_TOP_MIN_HEIGHT, value)
    : null
}

function createLayoutState(): CardDesignerLayoutState {
  return {
    panels: {
      instanceExpanded: isInstancePanelExpanded.value,
      previewExpanded: isPreviewPanelExpanded.value,
      structureExpanded: isStructureTreePanelExpanded.value,
      propertyExpanded: isPropertyPanelExpanded.value,
    },
    leftTopHeight: leftSidebarTopHeight.value,
    rightTopHeight: rightSidebarTopHeight.value,
  }
}

function commitLayoutState(): void {
  emit('update-card-designer-layout', createLayoutState())
}

function createViewState(): CardDesignerViewState {
  return {
    activeFace: activeFaceKey.value,
    clipToFace: clipToFace.value,
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
  icon: clipToFace.value ? 'tool.clip-on' : 'tool.clip-off',
  title: clipToFace.value
    ? t('cardDesigner.view.disableClip')
    : t('cardDesigner.view.enableClip'),
}))

const faceSwitchAction = computed<OcActionButtonAction>(() => ({
  key: 'switch-face',
  icon: 'nav.arrow-swap',
  title: activeFaceKey.value === 'front'
    ? t('cardDesigner.view.switchToBack')
    : t('cardDesigner.view.switchToFront'),
}))

function toggleFaceClip(): void {
  clipToFace.value = !clipToFace.value
  commitViewState()
}

function toggleActiveFace(): void {
  activeFaceKey.value = activeFaceKey.value === 'front' ? 'back' : 'front'
  selectedBlockKeys.value = []
  forceStructureTreeReveal.value = false
  commitViewState()
}

const currentLeftPanelWidth = computed(() => leftPanelWidth.value)
const canResizeLeftSidebar = computed(() => isInstancePanelExpanded.value && isPreviewPanelExpanded.value)
const canResizeRightSidebar = computed(() => isStructureTreePanelExpanded.value && isPropertyPanelExpanded.value)
const isLeftSidebarCollapsed = computed(() => !isInstancePanelExpanded.value && !isPreviewPanelExpanded.value)
const isRightSidebarCollapsed = computed(() => !isStructureTreePanelExpanded.value && !isPropertyPanelExpanded.value)
const leftSidebarRows = computed(() => formatSidebarRows({
  topExpanded: isInstancePanelExpanded.value,
  bottomExpanded: isPreviewPanelExpanded.value,
  topHeight: leftSidebarTopHeight.value,
}))
const rightSidebarRows = computed(() => formatSidebarRows({
  topExpanded: isStructureTreePanelExpanded.value,
  bottomExpanded: isPropertyPanelExpanded.value,
  topHeight: rightSidebarTopHeight.value,
}))
const leftSidebarAlignContent = computed(() => (isLeftSidebarCollapsed.value ? 'start' : 'stretch'))
const rightSidebarAlignContent = computed(() => (isRightSidebarCollapsed.value ? 'start' : 'stretch'))
const leftSidebarAlignSelf = computed(() => (isLeftSidebarCollapsed.value ? 'start' : 'stretch'))
const rightSidebarAlignSelf = computed(() => (isRightSidebarCollapsed.value ? 'start' : 'stretch'))
const editorShellStyle = computed<CSSProperties>(() => ({
  display: 'flex',
  flex: '1 1 auto',
  width: '100%',
  height: '100%',
  minWidth: '0',
  minHeight: '0',
  position: 'relative',
  overflow: 'hidden',
  '--card-editor-overlay-inset-x': '24px',
  '--card-editor-overlay-inset-y': '20px',
  '--card-editor-left-panel-width-expanded': '272px',
  '--card-editor-left-panel-width-collapsed': '32px',
  '--card-editor-left-panel-width': `${currentLeftPanelWidth.value}px`,
  '--card-editor-right-panel-width': `${rightPanelWidth.value}px`,
  '--card-editor-left-sidebar-rows': leftSidebarRows.value,
  '--card-editor-right-sidebar-rows': rightSidebarRows.value,
  '--card-editor-left-sidebar-align-content': leftSidebarAlignContent.value,
  '--card-editor-right-sidebar-align-content': rightSidebarAlignContent.value,
  '--card-editor-left-sidebar-align-self': leftSidebarAlignSelf.value,
  '--card-editor-right-sidebar-align-self': rightSidebarAlignSelf.value,
}))
const DEFAULT_VIEWPORT_TRANSFORM = { x: 0, y: 0, scale: 1 }
const VIEWPORT_ZOOM_STEP = 1.25

type CardViewportHandle = {
  zoomBy: (factor: number) => void
  zoomByWheelAt: (deltaY: number, deltaMode: number, viewportX: number, viewportY: number) => void
  resetView: () => void
}

type PropertyEditorHandle = {
  revealField: (inputKey: string, fieldKey: string, characterOffset?: number) => Promise<boolean>
}

const cardViewportRef = ref<CardViewportHandle | null>(null)
const propertyEditorRef = ref<PropertyEditorHandle | null>(null)
const instanceTreeRef = ref<{ beginRename: (key: string) => Promise<void> } | null>(null)
const structureTreeRef = ref<{ beginRename: (key: string) => Promise<void> } | null>(null)
const viewportTransform = ref({
  x: 0,
  y: 0,
  scale: 1,
})
const viewportSize = ref({
  width: 0,
  height: 0,
})
const previewDragState = ref<{
  pointerId: number
  startClientX: number
  startClientY: number
  startTransform: { x: number; y: number; scale: number }
} | null>(null)
const loadedFilePath = ref<string | null>(null)
const editorRootRef = ref<HTMLElement | null>(null)
const leftSidebarRef = ref<HTMLElement | null>(null)
const rightSidebarRef = ref<HTMLElement | null>(null)
let previousBodyCursor = ''
let previousBodyUserSelect = ''
let isBodyInteractionLocked = false

function formatSidebarRows(state: SidebarPairState): string {
  if (state.topExpanded && !state.bottomExpanded) {
    return 'minmax(0, 1fr) auto'
  }

  if (!state.topExpanded && state.bottomExpanded) {
    return 'auto minmax(0, 1fr)'
  }

  if (!state.topExpanded && !state.bottomExpanded) {
    return 'auto auto'
  }

  const topRow = state.topExpanded
    ? state.topHeight === null
      ? `minmax(${SIDEBAR_TOP_MIN_HEIGHT}px, 1fr)`
      : `${state.topHeight}px`
    : 'auto'
  const bottomRow = state.bottomExpanded
    ? `minmax(${SIDEBAR_BOTTOM_MIN_HEIGHT}px, 1fr)`
    : 'auto'
  return `${topRow} ${RESIZEBAR_SIZE}px ${bottomRow}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function writeResizeStyles(): void {
  const root = editorRootRef.value
  if (!root) return

  root.style.setProperty('--card-editor-left-panel-width', `${currentLeftPanelWidth.value}px`)
  root.style.setProperty('--card-editor-right-panel-width', `${rightPanelWidth.value}px`)
  root.style.setProperty('--card-editor-left-sidebar-rows', leftSidebarRows.value)
  root.style.setProperty('--card-editor-right-sidebar-rows', rightSidebarRows.value)
  root.style.setProperty('--card-editor-left-sidebar-align-content', leftSidebarAlignContent.value)
  root.style.setProperty('--card-editor-right-sidebar-align-content', rightSidebarAlignContent.value)
  root.style.setProperty('--card-editor-left-sidebar-align-self', leftSidebarAlignSelf.value)
  root.style.setProperty('--card-editor-right-sidebar-align-self', rightSidebarAlignSelf.value)
}

function applyResizeBodyState(cursor: 'col-resize' | 'row-resize'): void {
  if (!isBodyInteractionLocked) {
    previousBodyCursor = document.body.style.cursor
    previousBodyUserSelect = document.body.style.userSelect
    isBodyInteractionLocked = true
  }

  document.body.style.cursor = cursor
  document.body.style.userSelect = 'none'
}

function clearResizeBodyState(): void {
  if (!isBodyInteractionLocked) return

  document.body.style.cursor = previousBodyCursor
  document.body.style.userSelect = previousBodyUserSelect
  previousBodyCursor = ''
  previousBodyUserSelect = ''
  isBodyInteractionLocked = false
}

function startOverlayResize(side: 'left' | 'right', event: MouseEvent): void {
  if (event.button !== 0) return

  handleResizeEnd()
  const target: ResizeTarget = side === 'left' ? 'left-width' : 'right-width'
  resizeState.value = {
    target,
    startX: event.clientX,
    startWidth: side === 'left' ? leftPanelWidth.value : rightPanelWidth.value,
  }
  activeResizeTarget.value = target
  applyResizeBodyState('col-resize')
  document.addEventListener('mousemove', handleResizeMove, true)
  document.addEventListener('mouseup', handleResizeEnd, true)
  event.stopPropagation()
  event.preventDefault()
}

function startSidebarResize(side: 'left' | 'right', event: MouseEvent): void {
  if (event.button !== 0) return
  if (side === 'left' && !canResizeLeftSidebar.value) return
  if (side === 'right' && !canResizeRightSidebar.value) return

  const sidebar = side === 'left' ? leftSidebarRef.value : rightSidebarRef.value
  const topPanel = sidebar?.querySelector('.card-design-editor__sidebar-panel')
  if (!(sidebar instanceof HTMLElement) || !(topPanel instanceof HTMLElement)) return

  handleResizeEnd()
  const target: ResizeTarget = side === 'left' ? 'left-stack' : 'right-stack'
  resizeState.value = {
    target,
    startY: event.clientY,
    startTopHeight: topPanel.getBoundingClientRect().height,
    availableHeight: sidebar.getBoundingClientRect().height - RESIZEBAR_SIZE,
  }
  activeResizeTarget.value = target
  applyResizeBodyState('row-resize')
  document.addEventListener('mousemove', handleResizeMove, true)
  document.addEventListener('mouseup', handleResizeEnd, true)
  event.stopPropagation()
  event.preventDefault()
}

function handleResizeMove(event: MouseEvent): void {
  const state = resizeState.value
  if (!state) return

  if (state.target === 'left-width') {
    leftPanelWidth.value = clamp(
      state.startWidth + event.clientX - state.startX,
      SIDE_PANEL_MIN_WIDTH,
      SIDE_PANEL_MAX_WIDTH,
    )
    writeResizeStyles()
    event.preventDefault()
    return
  }

  if (state.target === 'right-width') {
    rightPanelWidth.value = clamp(
      state.startWidth - (event.clientX - state.startX),
      SIDE_PANEL_MIN_WIDTH,
      SIDE_PANEL_MAX_WIDTH,
    )
    writeResizeStyles()
    event.preventDefault()
    return
  }

  if (state.target === 'left-stack' || state.target === 'right-stack') {
    const nextTopHeight = clamp(
      state.startTopHeight + event.clientY - state.startY,
      SIDEBAR_TOP_MIN_HEIGHT,
      Math.max(SIDEBAR_TOP_MIN_HEIGHT, state.availableHeight - SIDEBAR_BOTTOM_MIN_HEIGHT),
    )
    if (state.target === 'left-stack') {
      leftSidebarTopHeight.value = nextTopHeight
      writeResizeStyles()
      event.preventDefault()
      return
    }
    rightSidebarTopHeight.value = nextTopHeight
    writeResizeStyles()
    event.preventDefault()
  }
}

function handleResizeEnd(): void {
  const shouldCommit = resizeState.value !== null
  resizeState.value = null
  activeResizeTarget.value = null
  document.removeEventListener('mousemove', handleResizeMove, true)
  document.removeEventListener('mouseup', handleResizeEnd, true)
  clearResizeBodyState()
  if (shouldCommit) commitLayoutState()
}

// 结构树操作定义
const treeActions = new Map<string, OcTreeActionDefinition>([
  ['add-root', {
    icon: 'action.add',
    title: '添加',
    children: ['add-text-block', 'add-image-block', 'add-qrcode-block', 'add-shape-block', 'add-simple-container-block', 'add-flow-container-block'],
  }],
  ['duplicate-selected', { icon: 'action.copy', title: '复制选中' }],
  ['delete-selected', { icon: 'action.delete', title: '删除选中' }],
  ['add', {
    icon: 'action.add',
    title: '添加子块',
    children: ['add-text-block', 'add-image-block', 'add-qrcode-block', 'add-shape-block', 'add-simple-container-block', 'add-flow-container-block'],
  }],
  ['add-text-block', { icon: getBlockTreeIcon('text-block'), title: '文本块' }],
  ['add-image-block', { icon: getBlockTreeIcon('image-block'), title: '图片块' }],
  ['add-qrcode-block', { icon: getBlockTreeIcon('qrcode-block'), title: '二维码' }],
  ['add-shape-block', { icon: getBlockTreeIcon('shape-block'), title: '形状' }],
  ['add-simple-container-block', { icon: getBlockTreeIcon('simple-container-block'), title: '简单容器' }],
  ['add-flow-container-block', { icon: getBlockTreeIcon('flow-container-block'), title: '流式容器' }],
  ['duplicate', { icon: 'action.copy', title: '复制' }],
  ['delete', { icon: 'action.delete', title: '删除' }],
  ['rename', { icon: 'action.edit', title: '重命名' }],
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

// 实例树与实例编辑协议。
const {
  selectedCard,
  instanceTreeData,
  handleInstanceTreeIntent: handleInstanceModelTreeIntent,
  createInstance,
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
    key: 'sort-category',
    icon: 'data.list-tree',
    title: 'Category',
    disabled: propertySortMode.value === 'category',
  },
  {
    key: 'sort-alphabetical',
    icon: 'action.sort-alphabetical-ascending',
    title: 'A-Z',
    disabled: propertySortMode.value === 'alphabetical',
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
    isInstancePanelExpanded.value = !isInstancePanelExpanded.value
    handleResizeEnd()
    commitLayoutState()
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
    isPreviewPanelExpanded.value = !isPreviewPanelExpanded.value
    handleResizeEnd()
    commitLayoutState()
  }
}

function handlePropertyCardAction(payload: { key: string }) {
  if (payload.key === 'additional-field.create') {
    openAdditionalFieldCreateDialog()
    return
  }

  if (payload.key === 'toggle-property-panel') {
    isPropertyPanelExpanded.value = !isPropertyPanelExpanded.value
    handleResizeEnd()
    commitLayoutState()
    return
  }

  if (payload.key === 'sort-category') {
    propertySortMode.value = 'category'
    return
  }

  if (payload.key === 'sort-alphabetical') {
    propertySortMode.value = 'alphabetical'
  }
}

// 结构树与块编辑协议。
const {
  blockTreeData,
  selectedBlock,
  selectedLocation,
  handleTreeIntent,
  handleRootAction,
  handleViewportBlockClick,
  clearSelection,
} = useCdeTreeOps({
  activeFace,
  documentRevision,
  parentLookup,
  selectedBlockKeys,
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
    isStructureTreePanelExpanded.value = !isStructureTreePanelExpanded.value
    handleResizeEnd()
    commitLayoutState()
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
  deleteAdditionalField,
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

type PropertyReferenceContexts = Readonly<Record<string, Readonly<Record<string, ReferenceCompletionContext>>>>

function createReferenceScope(
  label: string,
  record: Record<string, unknown>,
): ReferenceCompletionScope {
  const additionalDefinitions = record.additionalFieldDefinition as Record<string, { title?: string }> | undefined
  return {
    label,
    fields: getCardFieldKeys(record)
      .filter((fieldKey) => exposesCardFieldReference(record, fieldKey))
      .map((fieldKey) => ({
        key: fieldKey,
        label: additionalDefinitions?.[fieldKey]?.title ?? (() => {
          const displayKey = getCardFieldDefinition(record, fieldKey)?.displayFieldKey ?? fieldKey
          const messageKey = `propertyEditor.fields.${displayKey}`
          return te(messageKey) ? t(messageKey) : fieldKey
        })(),
        valueKind: getCardFieldValueKind(record, fieldKey),
      })),
  }
}

function createProjectReferenceScope(project: Readonly<ProjectInformation>): ReferenceCompletionScope {
  const additionalDefinitions = project.additionalFieldDefinition
  return {
    label: t('propertyEditor.references.project'),
    fields: getProjectFieldKeys(project)
      .filter(fieldKey => exposesProjectFieldReference(project, fieldKey))
      .map(fieldKey => ({
        key: fieldKey,
        label: additionalDefinitions?.[fieldKey]?.title
          ?? (te(`projectConfig.fields.${fieldKey}`) ? t(`projectConfig.fields.${fieldKey}`) : fieldKey),
        valueKind: getProjectFieldValueKind(project, fieldKey),
      })),
  }
}

const referenceCompletionContexts = computed<PropertyReferenceContexts>(() => {
  const document = cardDoc.value
  if (!document) {
    return {}
  }

  const currentCard = selectedCardId.value === BLUEPRINT_CARD_ID || !selectedCard.value
    ? document
    : selectedCard.value
  const currentCardScope = createReferenceScope(
      selectedCardId.value === BLUEPRINT_CARD_ID
        ? t('propertyEditor.references.currentCardBlueprint')
        : t('propertyEditor.references.currentCard'),
      currentCard as unknown as Record<string, unknown>,
    )
  const documentScope = createReferenceScope(
      t('propertyEditor.references.document'),
      document as unknown as Record<string, unknown>,
    )
  const projectScope = projectStore.projectPath.value
    ? createProjectReferenceScope(projectStore.projectInformation.value)
    : undefined
  const currentFace = activeFace.value
  const oppositeFace = document.faces[activeFaceKey.value === 'front' ? 'back' : 'front']
  const currentFaceScope = currentFace
    ? createReferenceScope(
        t('propertyEditor.references.currentFace'),
        currentFace as unknown as Record<string, unknown>,
      )
    : undefined
  const oppositeFaceScope = createReferenceScope(
    t('propertyEditor.references.oppositeFace'),
    oppositeFace as unknown as Record<string, unknown>,
  )

  const block = selectedBlock.value
  const currentBlockScope = block
    ? createReferenceScope(
        t('propertyEditor.references.self'),
        block as unknown as Record<string, unknown>,
      )
    : undefined
  const ancestorScopes: ReferenceCompletionScope[] = []
  if (block) {
    let currentBlockId = block.id
    let depth = 1

    while (true) {
      const parent = parentLookup.value.get(currentBlockId)
      if (!parent || parent.type === 'card-face') {
        break
      }

      ancestorScopes.push(createReferenceScope(
        depth === 1
          ? t('propertyEditor.references.parent')
          : t('propertyEditor.references.ancestor', { depth }),
        parent as unknown as Record<string, unknown>,
      ))
      currentBlockId = parent.id
      depth += 1
    }
  }

  return Object.fromEntries(rawPropertyInputs.value.map((input) => {
    const hasFaceContext = Boolean(block) || input.key === currentFace?.id
    return [
      input.key,
      Object.fromEntries(getCardFieldKeys(input.record).map((fieldKey) => [
        fieldKey,
        {
          currentBlock: currentBlockScope,
          currentCard: currentCardScope,
          currentFace: hasFaceContext ? currentFaceScope : undefined,
          oppositeFace: hasFaceContext ? oppositeFaceScope : undefined,
          document: documentScope,
          project: projectScope,
          getAncestor: (depth: number) => ancestorScopes[depth - 1],
          targetKind: getCardFieldValueKind(input.record, fieldKey),
        },
      ])),
    ]
  }))
})

function createReferenceCompletionProvider(
  context: ReferenceCompletionContext,
): PropertyCompletionProvider {
  return ({ value, cursor }) => {
    const state = resolveReferenceCompletion(value, cursor, context)
    if (!state) return null
    return {
      replaceStart: state.replaceStart,
      replaceEnd: state.replaceEnd,
      items: state.suggestions.map((suggestion) => ({
        key: suggestion.key,
        label: suggestion.label,
        detail: suggestion.detail,
        insertText: suggestion.insertText,
        keepOpen: suggestion.kind === 'scope',
        ...(suggestion.kind === 'field'
          ? { value: `{{${suggestion.insertText}}}` }
          : {}),
      })),
    }
  }
}

const propertyEditorInputs = computed<readonly PropertyEditorInput[]>(() =>
  rawPropertyInputs.value.map((input) => ({
    ...input,
    fields: Object.fromEntries(Object.entries(input.fields).map(([fieldKey, definition]) => {
      const context = referenceCompletionContexts.value[input.key]?.[fieldKey]
      const bindingProvider = context && definition.acceptsBinding !== false && definition.fieldType !== 'object'
        ? createReferenceCompletionProvider(context)
        : undefined
      const filePathProvider = definition.fieldType === 'filePath'
        ? createFilePathCompletionProvider({
            listDirectory: projectStore.listProjectDirectoryEntries,
            getRootEntries: () => projectStore.indexedEntries.value,
            extensions: definition.extensionsFilter,
            isAvailable: () => Boolean(projectStore.projectPath.value),
          })
        : undefined
      const provider = filePathProvider
        ? chainPropertyCompletionProviders([bindingProvider, filePathProvider])
        : bindingProvider
      if (!provider) return [fieldKey, definition]
      return [fieldKey, {
        ...definition,
        ...(bindingProvider ? { autoPairs: [{ open: '{{', close: '}}' }] } : {}),
        ...(bindingProvider ? { binding: { provider: bindingProvider } } : {}),
        completion: {
          ...definition.completion,
          provider,
        },
      }]
    })),
  })),
)

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

// Keep diagnostics beside the projected document so the editor reports the exact rendered card snapshot.
const renderPipelineResult = computed(() => {
  documentRevision.value
  if (!cardDoc.value) {
    return null
  }

  const result = runRenderPipeline(
    cardDoc.value,
    renderTargetInstance.value,
    {
      project: projectStore.projectPath.value
        ? projectStore.projectInformation.value
        : null,
    },
  )
  if (result.issues.length > 0) console.warn('[cde] render pipeline issues:', result.issues)
  return result
})

const viewDoc = computed<RenderReadyCardDocument | null>(() => renderPipelineResult.value?.document ?? null)
const viewFace = computed<RenderReadyCardFace | null>(() => (
  viewDoc.value?.faces[activeFaceKey.value] ?? null
))
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
  const renderedFace = viewFace.value
  const fileName = props.filePath.split(/[\\/]/).filter(Boolean).pop() ?? props.filePath
  const projection = selectedCard.value?.name?.trim()
    || (selectedCardId.value === BLUEPRINT_CARD_ID
      ? t('cardDesigner.info.documentProjection')
      : selectedCardId.value ?? '')
  const blockCount = face ? countBlocks(face.children.map((child) => child.block)) : 0

  return [
      { key: 'fileName', label: t('cardDesigner.info.fileName'), value: fileName },
      { key: 'cardName', label: t('cardDesigner.info.cardName'), value: document?.name || '—' },
      {
        key: 'face',
        label: t('cardDesigner.info.face'),
        value: activeFaceKey.value === 'front'
          ? t('cardDesigner.info.front')
          : t('cardDesigner.info.back'),
      },
      { key: 'projection', label: t('cardDesigner.info.projection'), value: projection || '—' },
      { key: 'instanceCount', label: t('cardDesigner.info.instanceCount'), value: String(document?.instances.length ?? 0) },
      { key: 'blockCount', label: t('cardDesigner.info.blockCount'), value: String(blockCount) },
      {
        key: 'dimensions',
        label: t('cardDesigner.info.dimensions'),
        value: renderedFace ? `${renderedFace.width} × ${renderedFace.height}` : '—',
      },
  ]
})
const highlightedInfoKeys = ref<ReadonlySet<string>>(new Set())
const previousInfoValues = new Map<string, string>()
const infoHighlightTimers = new Map<string, number>()

watch(viewportCardInfo, (items) => {
  for (const item of items) {
    const previousValue = previousInfoValues.get(item.key)
    previousInfoValues.set(item.key, item.value)
    if (previousValue === undefined || previousValue === item.value) continue

    const nextKeys = new Set(highlightedInfoKeys.value)
    nextKeys.add(item.key)
    highlightedInfoKeys.value = nextKeys

    const previousTimer = infoHighlightTimers.get(item.key)
    if (previousTimer !== undefined) window.clearTimeout(previousTimer)
    infoHighlightTimers.set(item.key, window.setTimeout(() => {
      const remainingKeys = new Set(highlightedInfoKeys.value)
      remainingKeys.delete(item.key)
      highlightedInfoKeys.value = remainingKeys
      infoHighlightTimers.delete(item.key)
    }, 900))
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
const TRANSFORM_PREVIEW_MAX_SIDE = 220
const TRANSFORM_PREVIEW_VISIBILITY_COVERAGE = 0.7
const transformPreviewHostRef = ref<HTMLElement | null>(null)
const transformPreviewViewportRef = ref<HTMLElement | null>(null)
const transformPreviewHostSize = ref({
  width: TRANSFORM_PREVIEW_MAX_SIDE,
  height: TRANSFORM_PREVIEW_MAX_SIDE,
})
let transformPreviewSizeObserver: ResizeObserver | null = null

function updateTransformPreviewHostSize(width: number, height: number): void {
  transformPreviewHostSize.value = {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  }
}

watch(transformPreviewHostRef, (nextHost, prevHost) => {
  if (!transformPreviewSizeObserver) {
    return
  }
  if (prevHost) {
    transformPreviewSizeObserver.unobserve(prevHost)
  }
  if (nextHost) {
    transformPreviewSizeObserver.observe(nextHost)
    updateTransformPreviewHostSize(nextHost.clientWidth, nextHost.clientHeight)
  }
})

const transformPreviewScale = computed(() => {
  const face = viewFace.value
  if (!face) {
    return 1
  }

  const previewWidth = transformPreviewHostSize.value.width
  const previewHeight = transformPreviewHostSize.value.height
  return Math.min(
    previewWidth / face.width,
    previewHeight / face.height,
    1,
  )
})
const transformPreviewRendererStyle = computed<CSSProperties>(() => {
  return {
    transform: `scale(${transformPreviewScale.value})`,
    transformOrigin: '0 0',
  }
})
const transformPreviewViewportStyle = computed<CSSProperties>(() => {
  const face = viewFace.value
  if (!face) {
    return {}
  }

  return {
    width: `${Math.round(face.width * transformPreviewScale.value)}px`,
    height: `${Math.round(face.height * transformPreviewScale.value)}px`,
  }
})

const transformPreviewWorldRect = computed(() => {
  const face = viewFace.value
  const viewportScale = viewportTransform.value.scale
  const width = viewportSize.value.width
  const height = viewportSize.value.height
  if (!face || viewportScale <= 0 || width <= 0 || height <= 0) {
    return null
  }

  const worldWidth = width / viewportScale
  const worldHeight = height / viewportScale
  return {
    left: face.width / 2 - worldWidth / 2 - viewportTransform.value.x / viewportScale,
    top: face.height / 2 - worldHeight / 2 - viewportTransform.value.y / viewportScale,
    width: worldWidth,
    height: worldHeight,
  }
})

const transformPreviewFrameStyle = computed<CSSProperties | null>(() => {
  const rect = transformPreviewWorldRect.value
  const previewScale = transformPreviewScale.value
  if (!rect || previewScale <= 0) return null

  return {
    left: `${rect.left * previewScale}px`,
    top: `${rect.top * previewScale}px`,
    width: `${rect.width * previewScale}px`,
    height: `${rect.height * previewScale}px`,
  }
})

const transformPreviewVisibleCoverage = computed(() => {
  const face = viewFace.value
  const rect = transformPreviewWorldRect.value
  if (!face || !rect || face.width <= 0 || face.height <= 0) {
    return 1
  }

  const intersectionWidth = Math.max(
    0,
    Math.min(face.width, rect.left + rect.width) - Math.max(0, rect.left),
  )
  const intersectionHeight = Math.max(
    0,
    Math.min(face.height, rect.top + rect.height) - Math.max(0, rect.top),
  )
  return intersectionWidth * intersectionHeight / (face.width * face.height)
})

const isTransformPreviewFrameVisible = computed(() =>
  transformPreviewVisibleCoverage.value < TRANSFORM_PREVIEW_VISIBILITY_COVERAGE
  || previewDragState.value !== null
)

const viewportScaleLabel = computed(() => `${Math.round(viewportTransform.value.scale * 100)}%`)

function zoomViewportBy(factor: number): void {
  cardViewportRef.value?.zoomBy(factor)
}

function handlePreviewViewportWheel(event: WheelEvent): void {
  const previewViewport = transformPreviewViewportRef.value
  const previewWorldRect = transformPreviewWorldRect.value
  const previewScale = transformPreviewScale.value
  if (!previewViewport || previewScale <= 0) return

  const previewRect = previewViewport.getBoundingClientRect()
  const previewX = Math.min(Math.max(event.clientX - previewRect.left, 0), previewRect.width)
  const previewY = Math.min(Math.max(event.clientY - previewRect.top, 0), previewRect.height)
  const worldX = previewX / previewScale
  const worldY = previewY / previewScale
  const viewportX = previewWorldRect
    ? (worldX - previewWorldRect.left) * viewportTransform.value.scale
    : viewportSize.value.width / 2
  const viewportY = previewWorldRect
    ? (worldY - previewWorldRect.top) * viewportTransform.value.scale
    : viewportSize.value.height / 2
  cardViewportRef.value?.zoomByWheelAt(
    event.deltaY,
    event.deltaMode,
    viewportX,
    viewportY,
  )
}

function resetViewport(): void {
  cardViewportRef.value?.resetView()
}

function commitViewportTransform(payload: { x: number; y: number; scale: number }): void {
  viewportTransform.value = payload
  emit('update-viewport-transform', payload)
}

function handleViewportTransformChange(payload: { x: number; y: number; scale: number }) {
  commitViewportTransform(payload)
}

function handleViewportSizeChange(payload: { width: number; height: number }): void {
  viewportSize.value = payload
}

function startPreviewViewportDrag(event: PointerEvent): void {
  if (event.button !== 0 || transformPreviewScale.value <= 0) return

  event.preventDefault()
  event.stopPropagation()
  const target = event.currentTarget
  if (target instanceof HTMLElement) {
    target.focus()
    target.setPointerCapture(event.pointerId)
  }
  previewDragState.value = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    startTransform: { ...viewportTransform.value },
  }
}

function handlePreviewViewportDrag(event: PointerEvent): void {
  const state = previewDragState.value
  const previewScale = transformPreviewScale.value
  if (!state || state.pointerId !== event.pointerId || previewScale <= 0) return

  const worldDeltaX = (event.clientX - state.startClientX) / previewScale
  const worldDeltaY = (event.clientY - state.startClientY) / previewScale
  commitViewportTransform({
    x: state.startTransform.x - worldDeltaX * state.startTransform.scale,
    y: state.startTransform.y - worldDeltaY * state.startTransform.scale,
    scale: state.startTransform.scale,
  })
}

function stopPreviewViewportDrag(event: PointerEvent): void {
  const state = previewDragState.value
  if (!state || state.pointerId !== event.pointerId) return

  const target = event.currentTarget
  if (target instanceof HTMLElement && target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }
  previewDragState.value = null
}

function handlePreviewViewportKeydown(event: KeyboardEvent): void {
  const step = event.shiftKey ? 40 : 10
  const movement = {
    ArrowLeft: { x: -step, y: 0 },
    ArrowRight: { x: step, y: 0 },
    ArrowUp: { x: 0, y: -step },
    ArrowDown: { x: 0, y: step },
  }[event.key]
  if (!movement) return

  event.preventDefault()
  commitViewportTransform({
    x: viewportTransform.value.x - movement.x * viewportTransform.value.scale,
    y: viewportTransform.value.y - movement.y * viewportTransform.value.scale,
    scale: viewportTransform.value.scale,
  })
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

  const location = selectedLocation.value
  if (location?.type === 'simple-container-location') {
    location.x = formatViewportCssValue(payload.x ?? 0)
    location.y = formatViewportCssValue(payload.y ?? 0)
  }

  refreshDocumentState()
  markDocumentChanged('action')
}

function handleSelectionMove(payload: { x: number; y: number }) {
  const location = selectedLocation.value
  if (location?.type !== 'simple-container-location') {
    return
  }

  location.x = formatViewportCssValue(payload.x)
  location.y = formatViewportCssValue(payload.y)
  refreshDocumentState()
  markDocumentChanged('action')
}

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
  if (target.owner === 'block' || target.owner === 'location') {
    forceStructureTreeReveal.value = true
    selectedBlockKeys.value = target.blockId ? [target.blockId] : []
  } else {
    clearSelection()
  }
  commitViewState()

  const layoutChanged = !isPropertyPanelExpanded.value
    || Boolean(target.blockId && !isStructureTreePanelExpanded.value)
  isPropertyPanelExpanded.value = true
  if (target.blockId) isStructureTreePanelExpanded.value = true
  if (layoutChanged) commitLayoutState()

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
  () => props.cardDesignerLayout,
  (layout) => {
    const panels = layout?.panels
    isInstancePanelExpanded.value = panels?.instanceExpanded ?? true
    isPreviewPanelExpanded.value = panels?.previewExpanded ?? true
    isStructureTreePanelExpanded.value = panels?.structureExpanded ?? true
    isPropertyPanelExpanded.value = panels?.propertyExpanded ?? true
    leftSidebarTopHeight.value = normalizeStoredTopHeight(layout?.leftTopHeight)
    rightSidebarTopHeight.value = normalizeStoredTopHeight(layout?.rightTopHeight)
  },
  { immediate: true, deep: true },
)

watch(
  () => props.cardDesignerView,
  (view) => {
    const nextFace = view?.activeFace ?? 'front'
    if (activeFaceKey.value !== nextFace) {
      activeFaceKey.value = nextFace
      selectedBlockKeys.value = []
      forceStructureTreeReveal.value = false
    }
    clipToFace.value = view?.clipToFace ?? false
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
  navigate,
})

onMounted(() => {
  transformPreviewSizeObserver = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target !== transformPreviewHostRef.value) {
        return
      }

      updateTransformPreviewHostSize(entry.contentRect.width, entry.contentRect.height)
    })
  })
  if (transformPreviewHostRef.value) {
    transformPreviewSizeObserver.observe(transformPreviewHostRef.value)
    updateTransformPreviewHostSize(
      transformPreviewHostRef.value.clientWidth,
      transformPreviewHostRef.value.clientHeight,
    )
  }
})

onUnmounted(() => {
  handleResizeEnd()
  transformPreviewSizeObserver?.disconnect()
  transformPreviewSizeObserver = null
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
  overflow: hidden;
  font-variant-numeric: tabular-nums;
}

.card-design-editor__card-info-list {
  margin: 0;
  padding: 0;
}

.card-design-editor__card-info-list > div {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: var(--oc-space-2);
  padding: 2px 0;
  font-size: 11px;
  line-height: 1.55;
}

.card-design-editor__card-info-list dt {
  color: color-mix(in srgb, var(--oc-fg-muted) 62%, transparent);
}

.card-design-editor__card-info-list dd {
  overflow: hidden;
  margin: 0;
  color: color-mix(in srgb, var(--oc-fg-default) 54%, transparent);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-design-editor__card-info-list dd.is-highlighted {
  animation: card-info-value-highlight 900ms ease-out;
}

@keyframes card-info-value-highlight {
  0% {
    color: var(--oc-fg-accent);
    text-shadow: 0 0 8px color-mix(in srgb, var(--oc-fg-accent) 70%, transparent);
  }

  100% {
    color: color-mix(in srgb, var(--oc-fg-default) 54%, transparent);
    text-shadow: none;
  }
}

.card-design-editor__stage {
  position: relative;
  width: 100%;
  height: 100%;
}

.card-design-editor__stage-base {
  width: 100%;
  height: 100%;
  position: relative;
  z-index: 0;
}

.card-design-editor__stage-layer {
  position: absolute;
  inset: var(--oc-space-4);
  display: flex;
  flex-direction: column;
  pointer-events: none;
  z-index: 2;
}

.card-design-editor__viewport-controls {
  position: absolute;
  left: 50%;
  bottom: 0;
  z-index: 3;
  pointer-events: auto;
  transform: translateX(-50%);
}

.card-design-editor__face-tools {
  position: absolute;
  right: calc(var(--card-editor-right-panel-width, 320px) + 16px);
  bottom: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: var(--oc-space-2);
  pointer-events: auto;
}

.card-design-editor__overlay-layout {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns:
    minmax(0, var(--card-editor-left-panel-width, 320px))
    8px
    max-content
    minmax(0, 1fr)
    8px
    minmax(0, var(--card-editor-right-panel-width, 320px));
  grid-template-rows: minmax(0, 1fr);
  align-items: stretch;
  pointer-events: none !important;
}

.card-design-editor__sidebar {
  --card-design-editor-collapsed-sidebar-height: calc((var(--oc-size-md) + 2px) * 2);
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: grid;
  pointer-events: auto;
  transition: height var(--oc-duration-slow) var(--oc-ease);
}

.card-design-editor__sidebar.is-collapsed {
  height: var(--card-design-editor-collapsed-sidebar-height);
}

.card-design-editor__sidebar--left {
  grid-template-rows: var(--card-editor-left-sidebar-rows);
  align-content: var(--card-editor-left-sidebar-align-content);
  align-self: var(--card-editor-left-sidebar-align-self);
}

.card-design-editor__sidebar--right {
  grid-template-rows: var(--card-editor-right-sidebar-rows);
  align-content: var(--card-editor-right-sidebar-align-content);
  align-self: var(--card-editor-right-sidebar-align-self);
}

.card-design-editor__sidebar-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
}

.card-design-editor__position-readout {
  align-self: start;
  min-width: 0;
  pointer-events: auto;
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

.card-design-editor__resizebar--vertical .card-design-editor__resizebar-visual {
  width: 1px;
  height: 100%;
}

.card-design-editor__resizebar--horizontal {
  height: 8px;
  cursor: row-resize;
}

.card-design-editor__resizebar--horizontal .card-design-editor__resizebar-visual {
  width: 100%;
  height: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .card-design-editor__sidebar,
  .card-design-editor__resizebar--vertical {
    transition: none;
  }
}

@media (max-width: 760px) {
  .card-design-editor__overlay-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .card-design-editor__sidebar,
  .card-design-editor__resizebar,
  .card-design-editor__position-readout,
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
