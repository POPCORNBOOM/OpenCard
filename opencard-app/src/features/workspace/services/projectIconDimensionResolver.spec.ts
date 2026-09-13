import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectIconCatalogEntry } from './projectIconCatalog'
import {
  clearProjectIconDimensions,
  forgetProjectIconDimensions,
  readProjectIconSize,
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

  it('answers unknown while it measures, then the real size from the cache', async () => {
    const loader = vi.fn(async () => ({ width: 48, height: 24 }))
    setProjectIconDimensionLoader(loader)
    const icon = entry('icons/coin.png')

    expect(readProjectIconSize(icon)).toBeUndefined()
    await flush()

    expect(readProjectIconSize(icon)).toEqual({ width: 48, height: 24 })
    expect(loader).toHaveBeenCalledTimes(1)
    expect(loader).toHaveBeenCalledWith('asset://icons/coin.png', 'icons/coin.png')
  })

  it('measures a shared icon once even when several surfaces paint it at the same time', async () => {
    const loader = vi.fn(async () => ({ width: 16, height: 16 }))
    setProjectIconDimensionLoader(loader)

    readProjectIconSize(entry('icons/coin.png'))
    readProjectIconSize(entry('icons/coin.png'))
    readProjectIconSize(entry('icons/coin.png'))
    await flush()

    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('does not read the file again once the size is known', async () => {
    const loader = vi.fn(async () => ({ width: 8, height: 32 }))
    setProjectIconDimensionLoader(loader)

    readProjectIconSize(entry('icons/coin.png'))
    await flush()
    expect(readProjectIconSize(entry('icons/coin.png'))).toEqual({ width: 8, height: 32 })

    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('leaves an icon square for good when its file cannot be measured', async () => {
    const loader = vi.fn(async () => { throw new Error('unreadable') })
    setProjectIconDimensionLoader(loader)

    readProjectIconSize(entry('icons/broken.svg'))
    await flush()
    expect(readProjectIconSize(entry('icons/broken.svg'))).toBeUndefined()
    await flush()

    // Retrying on every frame would make a broken file cost more than a working one.
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('reports unknown when no project has installed a reader', () => {
    expect(readProjectIconSize(entry('icons/coin.png'))).toBeUndefined()
  })

  it('re-measures an icon whose file changed, and forgets everything when the project closes', async () => {
    let size = { width: 10, height: 10 }
    const loader = vi.fn(async () => size)
    setProjectIconDimensionLoader(loader)
    const icon = entry('icons/coin.png')

    readProjectIconSize(icon)
    await flush()
    expect(readProjectIconSize(icon)).toEqual({ width: 10, height: 10 })

    // A changed file must not keep serving the old proportion.
    forgetProjectIconDimensions('icons/coin.png')
    size = { width: 20, height: 5 }
    readProjectIconSize(icon)
    await flush()
    expect(readProjectIconSize(icon)).toEqual({ width: 20, height: 5 })

    clearProjectIconDimensions()
    expect(readProjectIconSize(icon)).toBeUndefined()
  })
})
