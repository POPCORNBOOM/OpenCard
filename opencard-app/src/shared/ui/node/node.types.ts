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

/** Tail content of a node: secondary text or a read-only status chip. */
export type OcNodeTailPart = string | OcNodeBadge

/** Inline action definition; its `key` is reported back through the node action event. */
export type OcNodeAction = OcActionButtonAction

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
  tail?: OcNodeTailPart | readonly OcNodeTailPart[]
  disabled?: boolean
  disabledReason?: string
  renamable?: boolean
  renameSelection?: OcNodeRenameSelection
  draggable?: boolean
  /** Commands offered by this node, rendered in its trailing control area. */
  actions?: readonly OcNodeAction[]
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
