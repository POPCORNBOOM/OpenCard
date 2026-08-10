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
