import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppUpdater } from './useAppUpdater'

const mocks = vi.hoisted(() => ({
  tauri: true,
  check: vi.fn(),
  relaunch: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => mocks.tauri,
}))

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: mocks.check,
}))

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: mocks.relaunch,
}))

describe('useAppUpdater', () => {
  beforeEach(() => {
    mocks.tauri = true
    mocks.check.mockReset()
    mocks.relaunch.mockReset()
  })

  it('does not check for updates outside Tauri', async () => {
    mocks.tauri = false
    const updater = useAppUpdater()

    await updater.checkForUpdate()

    expect(mocks.check).not.toHaveBeenCalled()
  })

  it('exposes an available update and installs it before relaunching', async () => {
    const update = {
      version: '0.2.1',
      downloadAndInstall: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }
    mocks.check.mockResolvedValue(update)
    const updater = useAppUpdater()

    await updater.checkForUpdate()
    expect(updater.updateVersion.value).toBe('0.2.1')

    await updater.installAvailableUpdate()
    expect(update.downloadAndInstall).toHaveBeenCalledOnce()
    expect(mocks.relaunch).toHaveBeenCalledOnce()
  })
})
