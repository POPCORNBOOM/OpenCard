/**
 * 模块说明：
 * - 解析图标语义 token 到具体图标库描述
 * 职责边界：
 * - 负责 active pack、fallback pack 与缺失告警
 */
import { iconPacks } from './iconPacks'
import type { IconToken } from './iconTokens'
import type { IconGlyph, IconPackId } from './iconTypes'

export type IconResolvable = IconToken | IconGlyph

export const DEFAULT_ICON_PACK: IconPackId = 'codicon'
export const UNKNOWN_ICON_TOKEN: IconToken = 'status.unknown'
export const DEFAULT_ICON_TOKEN: IconToken = 'file.default'

let activeIconPack: IconPackId = 'mdi'
const warnedMissingTokens = new Set<string>()

function isIconGlyph(value: unknown): value is IconGlyph {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<IconGlyph>
  return (
    (candidate.pack === 'codicon' || candidate.pack === 'mdi')
    && typeof candidate.value === 'string'
  )
}

function warnMissingToken(token: string, source: string): void {
  if (!import.meta.env.DEV) {
    return
  }

  if (warnedMissingTokens.has(token)) {
    return
  }

  warnedMissingTokens.add(token)
  console.warn(`[icon] unresolved token: "${token}" at ${source}, fallback to "${UNKNOWN_ICON_TOKEN}"`)
}

function resolveToken(token: IconToken): IconGlyph | null {
  const activeGlyph = iconPacks[activeIconPack][token]
  if (activeGlyph) {
    return activeGlyph
  }

  const defaultGlyph = iconPacks[DEFAULT_ICON_PACK][token]
  if (defaultGlyph) {
    return defaultGlyph
  }

  return null
}

export function getActiveIconPack(): IconPackId {
  return activeIconPack
}

export function setActiveIconPack(pack: IconPackId): void {
  activeIconPack = pack
}

export function resolveIcon(input?: IconResolvable, source = 'unknown'): IconGlyph {
  if (isIconGlyph(input)) {
    return input
  }

  const token = input ?? DEFAULT_ICON_TOKEN
  const resolved = resolveToken(token)
  if (resolved) {
    return resolved
  }

  warnMissingToken(token, source)

  const unknownResolved = resolveToken(UNKNOWN_ICON_TOKEN)
  if (unknownResolved) {
    return unknownResolved
  }

  return { pack: 'codicon', value: 'codicon-question' }
}
