/** Presentation an editor supplies for itself, so the shell never restates editor copy. */
import type { IconToken, IconTone } from './icon/iconRegistry'

export type EditorPresentation = {
  title: string
  description: string
  icon: IconToken
  iconTone?: IconTone
}
