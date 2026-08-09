import { describe, expect, it } from 'vitest'
import { registerProjectCustomBlockPath, unregisterProjectCustomBlockPath } from './projectCustomBlockRegistry'

describe('project custom block registry operations', () => {
  it('registers paths case-insensitively without duplicates', () => {
    const once = registerProjectCustomBlockPath({}, 'assets/blocks/square.ocblock')
    const twice = registerProjectCustomBlockPath(once, 'ASSETS/BLOCKS/SQUARE.OCBLOCK')
    expect(twice.blocks).toEqual(['ASSETS/BLOCKS/SQUARE.OCBLOCK'])
  })

  it('unregisters a path and preserves the empty registry shape', () => {
    expect(unregisterProjectCustomBlockPath({ blocks: ['a.ocblock'] }, 'A.OCBLOCK')).toEqual({ blocks: [] })
  })
})
