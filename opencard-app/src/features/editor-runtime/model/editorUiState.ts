/** Session-owned UI state contracts shared by editor hosts and editor components. */
import type { CardFaceKey } from '../../../entities/card/model'

export interface EditorViewportTransform {
  x: number
  y: number
  scale: number
}

export type EditorDiffViewMode = 'split' | 'side-by-side'

export interface EditorDiffUiState {
  divider: number
  viewMode?: EditorDiffViewMode
}

export interface CardDesignerPanelState {
  instanceExpanded: boolean
  previewExpanded: boolean
  structureExpanded: boolean
  propertyExpanded: boolean
}

export interface CardDesignerLayoutState {
  panels: CardDesignerPanelState
  leftTopHeight: number | null
  rightTopHeight: number | null
  leftDockExtent: number
  rightDockExtent: number
  leftExpandedDockExtent: number
  rightExpandedDockExtent: number
}

export type CardDesignerMode = 'design' | 'data-table'

export interface CardDesignerViewState {
  activeFace: CardFaceKey
  clipToFace: boolean
  alignmentSnappingEnabled?: boolean
  selectedInstanceId: string | null
}
