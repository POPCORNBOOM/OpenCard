export function formatRelativeTime(
  timestamp: number | Date,
  locale: string,
  now = Date.now(),
): string {
  const timestampMs = timestamp instanceof Date ? timestamp.getTime() : timestamp
  const elapsedSeconds = (now - timestampMs) / 1000
  const absoluteSeconds = Math.abs(elapsedSeconds)
  if (absoluteSeconds < 5) return locale.toLocaleLowerCase().startsWith('zh') ? '刚刚' : 'just now'

  const thresholds = [
    { unit: 'second' as const, seconds: 1 },
    { unit: 'minute' as const, seconds: 60 },
    { unit: 'hour' as const, seconds: 60 * 60 },
    { unit: 'day' as const, seconds: 60 * 60 * 24 },
    { unit: 'week' as const, seconds: 60 * 60 * 24 * 7 },
    { unit: 'month' as const, seconds: 60 * 60 * 24 * 30 },
    { unit: 'year' as const, seconds: 60 * 60 * 24 * 365 },
  ]
  const selected = [...thresholds].reverse().find(item => absoluteSeconds >= item.seconds) ?? thresholds[0]
  const value = Math.max(1, Math.round(absoluteSeconds / selected.seconds))
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: selected.unit,
    unitDisplay: 'long',
  }).format(value)
}

