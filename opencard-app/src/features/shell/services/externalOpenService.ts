import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

const EXTERNAL_OPEN_EVENT = 'external-open-requested'
const TAKE_EXTERNAL_OPEN_REQUESTS_COMMAND = 'take_external_open_requests'

export type ExternalOpenPathKind = 'card' | 'project-resource' | 'template'

export function classifyExternalOpenPath(path: string): ExternalOpenPathKind | null {
  const normalizedPath = path.replace(/\\/g, '/')
  const fileName = normalizedPath.split('/').pop() ?? normalizedPath
  const windowsPath = /^[A-Za-z]:\//.test(normalizedPath) || normalizedPath.startsWith('//')
  const comparableFileName = windowsPath ? fileName.toLocaleLowerCase() : fileName
  if (comparableFileName === '.opencardprojectprofile' || comparableFileName === '.dictionary') return 'project-resource'
  if (comparableFileName.toLocaleLowerCase().endsWith('.opencardtemplate')) return 'template'
  if (comparableFileName.toLocaleLowerCase().endsWith('.opencard')) return 'card'
  return null
}

export function filterSupportedExternalOpenPaths(paths: readonly string[]): string[] {
  return paths.filter((path) => classifyExternalOpenPath(path) !== null)
}

export async function listenForExternalOpenRequests(
  handlePaths: (paths: readonly string[]) => Promise<void> | void,
): Promise<UnlistenFn> {
  let drainRequested = false
  let draining: Promise<void> | null = null

  const requestDrain = async (): Promise<void> => {
    drainRequested = true
    if (draining) return await draining

    draining = (async () => {
      while (drainRequested) {
        drainRequested = false
        const paths = await invoke<string[]>(TAKE_EXTERNAL_OPEN_REQUESTS_COMMAND)
        if (paths.length > 0) await handlePaths(paths)
      }
    })()

    try {
      await draining
    } finally {
      draining = null
    }
  }

  const unlisten = await listen(EXTERNAL_OPEN_EVENT, () => {
    void requestDrain()
  })
  await requestDrain()
  return unlisten
}
