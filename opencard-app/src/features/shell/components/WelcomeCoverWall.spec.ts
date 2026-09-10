import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WelcomeCoverWall, { type WelcomeCoverWallCover } from './WelcomeCoverWall.vue'
import { WELCOME_COVER_ARTWORK } from '../welcomeCoverArtwork'

function cover(index: number): WelcomeCoverWallCover {
  return {
    projectKey: `recent-project:/Project ${index}`,
    src: `asset:///Project ${index}/cover.png`,
  }
}

function mountWall(covers: readonly WelcomeCoverWallCover[] = [], highlightKeys: readonly string[] = []) {
  return mount(WelcomeCoverWall, { props: { covers, highlightKeys } })
}

function rowSources(wrapper: ReturnType<typeof mountWall>, rowIndex = 0): readonly string[] {
  const row = wrapper.findAll('.welcome-cover-wall__row')[rowIndex]!
  return [...row.element.children].map(tile => (
    (tile as HTMLElement).querySelector('img')?.getAttribute('src') ?? 'empty'
  ))
}

class ResizeObserverMock {
  observe(): void {}
  disconnect(): void {}
  unobserve(): void {}
}

describe('WelcomeCoverWall', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  it('stays a pure background layer that never handles pointer or keyboard input', () => {
    const wrapper = mountWall([cover(0)])

    expect(wrapper.get('.welcome-cover-wall').attributes('aria-hidden')).toBe('true')
    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.find('[data-tooltip]').exists()).toBe(false)
    expect(wrapper.find('[tabindex]').exists()).toBe(false)
  })

  it('fills the wall with built-in board game covers even without user projects', () => {
    const wrapper = mountWall()

    expect(WELCOME_COVER_ARTWORK.length).toBeGreaterThanOrEqual(8)
    const tiles = wrapper.findAll('.welcome-cover-wall__tile img')
    expect(tiles.length).toBeGreaterThan(0)
    expect(tiles.every(tile => Boolean(tile.attributes('src')))).toBe(true)
  })

  it('leaves no empty tile anywhere in the wall', () => {
    const wrapper = mountWall([cover(0)])

    const tiles = wrapper.findAll('.welcome-cover-wall__tile')
    expect(tiles.length).toBeGreaterThan(0)
    expect(tiles.every(tile => Boolean(tile.find('img').attributes('src')))).toBe(true)
    for (const [index] of wrapper.findAll('.welcome-cover-wall__row').entries()) {
      expect(rowSources(wrapper, index)).not.toContain('empty')
    }
  })

  it('lays the wall out as a grid without brick offsets', () => {
    const wrapper = mountWall([cover(0), cover(1)])

    const rows = wrapper.findAll('.welcome-cover-wall__row')
    expect(rows.length).toBeGreaterThan(1)
    expect(rows.every(row => !row.attributes('style'))).toBe(true)
    expect(rowSources(wrapper).length).toBe(rowSources(wrapper, 1)!.length)
  })

  it('drifts the whole plane by exactly one pattern period towards the top right', () => {
    const wrapper = mountWall([cover(0)])
    const style = wrapper.get('.welcome-cover-wall__plane').attributes('style') ?? ''

    expect(style).toContain('--welcome-cover-wall-copy-width')
    expect(style).toContain('--welcome-cover-wall-period-height')
  })

  it('keeps all eight neighbours of every tile different, including across copy and row seams', async () => {
    const wrapper = mountWall([cover(0), cover(1), cover(2)])
    await wrapper.vm.$nextTick()

    const rows = wrapper.findAll('.welcome-cover-wall__row')
    const grid = rows.map((_, index) => rowSources(wrapper, index))
    expect(grid.length).toBeGreaterThan(1)

    for (const [rowIndex, row] of grid.entries()) {
      for (const [columnIndex, source] of row.entries()) {
        for (const rowOffset of [-1, 0, 1]) {
          for (const columnOffset of [-1, 0, 1]) {
            if (rowOffset === 0 && columnOffset === 0) continue
            const neighbour = grid[rowIndex + rowOffset]?.[columnIndex + columnOffset]
            if (neighbour === undefined) continue
            expect(neighbour).not.toBe(source)
          }
        }
      }
    }
  })

  it('never places the same source in two neighbouring tiles', async () => {
    const wrapper = mountWall([cover(0), cover(1), cover(2)])
    await wrapper.vm.$nextTick()

    for (const [index] of wrapper.findAll('.welcome-cover-wall__row').entries()) {
      const sources = rowSources(wrapper, index)
      for (let position = 1; position < sources.length; position += 1) {
        expect(sources[position]).not.toBe(sources[position - 1])
      }
      expect(sources[0]).not.toBe(sources[sources.length - 1])
    }
  })

  it('enlarges only the cover of the project selected in the sidebar', () => {
    const selected = cover(1)
    const wrapper = mountWall([cover(0), selected], [selected.projectKey])

    const emphasized = wrapper.findAll('.welcome-cover-wall__tile.is-emphasized')
    expect(emphasized.length).toBeGreaterThan(0)
    expect(emphasized.every(tile => tile.find('img').attributes('src') === selected.src)).toBe(true)

    const other = mountWall([cover(0), selected], [])
    expect(other.find('.welcome-cover-wall__tile.is-emphasized').exists()).toBe(false)
  })

  it('keeps the layout stable across re-renders for the same covers', async () => {
    const wrapper = mountWall([cover(0), cover(1), cover(2), cover(3)])
    const before = rowSources(wrapper)

    await wrapper.setProps({ highlightKeys: [cover(0).projectKey] })

    expect(rowSources(wrapper)).toEqual(before)
  })

  it('stops drifting while the wall leaves the viewport', async () => {
    let intersectionCallback: IntersectionObserverCallback = () => undefined
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback
      }
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    })
    const wrapper = mountWall([cover(0)])
    expect(wrapper.get('.welcome-cover-wall').classes()).toContain('is-running')

    intersectionCallback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.welcome-cover-wall').classes()).not.toContain('is-running')
  })
})
