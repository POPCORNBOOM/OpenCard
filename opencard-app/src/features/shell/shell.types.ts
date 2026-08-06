import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import type { OcActionMenuEntry } from '../../components/standard/OcActionMenu.vue'

export interface ShellAction {
  key?: string;
  hoverTip?: string;
  icon: IconToken;
  disabled?: boolean;
  children?: readonly OcActionMenuEntry[];
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
  detail?: string;
  cancellable?: boolean;
}

export interface ShellTitleBarWindowControl extends ShellTitleBarAppAction {
  group?: 'app' | 'window';
  danger?: boolean;
}
