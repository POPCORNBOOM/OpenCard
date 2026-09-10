/** Builds the inline action definitions shared by the card designer tree projections. */
import type { OcNodeAction } from '../../shared/ui/node/node.types'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import { getCdeShortcutParts, type CdeShortcutCommandKey } from './useCdeShortcuts'

export function cdeNodeAction(
  key: string,
  icon: IconToken,
  title: string,
  options?: {
    shortcut?: CdeShortcutCommandKey
    iconTone?: OcNodeAction['iconTone']
    children?: readonly OcNodeAction[]
  },
): OcNodeAction {
  return {
    key,
    icon,
    title,
    ...(options?.shortcut ? { shortcut: getCdeShortcutParts(options.shortcut) } : {}),
    ...(options?.iconTone ? { iconTone: options.iconTone } : {}),
    ...(options?.children ? { children: options.children } : {}),
  }
}
