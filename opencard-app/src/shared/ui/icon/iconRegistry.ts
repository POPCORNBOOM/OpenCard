/**
 * 模块说明：
 * - 作为图标系统统一导出入口
 * 职责边界：
 * - 只聚合 token/type/resolver，不承载具体库映射实现
 */
import type { IconToken } from './iconTokens'
import type { IconGlyph } from './iconTypes'
import { iconTokens } from './iconTokens'
import {
  DEFAULT_ICON_TOKEN,
  UNKNOWN_ICON_TOKEN,
  resolveIcon,
  type IconResolvable,
} from './iconResolver'

export type IconName = IconToken
export type IconDefinition = IconGlyph
export type { IconToken, IconGlyph, IconResolvable }

export type IconTone =
  | 'default'
  | 'muted'
  | 'primary'
  | 'success'
  | 'active'
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
  | 'config'
  | 'folder-default'
  | 'folder-open'

export {
  iconTokens,
  DEFAULT_ICON_TOKEN,
  UNKNOWN_ICON_TOKEN,
  resolveIcon,
}
