export interface HsvColor {
  hue: number
  saturation: number
  value: number
}

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim()
  if (/^#[\da-f]{6}$/i.test(trimmed)) return trimmed.toUpperCase()
  if (!/^#[\da-f]{3}$/i.test(trimmed)) return null
  return `#${trimmed.slice(1).split('').map(channel => channel.repeat(2)).join('')}`.toUpperCase()
}

export function hexToHsv(value: string): HsvColor | null {
  const normalized = normalizeHexColor(value)
  if (!normalized) return null
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const delta = maximum - minimum
  let hue = 0

  if (delta > 0) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (maximum === green) hue = 60 * (((blue - red) / delta) + 2)
    else hue = 60 * (((red - green) / delta) + 4)
  }
  if (hue < 0) hue += 360

  return {
    hue,
    saturation: maximum === 0 ? 0 : delta / maximum,
    value: maximum,
  }
}

export function hsvToHex(color: HsvColor): string {
  const hue = ((color.hue % 360) + 360) % 360
  const saturation = clampUnit(color.saturation)
  const value = clampUnit(color.value)
  const chroma = value * saturation
  const sector = hue / 60
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1))
  const offset = value - chroma
  let channels: [number, number, number]

  if (sector < 1) channels = [chroma, secondary, 0]
  else if (sector < 2) channels = [secondary, chroma, 0]
  else if (sector < 3) channels = [0, chroma, secondary]
  else if (sector < 4) channels = [0, secondary, chroma]
  else if (sector < 5) channels = [secondary, 0, chroma]
  else channels = [chroma, 0, secondary]

  return `#${channels.map(channel => (
    Math.round((channel + offset) * 255).toString(16).padStart(2, '0')
  )).join('')}`.toUpperCase()
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}
