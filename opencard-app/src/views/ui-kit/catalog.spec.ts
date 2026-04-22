import { describe, expect, it } from 'vitest'
import { SHOWCASE_MATRIX_COLUMNS, UI_KIT_SECTIONS } from './catalog'

describe('UI Kit catalog', () => {
  it('contains exactly foundation/primitives/base sections', () => {
    const sectionIds = UI_KIT_SECTIONS.map((section) => section.id).sort()
    expect(sectionIds).toEqual(['base', 'foundation', 'primitives'])
  })

  it('keeps unique example ids and complete matrix/state coverage', () => {
    const ids = new Set<string>()

    for (const section of UI_KIT_SECTIONS) {
      expect(section.examples.length).toBeGreaterThan(0)

      for (const example of section.examples) {
        expect(ids.has(example.id)).toBe(false)
        ids.add(example.id)

        expect(example.demoBlocks).toEqual(SHOWCASE_MATRIX_COLUMNS)
        expect(example.stateCoverage.length).toBeGreaterThan(0)
      }
    }
  })
})
