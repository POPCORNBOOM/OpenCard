import { readonly, ref } from 'vue'

export interface FloatingMenuItem {
  key: string
  label: string
  icon?: string
  disabled?: boolean
  children?: readonly FloatingMenuItem[]
}

export type FloatingMenuPlacement = 'bottom-start' | 'bottom-end'

interface FloatingMenuState {
  isOpen: boolean
  items: readonly FloatingMenuItem[]
  anchorRect: DOMRect | null
  placement: FloatingMenuPlacement
}

export interface OpenFloatingMenuOptions {
  anchor: HTMLElement | DOMRect
  items: readonly FloatingMenuItem[]
  placement?: FloatingMenuPlacement
  onSelect?: (key: string) => void
}

const state = ref<FloatingMenuState>({
  isOpen: false,
  items: [],
  anchorRect: null,
  placement: 'bottom-end',
})

let selectHandler: ((key: string) => void) | null = null

function resolveAnchorRect(anchor: HTMLElement | DOMRect): DOMRect {
  if (anchor instanceof HTMLElement) {
    return anchor.getBoundingClientRect()
  }

  return anchor
}

function openMenu(options: OpenFloatingMenuOptions): void {
  state.value = {
    isOpen: true,
    items: options.items,
    anchorRect: resolveAnchorRect(options.anchor),
    placement: options.placement ?? 'bottom-end',
  }
  selectHandler = options.onSelect ?? null
}

function closeMenu(): void {
  state.value = {
    ...state.value,
    isOpen: false,
    items: [],
    anchorRect: null,
  }
  selectHandler = null
}

function selectMenuItem(key: string): void {
  const handler = selectHandler
  closeMenu()
  handler?.(key)
}

export function useFloatingMenu() {
  return {
    state: readonly(state),
    openMenu,
    closeMenu,
    selectMenuItem,
  }
}
