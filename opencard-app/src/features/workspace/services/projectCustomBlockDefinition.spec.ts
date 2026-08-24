import { describe, expect, it } from 'vitest'
import { createBlock } from '../../../entities/card/model'
import { discoverProjectCustomBlockDefinitions, serializeProjectCustomBlockDefinition } from './projectCustomBlockDefinition'

function fsFor(files: Record<string, string>) {
  return {
    readFile: async (path: string) => files[path] ?? (() => { throw new Error(`Missing file: ${path}`) })(),
    readDirectoryEntries: async (path: string) => Object.keys(files)
      .filter(file => file.startsWith(`${path}/`))
      .map(file => ({
        name: file.slice(path.length + 1),
        isFile: true,
        isDirectory: false,
        isSymlink: false,
      })),
  }
}

function definition(key: string) {
  return serializeProjectCustomBlockDefinition({
    type: 'opencard-custom-block',
    key,
    name: key,
    root: createBlock('text-block', { id: `${key}-root`, content: key }),
    publicFieldKeys: ['name', 'notes', 'width', 'height'],
    declaredResourceDependencies: [],
  })
}

describe('discoverProjectCustomBlockDefinitions', () => {
  it('loads only blocks registered by blocks.json', async () => {
    const root = '/project'
    const catalog = await discoverProjectCustomBlockDefinitions(fsFor({
      [`${root}/.opencard/blocks/blocks.json`]: JSON.stringify({
        blocks: [{ key: 'badge', name: 'Badge', source: '.opencard/blocks/badge.ocblock' }],
      }),
      [`${root}/.opencard/blocks/badge.ocblock`]: definition('badge'),
      [`${root}/.opencard/blocks/unregistered.ocblock`]: definition('unregistered'),
    }), root)

    expect([...catalog.keys()]).toEqual(['badge'])
  })

  it('does not discover a definition whose registered source is missing', async () => {
    const root = '/project'
    const catalog = await discoverProjectCustomBlockDefinitions(fsFor({
      [`${root}/.opencard/blocks/blocks.json`]: JSON.stringify({
        blocks: [{ key: 'badge', name: 'Badge', source: '.opencard/blocks/missing.ocblock' }],
      }),
    }), root)

    expect(catalog.size).toBe(0)
  })
})
