export function hasActionBadge(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function formatActionBadge(value: number): string {
  const count = Math.floor(value)
  return count > 99 ? '99+' : String(count)
}

export function actionAccessibleLabel(title: string, badgeLabel?: string): string {
  return badgeLabel ? `${title}, ${badgeLabel}` : title
}

/** Title text for an action, appending the reason while it is disabled. */
export function actionTitleText(action: {
  title?: string
  disabled?: boolean
  disabledReason?: string
}): string | undefined {
  if (!action.disabled || !action.disabledReason) return action.title
  return action.title ? `${action.title}: ${action.disabledReason}` : action.disabledReason
}
