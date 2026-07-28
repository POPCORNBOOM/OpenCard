import { readonly, ref } from 'vue'
import { getCurrentWindow, type DragDropEvent } from '@tauri-apps/api/window'
import type { Event as TauriEvent, UnlistenFn } from '@tauri-apps/api/event'
import {
  filterSupportedExternalOpenPaths,
  listenForExternalOpenRequests,
} from '../services/externalOpenService'

type ShellWindowOptions = {
  requestApplicationClose: () => Promise<void> | void
  handleExternalOpenPaths: (paths: readonly string[]) => Promise<void> | void
}

export function useShellWindow(options: ShellWindowOptions) {
  const appWindow = getCurrentWindow()
  const viewportWidth = ref(typeof window === 'undefined' ? 1440 : window.innerWidth)
  const isFullscreen = ref(false)
  const isMaximized = ref(false)
  const isFileDropActive = ref(false)

  let restoreMaximizedAfterFullscreen = false
  let isFullscreenTransitioning = false
  let started = false
  let generation = 0
  let startPromise: Promise<void> | null = null
  let unlistenWindowResize: UnlistenFn | null = null
  let unlistenWindowClose: UnlistenFn | null = null
  let unlistenExternalOpen: UnlistenFn | null = null
  let unlistenFileDrop: UnlistenFn | null = null
  let viewportResizeHandler: (() => void) | null = null

  function isActive(expectedGeneration: number): boolean {
    return started && generation === expectedGeneration
  }

  async function syncWindowState(expectedGeneration?: number): Promise<void> {
    try {
      const [fullscreen, maximized] = await Promise.all([
        appWindow.isFullscreen(),
        appWindow.isMaximized(),
      ])
      if (expectedGeneration !== undefined && !isActive(expectedGeneration)) return
      isFullscreen.value = fullscreen
      isMaximized.value = maximized
    } catch {
      if (expectedGeneration !== undefined && !isActive(expectedGeneration)) return
      isFullscreen.value = false
      isMaximized.value = false
    }
  }

  async function toggleFullscreen(): Promise<void> {
    if (isFullscreenTransitioning) return

    isFullscreenTransitioning = true
    try {
      const fullscreen = await appWindow.isFullscreen()
      if (!fullscreen) {
        restoreMaximizedAfterFullscreen = await appWindow.isMaximized()
        if (restoreMaximizedAfterFullscreen) {
          await appWindow.toggleMaximize()
        }
        await appWindow.setFullscreen(true)
      } else {
        await appWindow.setFullscreen(false)
        if (restoreMaximizedAfterFullscreen && !(await appWindow.isMaximized())) {
          await appWindow.toggleMaximize()
        }
        restoreMaximizedAfterFullscreen = false
      }

      await syncWindowState()
    } catch (error) {
      if (restoreMaximizedAfterFullscreen && !(await appWindow.isMaximized().catch(() => false))) {
        await appWindow.toggleMaximize().catch(() => undefined)
      }
      restoreMaximizedAfterFullscreen = false
      await syncWindowState()
      throw error
    } finally {
      isFullscreenTransitioning = false
    }
  }

  async function minimize(): Promise<void> {
    await appWindow.minimize()
  }

  async function toggleMaximize(): Promise<void> {
    if (await appWindow.isFullscreen()) return
    await appWindow.toggleMaximize()
    isMaximized.value = await appWindow.isMaximized()
  }

  async function requestClose(): Promise<void> {
    await options.requestApplicationClose()
  }

  async function destroy(): Promise<void> {
    await appWindow.destroy()
  }

  function handleViewportResize(expectedGeneration: number): void {
    if (!isActive(expectedGeneration) || typeof window === 'undefined') return
    viewportWidth.value = window.innerWidth
  }

  function handleFileDropEvent(event: TauriEvent<DragDropEvent>, expectedGeneration: number): void {
    if (!isActive(expectedGeneration)) return

    const payload = event.payload
    if (payload.type === 'enter') {
      isFileDropActive.value = filterSupportedExternalOpenPaths(payload.paths).length > 0
      return
    }
    if (payload.type === 'drop') {
      isFileDropActive.value = false
      const paths = filterSupportedExternalOpenPaths(payload.paths)
      if (paths.length > 0) void options.handleExternalOpenPaths(paths)
      return
    }
    if (payload.type === 'leave') {
      isFileDropActive.value = false
    }
  }

  async function retainUnlisten(
    registration: Promise<UnlistenFn>,
    expectedGeneration: number,
    retain: (unlisten: UnlistenFn) => void,
  ): Promise<void> {
    try {
      const unlisten = await registration
      if (!isActive(expectedGeneration)) {
        unlisten()
        return
      }
      retain(unlisten)
    } catch {
      // Platform listeners are optional outside the Tauri runtime.
    }
  }

  function start(): Promise<void> {
    if (started) return startPromise ?? Promise.resolve()

    started = true
    const expectedGeneration = ++generation
    if (typeof window !== 'undefined') {
      viewportResizeHandler = () => handleViewportResize(expectedGeneration)
      window.addEventListener('resize', viewportResizeHandler)
    }

    const pendingStart = Promise.all([
      syncWindowState(expectedGeneration),
      retainUnlisten(
        appWindow.onResized(() => {
          if (isActive(expectedGeneration)) void syncWindowState(expectedGeneration)
        }),
        expectedGeneration,
        unlisten => { unlistenWindowResize = unlisten },
      ),
      retainUnlisten(
        appWindow.onCloseRequested((event) => {
          if (!isActive(expectedGeneration)) return
          event.preventDefault()
          void requestClose().catch(error => console.warn('关闭窗口失败:', error))
        }),
        expectedGeneration,
        unlisten => { unlistenWindowClose = unlisten },
      ),
      retainUnlisten(
        listenForExternalOpenRequests((paths) => {
          if (isActive(expectedGeneration)) return options.handleExternalOpenPaths(paths)
        }),
        expectedGeneration,
        unlisten => { unlistenExternalOpen = unlisten },
      ),
      retainUnlisten(
        appWindow.onDragDropEvent(event => handleFileDropEvent(event, expectedGeneration)),
        expectedGeneration,
        unlisten => { unlistenFileDrop = unlisten },
      ),
    ]).then(() => undefined)

    startPromise = pendingStart.finally(() => {
      if (generation === expectedGeneration) startPromise = null
    })
    return startPromise
  }

  function dispose(): void {
    started = false
    generation += 1
    startPromise = null
    if (typeof window !== 'undefined' && viewportResizeHandler) {
      window.removeEventListener('resize', viewportResizeHandler)
    }
    viewportResizeHandler = null
    unlistenWindowResize?.()
    unlistenWindowResize = null
    unlistenWindowClose?.()
    unlistenWindowClose = null
    unlistenExternalOpen?.()
    unlistenExternalOpen = null
    unlistenFileDrop?.()
    unlistenFileDrop = null
    isFileDropActive.value = false
  }

  return {
    viewportWidth: readonly(viewportWidth),
    isFullscreen: readonly(isFullscreen),
    isMaximized: readonly(isMaximized),
    isFileDropActive: readonly(isFileDropActive),
    syncWindowState,
    toggleFullscreen,
    minimize,
    toggleMaximize,
    requestClose,
    destroy,
    start,
    dispose,
  }
}
