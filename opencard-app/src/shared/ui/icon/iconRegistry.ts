/**
 * 模块说明：
 * - 作为图标系统统一导出入口
 * 职责边界：
 * - 只聚合 token/type/resolver，不承载具体库映射实现
 */
import type { IconToken } from './iconTokens'
import type { IconGlyph, IconPackId } from './iconTypes'
import { iconTokens } from './iconTokens'
import {
  DEFAULT_ICON_PACK,
  DEFAULT_ICON_TOKEN,
  UNKNOWN_ICON_TOKEN,
  getActiveIconPack,
  resolveIcon,
  setActiveIconPack,
  type IconResolvable,
} from './iconResolver'

export type IconName = IconToken
export type IconDefinition = IconGlyph
export type { IconToken, IconGlyph, IconPackId, IconResolvable }

export type IconTone =
  | 'default'
  | 'muted'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'opencard'
  | 'json'
  | 'markdown'
  | 'typescript'
  | 'javascript'
  | 'vue'
  | 'html'
  | 'css'
  | 'image'
  | 'package'
  | 'config'
  | 'folder-default'
  | 'folder-open'
  | 'folder-src'
  | 'folder-assets'
  | 'folder-components'
  | 'folder-views'
  | 'folder-locales'
  | 'folder-core'

export {
  iconTokens,
  DEFAULT_ICON_PACK,
  DEFAULT_ICON_TOKEN,
  UNKNOWN_ICON_TOKEN,
  getActiveIconPack,
  resolveIcon,
  setActiveIconPack,
}
