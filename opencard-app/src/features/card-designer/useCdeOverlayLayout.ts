/**
 * Card Designer overlay layout state.
 *
 * Dock components own pointer/keyboard resize lifecycles. This controller owns
 * only session panel state, transient dock extents, and the shared viewport
 * inset projection.
 */
import { computed, ref, watch, type CSSProperties, type Ref } from 'vue'
import type { CardDesignerLayoutState } from '../editor-runtime/model/editorUiState'
import {
  clampCdeOverlayExtent,
  resolveCdeOverlayViewportInsets,
  settleCdeOverlayExtent,
  type CdeOverlayGeometryConfig,
  type CdeOverlaySide,
} from './cdeOverlayGeometry'

type OverlayPanel = 'instance' | 'preview' | 'structure' | 'property'
type UseCdeOverlayLayoutOptions = {
  layout: Readonly<Ref<CardDesignerLayoutState | undefined>>
  geometryConfig: Readonly<CdeOverlayGeometryConfig>
  topMinHeight: number
  commitLayout: (layout: CardDesignerLayoutState) => void
}

export function useCdeOverlayLayout(options: UseCdeOverlayLayoutOptions) {
  const isInstancePanelExpanded = ref(true)
  const isPreviewPanelExpanded = ref(true)
  const isStructureTreePanelExpanded = ref(true)
  const isPropertyPanelExpanded = ref(true)
  const leftDockExtent = ref(options.geometryConfig.minExtent)
  const rightDockExtent = ref(options.geometryConfig.minExtent)
  const leftSidebarTopHeight = ref<number | null>(null)
  const rightSidebarTopHeight = ref<number | null>(null)
  const viewportInsets = computed(() => resolveCdeOverlayViewportInsets(
    leftDockExtent.value,
    rightDockExtent.value,
    options.geometryConfig,
  ))
  const editorShellStyle = computed<CSSProperties>(() => ({
    display: 'flex',
    flex: '1 1 auto',
    width: '100%',
    height: '100%',
    minWidth: '0',
    minHeight: '0',
    position: 'relative',
    overflow: 'hidden',
  }))

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
    options.commitLayout(createLayoutState())
  }

  function updateDockExtent(side: CdeOverlaySide, extent: number): void {
    const next = clampCdeOverlayExtent(extent, options.geometryConfig)
    if (side === 'left') leftDockExtent.value = next
    else rightDockExtent.value = next
  }

  function settleDockExtent(side: CdeOverlaySide, extent: number, startExtent: number): void {
    const next = settleCdeOverlayExtent(extent, startExtent, options.geometryConfig)
    if (side === 'left') leftDockExtent.value = next
    else rightDockExtent.value = next
  }

  function updateDockTopSize(side: CdeOverlaySide, value: number | null): void {
    if (side === 'left') leftSidebarTopHeight.value = normalizeStoredTopHeight(value, options.topMinHeight)
    else rightSidebarTopHeight.value = normalizeStoredTopHeight(value, options.topMinHeight)
  }

  function togglePanel(panel: OverlayPanel): void {
    const target = panel === 'instance'
      ? isInstancePanelExpanded
      : panel === 'preview'
        ? isPreviewPanelExpanded
        : panel === 'structure'
          ? isStructureTreePanelExpanded
          : isPropertyPanelExpanded
    target.value = !target.value
    commitLayoutState()
  }

  function ensurePanelsExpanded(panels: readonly OverlayPanel[]): boolean {
    let changed = false
    for (const panel of panels) {
      const target = panel === 'instance'
        ? isInstancePanelExpanded
        : panel === 'preview'
          ? isPreviewPanelExpanded
          : panel === 'structure'
            ? isStructureTreePanelExpanded
            : isPropertyPanelExpanded
      if (!target.value) {
        target.value = true
        changed = true
      }
    }
    if (changed) commitLayoutState()
    return changed
  }

  watch(
    options.layout,
    layout => {
      const panels = layout?.panels
      isInstancePanelExpanded.value = panels?.instanceExpanded ?? true
      isPreviewPanelExpanded.value = panels?.previewExpanded ?? true
      isStructureTreePanelExpanded.value = panels?.structureExpanded ?? true
      isPropertyPanelExpanded.value = panels?.propertyExpanded ?? true
      leftSidebarTopHeight.value = normalizeStoredTopHeight(layout?.leftTopHeight, options.topMinHeight)
      rightSidebarTopHeight.value = normalizeStoredTopHeight(layout?.rightTopHeight, options.topMinHeight)
    },
    { immediate: true, deep: true },
  )

  return {
    editorShellStyle,
    ensurePanelsExpanded,
    commitLayout: commitLayoutState,
    isInstancePanelExpanded,
    isPreviewPanelExpanded,
    isPropertyPanelExpanded,
    isStructureTreePanelExpanded,
    leftDockExtent,
    leftSidebarTopHeight,
    rightDockExtent,
    rightSidebarTopHeight,
    settleDockExtent,
    togglePanel,
    updateDockExtent,
    updateDockTopSize,
    viewportInsets,
  }
}

function normalizeStoredTopHeight(value: number | null | undefined, minimum: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(minimum, value) : null
}
