import { computed, ref, shallowRef } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'

const PROGRESS_UPDATE_INTERVAL = 120

export function useAppUpdater() {
  const availableUpdate = shallowRef<Update | null>(null)
  const isChecking = ref(false)
  const isInstalling = ref(false)
  const installProgress = ref<number | null>(null)
  let progressTimer: ReturnType<typeof setTimeout> | null = null
  let pendingProgress: number | null = null
  let lastProgressUpdate = 0

  const updateVersion = computed(() => availableUpdate.value?.version ?? '')

  function clearProgressTimer(): void {
    if (progressTimer !== null) clearTimeout(progressTimer)
    progressTimer = null
    pendingProgress = null
  }

  function updateProgress(value: number, immediate = false): void {
    pendingProgress = value
    const elapsed = Date.now() - lastProgressUpdate
    if (immediate || elapsed >= PROGRESS_UPDATE_INTERVAL) {
      clearProgressTimer()
      installProgress.value = value
      lastProgressUpdate = Date.now()
      return
    }
    if (progressTimer !== null) return
    progressTimer = setTimeout(() => {
      progressTimer = null
      if (pendingProgress !== null) installProgress.value = pendingProgress
      pendingProgress = null
      lastProgressUpdate = Date.now()
    }, PROGRESS_UPDATE_INTERVAL - elapsed)
  }

  async function checkForUpdate(): Promise<void> {
    if (!isTauri() || isChecking.value || isInstalling.value) return

    isChecking.value = true
    try {
      availableUpdate.value = await check()
    } catch (error) {
      console.warn('检查更新失败:', error)
    } finally {
      isChecking.value = false
    }
  }

  async function installAvailableUpdate(): Promise<void> {
    const update = availableUpdate.value
    if (!update || isInstalling.value) return

    isInstalling.value = true
    updateProgress(0, true)
    let contentLength = 0
    let downloadedBytes = 0
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength ?? 0
          downloadedBytes = 0
          updateProgress(0, true)
          return
        }
        if (event.event === 'Progress') {
          downloadedBytes += event.data.chunkLength
          if (contentLength > 0) {
            updateProgress(Math.min(downloadedBytes / contentLength, 0.99))
          }
          return
        }
        updateProgress(1, true)
      })
      await relaunch()
    } catch (error) {
      console.error('安装更新失败:', error)
      isInstalling.value = false
      clearProgressTimer()
      installProgress.value = null
    }
  }

  function dispose(): void {
    clearProgressTimer()
    if (!isInstalling.value) {
      void availableUpdate.value?.close()
    }
  }

  return {
    availableUpdate,
    updateVersion,
    isChecking,
    isInstalling,
    installProgress,
    checkForUpdate,
    installAvailableUpdate,
    dispose,
  }
}
