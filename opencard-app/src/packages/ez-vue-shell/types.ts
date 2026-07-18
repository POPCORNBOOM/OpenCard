export interface EzShellAction {
  key?: string;
  hoverTip?: string;
  icon: string;
  color?: string;
  disabled?: boolean;
}

export interface EzShellButton {
  icon?: string;
  title: string;
  hoverTip?: string;
  key: string;
  disabled?: boolean;
}

export interface EzShellList {
  title: string;
  placeholder: string;
  key: string;
  actions: EzShellAction[];
}

export interface EzShellSidebarModel {
  headButtons: EzShellButton[];
  bodyLists: EzShellList[];
  tailButtons: EzShellButton[];
}

export interface EzTitleBarMenuAction {
  key: string;
  label: string;
}

export interface EzTitleBarMenuGroup {
  key: string;
  label: string;
  items: EzTitleBarMenuAction[];
}

export interface EzTitleBarWindowControl {
  key: string;
  icon: string;
  hoverTip?: string;
  danger?: boolean;
}

export interface EzSelectOption {
  value: string;
  label: string;
}
