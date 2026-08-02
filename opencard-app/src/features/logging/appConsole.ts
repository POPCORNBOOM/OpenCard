import { readonly, shallowRef, type ShallowRef } from 'vue'
import {
  isAppErrorReport,
  type AppErrorCode,
  type AppErrorReport,
} from './appErrorCatalog'

export const APP_CONSOLE_SEVERITIES = ['debug', 'log', 'info', 'warn', 'error'] as const
export type AppConsoleSeverity = (typeof APP_CONSOLE_SEVERITIES)[number]

export type AppConsoleEntry = {
  id: number
  severity: AppConsoleSeverity
  timestamp: number
  message: string
  errorCode?: AppErrorCode
}

const MAX_ENTRY_COUNT = 1_000
const GLOBAL_STATE_KEY = '__OPENCARD_APP_CONSOLE_STATE__'

type AppConsoleState = {
  entries: ShallowRef<readonly AppConsoleEntry[]>
  originalMethods: Map<AppConsoleSeverity, (...args: unknown[]) => void>
  nextEntryId: number
  installed: boolean
}

const globalTarget = globalThis as typeof globalThis & {
  [GLOBAL_STATE_KEY]?: AppConsoleState
}
const state = globalTarget[GLOBAL_STATE_KEY] ?? {
  entries: shallowRef<readonly AppConsoleEntry[]>([]),
  originalMethods: new Map<AppConsoleSeverity, (...args: unknown[]) => void>(),
  nextEntryId: 1,
  installed: false,
}
globalTarget[GLOBAL_STATE_KEY] = state

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'symbol' || typeof value === 'function') return String(value)
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`
  if (value === undefined) return 'undefined'

  try {
    const seen = new WeakSet<object>()
    const serialized = JSON.stringify(value, (_key, nestedValue: unknown) => {
      if (typeof nestedValue === 'bigint') return `${nestedValue}n`
      if (nestedValue instanceof Error) {
        return { name: nestedValue.name, message: nestedValue.message, stack: nestedValue.stack }
      }
      if (nestedValue && typeof nestedValue === 'object') {
        if (seen.has(nestedValue)) return '[Circular]'
        seen.add(nestedValue)
      }
      return nestedValue
    }, 2)
    return serialized ?? String(value)
  } catch {
    return String(value)
  }
}

function appendEntry(severity: AppConsoleSeverity, args: readonly unknown[]): void {
  const errorReport = severity === 'error' && isAppErrorReport(args[0]) ? args[0] : null
  const entry: AppConsoleEntry = {
    id: state.nextEntryId++,
    severity,
    timestamp: Date.now(),
    message: errorReport ? formatErrorReport(errorReport) : args.map(formatValue).join(' '),
    ...(severity === 'error' ? { errorCode: errorReport?.code ?? 'OC-E1001' } : {}),
  }
  const nextEntries = [...state.entries.value, entry]
  state.entries.value = nextEntries.length > MAX_ENTRY_COUNT
    ? nextEntries.slice(nextEntries.length - MAX_ENTRY_COUNT)
    : nextEntries
}

function formatErrorReport(report: AppErrorReport): string {
  const details = report.details === undefined ? '' : formatValue(report.details)
  const diagnostic = report.stack || report.message
  return details ? `${details}\n${diagnostic}` : diagnostic
}

export function installAppConsoleCapture(): void {
  if (state.installed) return
  state.installed = true

  for (const severity of APP_CONSOLE_SEVERITIES) {
    const original = console[severity].bind(console) as (...args: unknown[]) => void
    state.originalMethods.set(severity, original)
    console[severity] = (...args: unknown[]) => {
      appendEntry(severity, args)
      original(...args)
    }
  }
}

export function uninstallAppConsoleCapture(): void {
  if (!state.installed) return
  for (const severity of APP_CONSOLE_SEVERITIES) {
    const original = state.originalMethods.get(severity)
    if (original) console[severity] = original
  }
  state.originalMethods.clear()
  state.installed = false
}

export function clearAppConsoleEntries(): void {
  state.entries.value = []
}

export const appConsoleEntries = readonly(state.entries)
