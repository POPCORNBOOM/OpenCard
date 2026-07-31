import { onMounted, onUnmounted, readonly, shallowRef } from 'vue'
import { sanitizeDiagnosticText, type FeedbackDiagnosticInput } from '../model/feedback'

export function useFeedbackDiagnostics() {
  const latestDiagnostics = shallowRef<FeedbackDiagnosticInput>()

  function captureUnknown(value: unknown, fallbackMessage: string): void {
    if (value instanceof Error) {
      latestDiagnostics.value = {
        errorName: value.name || 'Error',
        errorMessage: sanitizeDiagnosticText(value.message || fallbackMessage),
        stack: value.stack ? sanitizeDiagnosticText(value.stack) : undefined,
      }
      return
    }

    latestDiagnostics.value = {
      errorMessage: sanitizeDiagnosticText(typeof value === 'string' ? value : fallbackMessage),
    }
  }

  function handleWindowError(event: ErrorEvent): void {
    if (event.error !== undefined && event.error !== null) {
      captureUnknown(event.error, event.message || 'Unhandled application error')
      return
    }
    const location = event.filename
      ? `${event.filename}:${event.lineno}:${event.colno}`
      : undefined
    latestDiagnostics.value = {
      errorName: 'Error',
      errorMessage: sanitizeDiagnosticText(event.message || 'Unhandled application error'),
      stack: location ? sanitizeDiagnosticText(location) : undefined,
    }
  }

  function handleUnhandledRejection(event: PromiseRejectionEvent): void {
    captureUnknown(event.reason, 'Unhandled promise rejection')
  }

  onMounted(() => {
    window.addEventListener('error', handleWindowError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
  })

  onUnmounted(() => {
    window.removeEventListener('error', handleWindowError)
    window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  })

  return { latestDiagnostics: readonly(latestDiagnostics) }
}
