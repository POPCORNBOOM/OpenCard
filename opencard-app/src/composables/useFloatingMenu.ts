import { shallowReadonly, shallowRef } from 'vue'
import type { OcActionMenuEntry } from '../components/standard/OcActionMenu.vue'

export type FloatingMenuItem = OcActionMenuEntry

export type FloatingMenuPlacement = 'bottom-start' | 'bottom-end'

interface FloatingMenuState {
  isOpen: boolean
  items: readonly FloatingMenuItem[]
  anchor: HTMLElement | DOMRect | null
  placement: FloatingMenuPlacement
}

export interface OpenFloatingMenuOptions {
  anchor: HTMLElement | DOMRect
  items: readonly FloatingMenuItem[]
  placement?: FloatingMenuPlacement
  onSelect?: (key: string) => void
}

const state = shallowRef<FloatingMenuState>({
  isOpen: false,
  items: [],
  anchor: null,
  placement: 'bottom-end',
})

const publicState = shallowReadonly(state)

let selectHandler: ((key: string) => void) | null = null

function openMenu(options: OpenFloatingMenuOptions): void {
  state.value = {
    isOpen: true,
    items: options.items,
    anchor: options.anchor,
    placement: options.placement ?? 'bottom-end',
  }
  selectHandler = options.onSelect ?? null
}

function closeMenu(): void {
  state.value = {
    ...state.value,
    isOpen: false,
    items: [],
    anchor: null,
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
    state: publicState,
    openMenu,
    closeMenu,
    selectMenuItem,
  }
}
