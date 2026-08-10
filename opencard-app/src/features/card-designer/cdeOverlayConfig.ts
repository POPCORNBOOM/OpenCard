import { OC_SHARED_THEME_TOKENS } from '../../shared/ui/foundation/themes'
import type { CdeOverlayGeometryConfig } from './cdeOverlayGeometry'

/** CardEditor Overlay 的结构 token 投影；数值来源仍是 foundation shared tokens。 */
export const CDE_OVERLAY_GEOMETRY_CONFIG: CdeOverlayGeometryConfig = {
  collapsedExtent: 0,
  minExtent: readPixels('--oc-card-editor-dock-min-width'),
  maxExtent: readPixels('--oc-card-editor-dock-max-width'),
  expandDragThreshold: readPixels('--oc-card-editor-dock-expand-threshold'),
  collapseDragThreshold: readPixels('--oc-card-editor-dock-collapse-threshold'),
  floatingGap: readPixels('--oc-floating-surface-gap'),
}

export const CDE_OVERLAY_TOP_MIN_HEIGHT = readPixels('--oc-card-editor-dock-top-min-height')
export const CDE_OVERLAY_BOTTOM_MIN_HEIGHT = readPixels('--oc-card-editor-dock-bottom-min-height')
export const CDE_OVERLAY_RESPONSIVE_WIDTH = readPixels('--oc-card-editor-dock-responsive-width')
export const CDE_OVERLAY_SPLIT_GAP = readPixels('--oc-space-3')

function readPixels(token: keyof typeof OC_SHARED_THEME_TOKENS): number {
  const value = Number.parseFloat(OC_SHARED_THEME_TOKENS[token])
  if (!Number.isFinite(value)) throw new Error(`Invalid foundation pixel token: ${token}`)
  return value
}
