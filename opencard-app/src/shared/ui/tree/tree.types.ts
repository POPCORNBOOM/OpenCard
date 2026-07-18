/** Key-only UI contract for OcTree data, actions, and emitted intent. */
import type { IconToken, IconTone } from '../icon/iconRegistry'

export type OcTreeKey = string
export type OcTreeActionKey = string
export type OcTreeDropPosition = 'before' | 'inside' | 'after'

export interface OcTreeData {
  rootKeys: readonly OcTreeKey[]
  items: ReadonlyMap<OcTreeKey, OcTreeItem>
  children: ReadonlyMap<OcTreeKey, readonly OcTreeKey[]>
}

export interface OcTreeItem {
  label: string
  icon?: IconToken
  iconTone?: IconTone
  disabled?: boolean
  disabledReason?: string
  renamable?: boolean
  draggable?: boolean
  actions?: readonly OcTreeActionKey[]
  disabledActions?: ReadonlyMap<OcTreeActionKey, string>
}

export interface OcTreeActionDefinition {
  title: string
  icon?: IconToken
  iconTone?: IconTone
  children?: readonly OcTreeActionKey[]
}

export type OcTreeIntent =
  | {
      type: 'selection.change'
      triggerKey: OcTreeKey
      selectedKeys: OcTreeKey[]
      mode: 'replace' | 'toggle'
    }
  | {
      type: 'expansion.change'
      key: OcTreeKey
      expanded: boolean
    }
  | {
      type: 'expansion.sync'
      expandedKeys: OcTreeKey[]
      reason: 'selection'
    }
  | {
      type: 'node.activate'
      key: OcTreeKey
    }
  | {
      type: 'action.invoke'
      key: OcTreeKey
      actionKey: OcTreeActionKey
    }
  | {
      type: 'rename.commit'
      key: OcTreeKey
      name: string
    }
  | {
      type: 'move.request'
      key: OcTreeKey
      targetKey: OcTreeKey | null
      position: OcTreeDropPosition
    }
