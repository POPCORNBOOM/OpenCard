/** Key-only UI contract for node collections consumed by OcTree and OcAlbum. */
import type { IconToken, IconTone } from '../icon/iconRegistry'
import type { OcActionButtonAction } from '../../../components/standard/OcActionButton.vue'
import type { OcActionDivider } from '../../../components/standard/OcActionMenu.vue'

export type OcNodeKey = string

/** Locale-independent tone applied to the node label. */
export type OcNodeTone = 'default' | 'muted' | 'subtle' | 'accent' | 'success' | 'warning' | 'danger'

export type OcNodeDropPosition = 'before' | 'inside' | 'after'

export interface OcNodeRenameSelection {
  start: number
  end: number
}

/** Read-only status chip shown in the node tail. */
export interface OcNodeBadge {
  type: 'badge'
  icon: IconToken
  tone?: IconTone
  label: string
}

/** Inline action definition; its `key` is reported back through the node action event. */
export type OcNodeAction = OcActionButtonAction

/**
 * One ordered trailing line per node: secondary text, read-only status chips, and commands.
 * Commands are the parts that carry a `key`; views render them as buttons in the same order,
 * revealed on interaction.
 */
export type OcNodeTailPart = string | OcNodeBadge | OcNodeAction

export type OcNodeContextEntry = OcNodeAction | OcActionDivider

/** Presentation of one node; its identity is the key it is stored under in `OcNodeCollection.items`. */
export interface OcNode {
  label: string
  icon?: IconToken
  iconTone?: IconTone
  thumbnailStyle?: Readonly<Record<string, string>>
  thumbnailLabel?: string
  /** Resolved image source used by card views such as OcAlbum. */
  thumbnailSrc?: string
  tone?: OcNodeTone
  /** Trailing line of the node, in order; text and badges are always visible, commands appear on interaction. */
  tail?: OcNodeTailPart | readonly OcNodeTailPart[]
  disabled?: boolean
  disabledReason?: string
  renamable?: boolean
  renameSelection?: OcNodeRenameSelection
  draggable?: boolean
  /** Context-menu entries offered by this node. */
  contextActions?: readonly OcNodeContextEntry[]
}

export interface OcNodeCollection {
  rootKeys: readonly OcNodeKey[]
  items: ReadonlyMap<OcNodeKey, OcNode>
  children: ReadonlyMap<OcNodeKey, readonly OcNodeKey[]>
}

export interface OcNodeSelectionEvent {
  triggerKey: OcNodeKey
  selectedKeys: OcNodeKey[]
}

export interface OcNodeExpansionEvent {
  key: OcNodeKey
  expanded: boolean
}

export interface OcNodeExpansionSyncEvent {
  expandedKeys: OcNodeKey[]
}

export interface OcNodeActivateEvent {
  key: OcNodeKey
}

export interface OcNodeActionEvent {
  key: OcNodeKey
  actionKey: string
  source: 'inline' | 'context'
}

export interface OcNodeRenameCommitEvent {
  key: OcNodeKey
  name: string
}

export interface OcNodeMoveEvent {
  key: OcNodeKey
  targetKey: OcNodeKey | null
  position: OcNodeDropPosition
}

export function normalizeNodeTail(
  tail: OcNode['tail'],
): readonly OcNodeTailPart[] {
  if (!tail) return []
  return Array.isArray(tail) ? tail : [tail]
}

/** A tail part is a command when it carries a badge-free `key`; badges are the only other object part. */
export function isNodeTailAction(part: OcNodeTailPart): part is OcNodeAction {
  return typeof part !== 'string' && part.type !== 'badge'
}
