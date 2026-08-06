/** Session-owned UI state contracts shared by editor hosts and editor components. */
import type { CardFaceKey } from '../../../entities/card/model'

export interface EditorViewportTransform {
  x: number
  y: number
  scale: number
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
}

export type CardDesignerMode = 'design' | 'data-table'

export interface CardDesignerViewState {
  activeFace: CardFaceKey
  clipToFace: boolean
  alignmentSnappingEnabled?: boolean
  selectedInstanceId: string | null
}
