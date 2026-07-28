import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not check for updates outside Tauri', async () => {
    mocks.tauri = false
    const updater = useAppUpdater()

    await updater.checkForUpdate()

    expect(mocks.check).not.toHaveBeenCalled()
  })

  it('exposes an available update and installs it before relaunching', async () => {
    let updater: ReturnType<typeof useAppUpdater>
    const update = {
      version: '0.2.1',
      downloadAndInstall: vi.fn(async (onEvent: (event: unknown) => void) => {
        onEvent({ event: 'Started', data: { contentLength: 100 } })
        onEvent({ event: 'Progress', data: { chunkLength: 40 } })
        expect(updater.installProgress.value).toBe(0)
        onEvent({ event: 'Finished' })
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }
    mocks.check.mockResolvedValue(update)
    updater = useAppUpdater()

    await updater.checkForUpdate()
    expect(updater.updateVersion.value).toBe('0.2.1')

    await updater.installAvailableUpdate()
    expect(update.downloadAndInstall).toHaveBeenCalledOnce()
    expect(updater.installProgress.value).toBe(1)
    expect(mocks.relaunch).toHaveBeenCalledOnce()
  })

  it('owns and disposes the developer update preview timer', () => {
    vi.useFakeTimers()
    const updater = useAppUpdater()

    updater.startDeveloperPreview()
    vi.advanceTimersByTime(140)
    expect(updater.developerPreviewProgress.value).toBe(0.04)

    updater.dispose()
    vi.advanceTimersByTime(140)
    expect(updater.developerPreviewProgress.value).toBeNull()
  })
})
