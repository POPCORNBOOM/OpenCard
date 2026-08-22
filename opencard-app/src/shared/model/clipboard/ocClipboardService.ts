import {
  OC_CLIPBOARD_MIME,
  type OcClipboardEnvelope,
  serializeOcClipboard,
} from './cardBlockClipboard'

let fallbackClipboard: OcClipboardEnvelope | null = null

export async function writeOcClipboard(envelope: OcClipboardEnvelope): Promise<void> {
  fallbackClipboard = structuredClone(envelope)
  const text = serializeOcClipboard(envelope)
  if (!navigator.clipboard) return
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      await navigator.clipboard.write([new ClipboardItem({
        [OC_CLIPBOARD_MIME]: new Blob([text], { type: OC_CLIPBOARD_MIME }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })])
      return
    }
    await navigator.clipboard.writeText(text)
  } catch {
    // The process-local fallback still supports copying between OpenCard sessions.
  }
}

export async function readOcClipboard(): Promise<OcClipboardEnvelope | null> {
  // Do not call navigator.clipboard.read()/readText() here. Both APIs may trigger
  // a browser permission prompt during an ordinary Ctrl/Cmd+V. OpenCard's own
  // clipboard is sufficient for cross-session and cross-face paste. External
  // clipboard integration should use a trusted paste event instead. 
  return fallbackClipboard ? structuredClone(fallbackClipboard) : null
}
