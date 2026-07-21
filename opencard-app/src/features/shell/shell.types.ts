import type { IconToken } from '../../shared/ui/icon/iconRegistry'

export interface ShellAction {
  key?: string;
  hoverTip?: string;
  icon: IconToken;
  disabled?: boolean;
}

export interface ShellButton {
  icon?: IconToken;
  title: string;
  hoverTip?: string;
  key: string;
  disabled?: boolean;
}

export interface ShellList {
  title: string;
  placeholder: string;
  key: string;
  actions: ShellAction[];
  maxHeight?: string;
}

export interface ShellTitleBarMenuAction {
  key: string;
  label: string;
  disabled?: boolean;
}

export interface ShellTitleBarMenuGroup {
  key: string;
  label: string;
  items: ShellTitleBarMenuAction[];
}

export interface ShellTitleBarWindowControl {
  key: string;
  icon: IconToken;
  hoverTip?: string;
  danger?: boolean;
  spinning?: boolean;
}
