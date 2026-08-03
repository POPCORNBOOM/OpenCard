export const VIEWPORT_MIN_SCALE = 0.2
export const VIEWPORT_MAX_SCALE = 4
export const VIEWPORT_ZOOM_STEP = 1.25
export const VIEWPORT_WHEEL_ZOOM_SENSITIVITY = 0.0015
export const VIEWPORT_ZOOM_ANIMATION_SMOOTHING = 0.25
export const VIEWPORT_ZOOM_ANIMATION_EPSILON = 0.001
export const VIEWPORT_FIT_PADDING = 32

const VIEWPORT_WHEEL_LINE_HEIGHT = 16
const VIEWPORT_MAX_WHEEL_DELTA_PX = 240

export function clampViewportScale(
  value: number,
  minimum = VIEWPORT_MIN_SCALE,
  maximum = VIEWPORT_MAX_SCALE,
): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function normalizeViewportWheelDelta(
  deltaY: number,
  deltaMode: number,
  pageHeight: number,
): number {
  let delta = deltaY
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= VIEWPORT_WHEEL_LINE_HEIGHT
  else if (deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= pageHeight
  return Math.min(VIEWPORT_MAX_WHEEL_DELTA_PX, Math.max(-VIEWPORT_MAX_WHEEL_DELTA_PX, delta))
}
