import { describe, expect, it } from 'vitest'
import { strToU8 } from 'fflate'
import { createBlock } from '../../../entities/card/model'
import {
  exportProjectCustomBlockPackage,
  readProjectCustomBlockPackage,
} from './projectCustomBlock'

const manifest = {
  type: 'opencard-custom-block' as const,
  packageId: 'block:badge',
  version: '0.0.0',
  name: 'Badge',
  publicFieldKeys: ['name', 'notes'],
}

const declarations = [
  'image:assets/dynamic/one.png',
  'icon:status/star',
]

describe('custom block resource declarations', () => {
  it('serializes author-selected resource declarations into standalone .ocblock files', async () => {
    let bytes = new Uint8Array()
    await exportProjectCustomBlockPackage({
      fs: { writeBinaryFile: async (_path, nextBytes) => { bytes = nextBytes } },
      manifest,
      block: createBlock('text-block', { id: 'root', content: 'Badge' }),
      declaredResourceDependencies: declarations,
      outputPath: '/tmp/badge.ocblock',
    })

    const content = new TextDecoder().decode(bytes)
    expect(JSON.parse(content)).toMatchObject({
      declaredResourceDependencies: declarations,
    })
    const roundTrip = await readProjectCustomBlockPackage({
      readBinaryFile: async () => bytes,
    }, '/tmp/badge.ocblock')
    expect(roundTrip.block, JSON.stringify(roundTrip.issues)).toMatchObject({ type: 'text-block', content: 'Badge' })
    expect(roundTrip.manifest.packageId).toBe('block:badge')
  })

  it('preserves public fields and declarations when a standalone .ocblock is read', async () => {
    const content = JSON.stringify({
      type: 'opencard-custom-block',
      key: 'badge',
      name: 'Badge',
      root: createBlock('text-block', { id: 'root', content: 'Badge' }),
      publicFieldKeys: ['name', 'notes'],
      declaredResourceDependencies: declarations,
    })
    const result = await readProjectCustomBlockPackage({
      readBinaryFile: async () => strToU8(content),
    }, '/project/.opencard/exports/badge.ocblock')

    expect(result.manifest.publicFieldKeys).toEqual(['height', 'width', 'name', 'notes'])
    expect(result.declaredResourceDependencies).toEqual(declarations)
  })
})
