import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectIconCatalogEntry } from './projectIconCatalog'
import {
  clearProjectIconDimensions,
  forgetProjectIconDimensions,
  resolveProjectIconDimensions,
  resolvedProjectIconDimensionCount,
  setProjectIconDimensionLoader,
} from './projectIconDimensionResolver'

function entry(source: string): ProjectIconCatalogEntry {
  return { iconKey: 'coin', name: 'Coin', source, tint: 'original', seriesKey: 'items', src: `asset://${source}` }
}

/** Lets a pending measure settle without depending on timers. */
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('projectIconDimensionResolver', () => {
  beforeEach(() => {
    clearProjectIconDimensions()
    setProjectIconDimensionLoader(null)
  })

  it('measures an icon once and writes the size onto its entry', async () => {
    const loader = vi.fn(async () => ({ width: 48, height: 24 }))
    setProjectIconDimensionLoader(loader)
    const icon = entry('icons/coin.png')

    resolveProjectIconDimensions(icon)
    expect(icon.imageWidth).toBeUndefined()
    await flush()

    // The entry that asked is the one that gets the answer, so its consumer re-renders in place.
    expect(icon).toMatchObject({ imageWidth: 48, imageHeight: 24 })
    expect(loader).toHaveBeenCalledTimes(1)
    expect(loader).toHaveBeenCalledWith('asset://icons/coin.png', 'icons/coin.png')
    expect(resolvedProjectIconDimensionCount()).toBe(1)
  })

  it('measures a shared icon once even when several surfaces paint it at the same time', async () => {
    const loader = vi.fn(async () => ({ width: 16, height: 16 }))
    setProjectIconDimensionLoader(loader)

    resolveProjectIconDimensions(entry('icons/coin.png'))
    resolveProjectIconDimensions(entry('icons/coin.png'))
    resolveProjectIconDimensions(entry('icons/coin.png'))
    await flush()

    expect(loader).toHaveBeenCalledTimes(1)
    expect(resolvedProjectIconDimensionCount()).toBe(1)
  })

  it('answers a later paint from the cache without reading the file again', async () => {
    const loader = vi.fn(async () => ({ width: 8, height: 32 }))
    setProjectIconDimensionLoader(loader)

    resolveProjectIconDimensions(entry('icons/coin.png'))
    await flush()
    const second = entry('icons/coin.png')
    resolveProjectIconDimensions(second)

    expect(loader).toHaveBeenCalledTimes(1)
    expect(second).toMatchObject({ imageWidth: 8, imageHeight: 32 })
  })

  it('leaves an icon square for good when its file cannot be measured', async () => {
    const loader = vi.fn(async () => { throw new Error('unreadable') })
    setProjectIconDimensionLoader(loader)

    resolveProjectIconDimensions(entry('icons/broken.svg'))
    await flush()
    resolveProjectIconDimensions(entry('icons/broken.svg'))
    await flush()

    // Retrying on every frame would make a broken file cost more than a working one.
    expect(loader).toHaveBeenCalledTimes(1)
    expect(resolvedProjectIconDimensionCount()).toBe(0)
  })

  it('does nothing when no project has installed a reader', () => {
    expect(() => resolveProjectIconDimensions(entry('icons/coin.png'))).not.toThrow()
    expect(resolvedProjectIconDimensionCount()).toBe(0)
  })

  it('re-measures an icon whose file changed, and forgets everything when the project closes', async () => {
    let size = { width: 10, height: 10 }
    const loader = vi.fn(async () => size)
    setProjectIconDimensionLoader(loader)

    resolveProjectIconDimensions(entry('icons/coin.png'))
    await flush()
    expect(resolvedProjectIconDimensionCount()).toBe(1)

    // A changed file must not keep serving the old proportion.
    forgetProjectIconDimensions('icons/coin.png')
    size = { width: 20, height: 5 }
    const reloaded = entry('icons/coin.png')
    resolveProjectIconDimensions(reloaded)
    await flush()
    expect(reloaded).toMatchObject({ imageWidth: 20, imageHeight: 5 })

    clearProjectIconDimensions()
    expect(resolvedProjectIconDimensionCount()).toBe(0)
  })
})
