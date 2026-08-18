/** CDE-local command table and keyboard routing. */
import type { Ref } from 'vue'
import type { OcShortcutPart } from '../../components/standard/OcShortcut.vue'

export type CdeShortcutCommandKey =
  | 'block.rename'
  | 'block.duplicate'
  | 'block.delete'
  | 'instance.rename'
  | 'instance.duplicate'
  | 'instance.delete'
  | 'viewport.fit'
  | 'viewport.zoom-in'
  | 'viewport.zoom-out'
  | 'view.toggle-snapping'
  | 'view.toggle-clip'
  | 'view.switch-face'
  | 'view.toggle-diff-mode'
  | 'view.diff-divider-left'
  | 'view.diff-divider-center'
  | 'view.diff-divider-right'

type CdeShortcutScope = 'canvas' | 'instance-tree' | 'structure-tree'

type CdeShortcutBinding = {
  key: string
  mod?: boolean
  shift?: boolean
}

export type CdeShortcutCommand = {
  key: CdeShortcutCommandKey
  shortcut: readonly CdeShortcutBinding[]
  scopes?: readonly CdeShortcutScope[]
  canRun: () => boolean
  run: () => void
}

type UseCdeShortcutsOptions = {
  rootElement: Readonly<Ref<HTMLElement | null>>
  commands: readonly CdeShortcutCommand[]
}

const commandBindings: Readonly<Record<CdeShortcutCommandKey, readonly CdeShortcutBinding[]>> = {
  'block.rename': [{ key: 'F2' }],
  'block.duplicate': [{ key: 'd', mod: true }],
  'block.delete': [{ key: 'Delete' }, { key: 'Backspace' }],
  'instance.rename': [{ key: 'F2' }],
  'instance.duplicate': [{ key: 'd', mod: true }],
  'instance.delete': [{ key: 'Delete' }, { key: 'Backspace' }],
  'viewport.fit': [{ key: '0', mod: true }],
  'viewport.zoom-in': [{ key: '+', mod: true }, { key: '=', mod: true }],
  'viewport.zoom-out': [{ key: '-', mod: true }],
  'view.toggle-snapping': [{ key: 's' }],
  'view.toggle-clip': [{ key: 'x' }],
  'view.switch-face': [{ key: 'b' }],
  'view.toggle-diff-mode': [{ key: 'v' }],
  'view.diff-divider-left': [{ key: 'a' }],
  'view.diff-divider-center': [{ key: 's' }],
  'view.diff-divider-right': [{ key: 'd' }],
}

export function getCdeShortcutBindings(key: CdeShortcutCommandKey): readonly CdeShortcutBinding[] {
  return commandBindings[key]
}

export function getCdeShortcutParts(key: CdeShortcutCommandKey): readonly OcShortcutPart[] {
  const binding = commandBindings[key][0]!
  const parts: OcShortcutPart[] = []
  if (binding.mod) parts.push(isMacPlatform() ? '⌘' : 'Ctrl')
  if (binding.shift) parts.push(isMacPlatform() ? '⇧' : 'Shift')
  parts.push(displayKey(binding.key))
  return parts
}

export function formatCdeShortcutMarkup(key: CdeShortcutCommandKey): string {
  return getCdeShortcutParts(key)
    .map(part => typeof part === 'string' ? `[key]${part}[/key]` : '')
    .filter(Boolean)
    .join(' + ')
}

export function useCdeShortcuts(options: UseCdeShortcutsOptions) {
  function handleKeydown(event: KeyboardEvent): void {
    const root = options.rootElement.value
    if (
      !root
      || event.defaultPrevented
      || event.isComposing
      || event.altKey
      || !event.composedPath().includes(root)
      || isEditableEventPath(event.composedPath())
    ) return

    const scope = resolveScope(event, root)
    for (const command of options.commands) {
      if (command.scopes && (!scope || !command.scopes.includes(scope))) continue
      if (!command.shortcut.some(binding => matchesBinding(event, binding))) continue
      if (!command.canRun()) continue
      event.preventDefault()
      event.stopPropagation()
      command.run()
      return
    }
  }

  return { handleKeydown }
}

function resolveScope(event: KeyboardEvent, root: HTMLElement): CdeShortcutScope | null {
  if (event.target === root) return 'canvas'
  for (const target of event.composedPath()) {
    if (!(target instanceof HTMLElement)) continue
    const scope = target.dataset.cdeShortcutScope
    if (scope === 'canvas' || scope === 'instance-tree' || scope === 'structure-tree') return scope
    if (target === root) break
  }
  return null
}

function isEditableEventPath(path: readonly EventTarget[]): boolean {
  return path.some(target => target instanceof Element && (
    target.matches('input, textarea, select, [contenteditable="true"], .monaco-editor')
    || target.getAttribute('role') === 'textbox'
  ))
}

function matchesBinding(event: KeyboardEvent, binding: CdeShortcutBinding): boolean {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  const expectedKey = binding.key.length === 1 ? binding.key.toLowerCase() : binding.key
  const hasMod = event.ctrlKey || event.metaKey
  if (Boolean(binding.mod) !== hasMod) return false
  if (binding.shift === true && !event.shiftKey) return false
  if (binding.shift !== true && event.shiftKey && binding.key !== '+') return false
  return key === expectedKey
}

function displayKey(key: string): string {
  if (key === 'Delete') return 'Del'
  return key.length === 1 ? key.toUpperCase() : key
}

function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Macintosh|Mac OS X/.test(navigator.userAgent)
}
