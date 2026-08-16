import type { IconToken, IconTone } from './icon/iconRegistry'

/** Read-only semantic markers shared by trees, property rows and data grids. */
export interface OcDisplayAction {
  key: string
  icon: IconToken
  tone?: IconTone
  tooltip?: string
}

export interface OcDisplayActionSlots {
  leading?: readonly OcDisplayAction[]
  trailing?: readonly OcDisplayAction[]
}
