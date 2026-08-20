import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import type { OcActionMenuEntry } from '../../components/standard/OcActionMenu.vue'

export interface ShellAction {
  type?: 'action' | 'selection';
  key?: string;
  value?: string;
  options?: readonly OcActionMenuEntry[];
  hoverTip?: string;
  icon: IconToken;
  disabled?: boolean;
  badge?: number;
  badgeLabel?: string;
  children?: readonly OcActionMenuEntry[];
}

export interface ShellButton {
  icon?: IconToken;
  title: string;
  hoverTip?: string;
  key: string;
  disabled?: boolean;
}

export type ShellWorkspaceAction = ShellAction | string

export interface ShellList {
  title: string;
  placeholder: string;
  key: string;
  actions: ShellAction[];
}

export interface ShellListGroup {
  key: string;
  transitionKey?: string;
  title: string;
  icon?: IconToken;
  headButtons?: ShellButton[];
  lists: ShellList[];
}
export interface ShellTitleBarMenuGroup {
  key: string;
  label: string;
  badge?: number;
  badgeLabel?: string;
  actions: readonly OcActionMenuEntry[];
}

export interface ShellTitleBarAppAction {
  key: string;
  icon: IconToken;
  hoverTip?: string;
  disabled?: boolean;
}

export interface ShellProgressTask {
  key: string;
  title: string;
  progress: number;
  weight?: number;
  active?: boolean;
  detail?: string;
  cancellable?: boolean;
}

export interface ShellTitleBarWindowControl extends ShellTitleBarAppAction {
  group?: 'app' | 'window';
  danger?: boolean;
}
