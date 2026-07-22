import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import type { OcActionMenuEntry } from '../../components/standard/OcActionMenu.vue'

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

export interface ShellTitleBarMenuGroup {
  key: string;
  label: string;
  actions: readonly OcActionMenuEntry[];
}

export interface ShellTitleBarWindowControl {
  key: string;
  icon: IconToken;
  group?: 'app' | 'window';
  hoverTip?: string;
  danger?: boolean;
  spinning?: boolean;
}
