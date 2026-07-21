import { computed, ref, shallowRef } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'

export function useAppUpdater() {
  const availableUpdate = shallowRef<Update | null>(null)
  const isChecking = ref(false)
  const isInstalling = ref(false)

  const updateVersion = computed(() => availableUpdate.value?.version ?? '')

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
    try {
      await update.downloadAndInstall()
      await relaunch()
    } catch (error) {
      console.error('安装更新失败:', error)
      isInstalling.value = false
    }
  }

  function dispose(): void {
    if (!isInstalling.value) {
      void availableUpdate.value?.close()
    }
  }

  return {
    availableUpdate,
    updateVersion,
    isChecking,
    isInstalling,
    checkForUpdate,
    installAvailableUpdate,
    dispose,
  }
}
