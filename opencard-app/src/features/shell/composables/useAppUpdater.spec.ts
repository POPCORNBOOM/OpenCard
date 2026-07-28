import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppUpdater } from './useAppUpdater'
import { MemoryUpdateStatePersistence } from './updateStatePersistence'

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
  function createUpdater(persistence = new MemoryUpdateStatePersistence()) {
    return useAppUpdater({
      persistence,
      currentRelease: {
        version: '0.2.0',
        body: '# OpenCard 0.2.0',
        publishedAt: '2026-07-01T00:00:00.000Z',
      },
      now: () => '2026-07-29T00:00:00.000Z',
    })
  }

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
    const updater = createUpdater()

    await updater.checkForUpdate()

    expect(mocks.check).not.toHaveBeenCalled()
  })

  it('exposes an available update and installs it before relaunching', async () => {
    let updater: ReturnType<typeof useAppUpdater>
    const update = {
      version: '0.2.1',
      body: '# OpenCard 0.2.1',
      date: '2026-07-29T00:00:00.000Z',
      downloadAndInstall: vi.fn(async (onEvent: (event: unknown) => void) => {
        onEvent({ event: 'Started', data: { contentLength: 100 } })
        onEvent({ event: 'Progress', data: { chunkLength: 40 } })
        expect(updater.installProgress.value).toBe(0)
        onEvent({ event: 'Finished' })
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }
    mocks.check.mockResolvedValue(update)
    const persistence = new MemoryUpdateStatePersistence()
    updater = createUpdater(persistence)

    await updater.initialize()
    await updater.checkForUpdate()
    expect(updater.updateVersion.value).toBe('0.2.1')
    expect((await persistence.load())).toMatchObject({
      current: { version: '0.2.0' },
      pending: { version: '0.2.1', body: '# OpenCard 0.2.1' },
    })

    await updater.installAvailableUpdate()
    expect(update.downloadAndInstall).toHaveBeenCalledOnce()
    expect(updater.installProgress.value).toBe(1)
    expect(mocks.relaunch).toHaveBeenCalledOnce()
  })

  it('owns and disposes the developer update preview timer', () => {
    vi.useFakeTimers()
    const updater = createUpdater()

    updater.startDeveloperPreview()
    vi.advanceTimersByTime(140)
    expect(updater.developerPreviewProgress.value).toBe(0.04)

    updater.dispose()
    vi.advanceTimersByTime(140)
    expect(updater.developerPreviewProgress.value).toBeNull()
  })

  it('persists whether the bundled current release notes have been seen', async () => {
    const persistence = new MemoryUpdateStatePersistence()
    const updater = createUpdater(persistence)

    await updater.initialize()

    expect(updater.currentReleaseNotes.value).toMatchObject({
      version: '0.2.0',
      body: '# OpenCard 0.2.0',
      seenAt: null,
    })
    expect(updater.hasUnseenCurrentReleaseNotes.value).toBe(true)

    await updater.markCurrentReleaseNotesSeen()

    expect(updater.hasUnseenCurrentReleaseNotes.value).toBe(false)
    expect(await persistence.load()).toMatchObject({
      current: { version: '0.2.0', seenAt: '2026-07-29T00:00:00.000Z' },
    })

    const restartedUpdater = createUpdater(persistence)
    await restartedUpdater.initialize()
    expect(restartedUpdater.hasUnseenCurrentReleaseNotes.value).toBe(false)
  })

  it('promotes cached pending notes after the installed version changes', async () => {
    const persistence = new MemoryUpdateStatePersistence({
      current: {
        version: '0.2.0',
        body: '# OpenCard 0.2.0',
        publishedAt: null,
        seenAt: '2026-07-20T00:00:00.000Z',
      },
      pending: {
        version: '0.2.1',
        body: '# Downloaded release notes',
        publishedAt: '2026-07-29T00:00:00.000Z',
      },
    })
    const updater = useAppUpdater({
      persistence,
      currentRelease: {
        version: '0.2.1',
        body: '# Bundled release notes',
        publishedAt: null,
      },
    })

    await updater.initialize()

    expect(updater.currentReleaseNotes.value).toMatchObject({
      version: '0.2.1',
      body: '# Downloaded release notes',
      seenAt: null,
    })
    expect(await persistence.load()).toMatchObject({ pending: null })
  })
})
