import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  unlistenDrop: vi.fn(),
  dragDropHandler: null as ((event: { payload: unknown }) => void) | null,
  devicePixelRatio: 1,
}))

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onDragDropEvent: async (handler: (event: { payload: unknown }) => void) => {
      mocks.dragDropHandler = handler
      return mocks.unlistenDrop
    },
  }),
}))

vi.mock('../../../features/shell/services/externalOpenService', () => ({
  filterSupportedExternalOpenPaths: (paths: readonly string[]) => (
    paths.filter(path => path.toLowerCase().endsWith('.ocdocument'))
  ),
}))

import { registerUnhandledExternalDrop, useExternalFileDrop } from './externalFileDrop'

const SUPPORTED = 'D:/cards/main.ocdocument'
const UNSUPPORTED = 'D:/cards/readme.txt'

let hitTest: ReturnType<typeof vi.fn>

/** jsdom has no layout engine, so pointer hit testing is stubbed. */
function stubHitTest(target: () => Element | null): void {
  hitTest = vi.fn(target)
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    writable: true,
    value: hitTest,
  })
}

type ZoneHarness = {
  dispose: () => void
  hover: ReturnType<typeof vi.fn>
  exit: ReturnType<typeof vi.fn>
  drop: ReturnType<typeof vi.fn>
}

async function registerZone(options: { handles: boolean } = { handles: true }): Promise<ZoneHarness> {
  const hover = vi.fn()
  const exit = vi.fn()
  const drop = vi.fn(() => options.handles)
  const dispose = useExternalFileDrop().registerZone({
    contains: element => element.closest('[data-test-zone]') !== null,
    onHover: hover,
    onExit: exit,
    onDrop: drop,
  })
  await Promise.resolve()
  return { dispose, hover, exit, drop }
}

function emit(payload: unknown): void {
  mocks.dragDropHandler?.({ payload })
}

/** jsdom has no DataTransfer, so the parts the guard reads are attached directly. */
function createDragEvent(type: string, itemKind: string): Event {
  const event = new Event(type, { cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: { items: [{ kind: itemKind }] } })
  return event
}

describe('useExternalFileDrop', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div data-test-zone></div>'
    mocks.dragDropHandler = null
    mocks.devicePixelRatio = 1
    mocks.unlistenDrop.mockClear()
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      get: () => mocks.devicePixelRatio,
    })
    stubHitTest(() => document.body.querySelector('[data-test-zone]'))
  })

  it('reports an active drag and forwards hover to the hit zone', async () => {
    const zone = await registerZone()
    const drop = useExternalFileDrop()

    emit({ type: 'enter', paths: [SUPPORTED, UNSUPPORTED], position: { x: 10, y: 10 } })
    expect(drop.isDragActive.value).toBe(true)
    expect(drop.isOverZone.value).toBe(true)
    expect(zone.hover).toHaveBeenCalledWith({ x: 10, y: 10 })

    emit({ type: 'over', paths: [], position: { x: 12, y: 11 } })
    expect(zone.hover).toHaveBeenLastCalledWith({ x: 12, y: 11 })

    emit({ type: 'leave' })
    expect(drop.isDragActive.value).toBe(false)
    expect(drop.isOverZone.value).toBe(false)
    expect(zone.exit).toHaveBeenCalled()
    zone.dispose()
  })

  it('converts physical drop coordinates to css pixels before hit testing', async () => {
    mocks.devicePixelRatio = 2
    const zone = await registerZone()

    emit({ type: 'enter', paths: [SUPPORTED], position: { x: 200, y: 100 } })

    expect(hitTest).toHaveBeenCalledWith(100, 50)
    expect(zone.hover).toHaveBeenCalledWith({ x: 100, y: 50 })
    zone.dispose()
  })

  it('skips repeated hover reports for an unchanged pointer position', async () => {
    const zone = await registerZone()

    emit({ type: 'enter', paths: [SUPPORTED], position: { x: 10, y: 10 } })
    emit({ type: 'over', paths: [], position: { x: 10, y: 10 } })

    expect(zone.hover).toHaveBeenCalledOnce()
    zone.dispose()
  })

  it('lets a zone consume its drop and hands unhandled drops to the fallback', async () => {
    const zone = await registerZone()
    const unhandled = vi.fn()
    const disposeUnhandled = registerUnhandledExternalDrop(unhandled)

    emit({ type: 'enter', paths: [SUPPORTED], position: { x: 10, y: 10 } })
    emit({ type: 'drop', paths: [SUPPORTED], position: { x: 10, y: 10 } })
    expect(zone.drop).toHaveBeenCalledWith([SUPPORTED], { x: 10, y: 10 })
    expect(unhandled).not.toHaveBeenCalled()

    zone.drop.mockReturnValue(false)
    emit({ type: 'enter', paths: [SUPPORTED], position: { x: 10, y: 10 } })
    emit({ type: 'drop', paths: [SUPPORTED], position: { x: 10, y: 10 } })
    expect(unhandled).toHaveBeenCalledWith([SUPPORTED])

    zone.dispose()
    disposeUnhandled()
  })

  it('accepts any file type for zones while the open hint only follows openable files', async () => {
    const zone = await registerZone()
    const drop = useExternalFileDrop()

    emit({ type: 'enter', paths: [UNSUPPORTED], position: { x: 10, y: 10 } })
    expect(drop.isDragActive.value).toBe(true)
    expect(drop.isOpenableDragActive.value).toBe(false)

    emit({ type: 'drop', paths: [UNSUPPORTED], position: { x: 10, y: 10 } })
    expect(zone.drop).toHaveBeenCalledWith([UNSUPPORTED], { x: 10, y: 10 })

    emit({ type: 'enter', paths: [SUPPORTED], position: { x: 10, y: 10 } })
    expect(drop.isOpenableDragActive.value).toBe(true)

    emit({ type: 'leave' })
    expect(drop.isDragActive.value).toBe(false)
    expect(drop.isOpenableDragActive.value).toBe(false)
    zone.dispose()
  })

  it('routes drops that miss every zone to the fallback and stays inactive without files', async () => {
    const zone = await registerZone()
    const unhandled = vi.fn()
    const disposeUnhandled = registerUnhandledExternalDrop(unhandled)

    stubHitTest(() => null)
    emit({ type: 'enter', paths: [SUPPORTED], position: { x: 10, y: 10 } })
    emit({ type: 'drop', paths: [SUPPORTED], position: { x: 10, y: 10 } })
    expect(zone.drop).not.toHaveBeenCalled()
    expect(unhandled).toHaveBeenCalledWith([SUPPORTED])

    emit({ type: 'enter', paths: [], position: { x: 10, y: 10 } })
    expect(useExternalFileDrop().isDragActive.value).toBe(false)
    emit({ type: 'drop', paths: [], position: { x: 10, y: 10 } })
    expect(unhandled).toHaveBeenCalledOnce()

    zone.dispose()
    disposeUnhandled()
  })

  it('clears zone feedback when the zone disposes', async () => {
    const zone = await registerZone()

    emit({ type: 'enter', paths: [SUPPORTED], position: { x: 10, y: 10 } })
    zone.dispose()

    expect(zone.exit).toHaveBeenCalled()
  })

  it('cancels browser-handled file drops so the webview never opens them itself', async () => {
    const zone = await registerZone()

    const fileDragOver = createDragEvent('dragover', 'file')
    window.dispatchEvent(fileDragOver)
    expect(fileDragOver.defaultPrevented).toBe(true)

    const fileDrop = createDragEvent('drop', 'file')
    window.dispatchEvent(fileDrop)
    expect(fileDrop.defaultPrevented).toBe(true)

    const textDrag = createDragEvent('dragover', 'string')
    window.dispatchEvent(textDrag)
    expect(textDrag.defaultPrevented).toBe(false)

    zone.dispose()
    await Promise.resolve()

    const afterDispose = createDragEvent('drop', 'file')
    window.dispatchEvent(afterDispose)
    expect(afterDispose.defaultPrevented).toBe(false)
  })

  it('attaches one window listener for all zones and detaches it with the last one', async () => {
    const first = await registerZone()
    const second = await registerZone()
    expect(mocks.dragDropHandler).not.toBeNull()

    first.dispose()
    second.dispose()
    await Promise.resolve()

    expect(mocks.unlistenDrop).toHaveBeenCalledOnce()
  })
})
