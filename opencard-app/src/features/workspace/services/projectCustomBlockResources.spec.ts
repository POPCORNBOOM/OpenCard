import { describe, expect, it } from 'vitest'
import { strFromU8 } from 'fflate'
import { createBlock } from '../../../entities/card/model'
import { parseProjectFontRegistryText, type ProjectFontRegistry } from '../model/projectFontRegistry'
import { parseProjectIconRegistryText } from '../model/projectIconRegistry'
import type { ProjectCustomBlockManifestCatalog } from '../model/projectCustomBlocks'
import {
  analyzeProjectCustomBlockResources,
  materializeProjectCustomBlockResources,
} from './projectCustomBlockResources'

const files = new Map<string, Uint8Array>([
  ['/project/assets/background.png', new Uint8Array([1])],
  ['/project/assets/dynamic/one.png', new Uint8Array([2])],
  ['/project/assets/dynamic/two.png', new Uint8Array([3])],
  ['/project/.opencard/fonts/body.woff2', new Uint8Array([4])],
  ['/project/.opencard/fonts/symbols.woff2', new Uint8Array([5])],
  ['/project/.opencard/icons/status.png', new Uint8Array([6])],
  ['/installed/bob/child/manifest.json', new Uint8Array([7])],
  ['/installed/bob/child/block.json', new Uint8Array([8])],
  ['/installed/bob/child/resources/.opencard/blocks/carol/grandchild/manifest.json', new Uint8Array([9])],
])

const projectEntries = [
  'assets/background.png',
  'assets/dynamic/one.png',
  'assets/dynamic/two.png',
  '.opencard/fonts/body.woff2',
  '.opencard/fonts/symbols.woff2',
  '.opencard/icons/status.png',
].map(name => ({ name, isFile: true, isDirectory: false, isSymlink: false }))
const dependencyEntries = [
  'manifest.json',
  'block.json',
  'resources/.opencard/blocks/carol/grandchild/manifest.json',
].map(name => ({ name, isFile: true, isDirectory: false, isSymlink: false }))

const fs = {
  readDirectoryEntries: async (path: string) => path === '/project' ? projectEntries : dependencyEntries,
  fileExists: async (path: string) => files.has(path),
  readBinaryFile: async (path: string) => {
    const bytes = files.get(path)
    if (!bytes) throw new Error(`Missing file: ${path}`)
    return bytes
  },
}

const projectFonts: ProjectFontRegistry = {
  body: {
    kind: 'family', name: 'Body',
    family: { key: 'body', name: 'Body', files: { normal: { upright: 'fonts/body.woff2' } } },
  },
  symbols: {
    kind: 'family', name: 'Symbols',
    family: { key: 'symbols', name: 'Symbols', files: { normal: { upright: 'fonts/symbols.woff2' } } },
  },
  mixed: {
    kind: 'composition', name: 'Mixed',
    composition: { key: 'mixed', name: 'Mixed', members: [{ fontKey: 'body' }, { fontKey: 'symbols' }] },
  },
}

const projectIconSeries = [{
  key: 'status', name: 'Status', source: 'icons/status.png',
  icons: [
    { iconKey: 'star', name: 'Star', x: 0, y: 0, width: 16, height: 16 },
    { iconKey: 'circle', name: 'Circle', x: 16, y: 0, width: 16, height: 16 },
  ],
}]

const childManifest = {
  type: 'opencard-custom-block' as const,
  packageId: 'bob/child', version: '1.0.0', name: 'Child', publicFieldKeys: [],
  resize: { widthLocked: true, heightLocked: true },
}
const customBlockManifestCatalog: ProjectCustomBlockManifestCatalog = new Map([['bob/child', {
  manifest: childManifest,
  installationPath: '/installed/bob/child',
  resourceRootPath: '/installed/bob/child/resources',
  loadState: 'unloaded',
}]])

function resourceRoot() {
  const root = createBlock('simple-container-block', { id: 'root' })
  root.children.push(
    {
      block: createBlock('image-block', { id: 'background', image: 'assets/background.png' }),
      location: { id: 'background-location', type: 'simple-container-location', anchor: 'lt' },
    },
    {
      block: createBlock('image-block', { id: 'dynamic', image: 'assets/dynamic/{{self:file}}.png' }),
      location: { id: 'dynamic-location', type: 'simple-container-location', anchor: 'lt' },
    },
    {
      block: createBlock('text-block', { id: 'text', fontFamily: 'font:mixed', content: '[[icon:status/star]]' }),
      location: { id: 'text-location', type: 'simple-container-location', anchor: 'lt' },
    },
    {
      block: createBlock('custom-block', { id: 'child', packageId: 'bob/child' }),
      location: { id: 'child-location', type: 'simple-container-location', anchor: 'lt' },
    },
  )
  return root
}

describe('project custom block resource analysis', () => {
  it('detects static references, dynamic suggestions, font composition members, icons, and nested packages', async () => {
    const analysis = await analyzeProjectCustomBlockResources({
      root: resourceRoot(), projectRootPath: '/project', fs,
      projectFonts, projectIconSeries, customBlockManifestCatalog,
    })
    const byId = new Map(analysis.candidates.map(candidate => [candidate.id, candidate]))
    expect(byId.get('image:assets/background.png')).toMatchObject({ automatic: true, suggested: false })
    expect(byId.get('image:assets/dynamic/one.png')).toMatchObject({ automatic: false, suggested: true })
    expect(byId.get('image:assets/dynamic/two.png')).toMatchObject({ automatic: false, suggested: true })
    expect(byId.get('font:.opencard/fonts/body.woff2')).toMatchObject({ automatic: true, fontKey: 'body' })
    expect(byId.get('font:.opencard/fonts/symbols.woff2')).toMatchObject({ automatic: true, fontKey: 'symbols' })
    expect(byId.get('icon:status')).toMatchObject({ automatic: true, iconKeys: ['star'] })
    expect(byId.get('custom-block:bob/child')).toMatchObject({ automatic: true, packageId: 'bob/child' })
  })

  it('keeps missing static images visible as selected diagnostic candidates', async () => {
    const root = createBlock('image-block', { id: 'missing', image: 'assets/missing.png' })
    const analysis = await analyzeProjectCustomBlockResources({ root, projectRootPath: '/project', fs })
    expect(analysis.candidates).toContainEqual(expect.objectContaining({
      id: 'image:assets/missing.png', automatic: true, missing: true,
    }))
    expect(analysis.defaultSelectedIds.has('image:assets/missing.png')).toBe(true)
  })

  it('materializes only the final selection, trims registries, and copies nested packages recursively', async () => {
    const analysis = await analyzeProjectCustomBlockResources({
      root: resourceRoot(), projectRootPath: '/project', fs,
      projectFonts, projectIconSeries, customBlockManifestCatalog,
    })
    const selected = new Set(analysis.defaultSelectedIds)
    selected.delete('image:assets/background.png')
    selected.delete('image:assets/dynamic/two.png')
    const result = await materializeProjectCustomBlockResources({
      analysis, selectedIds: selected, projectRootPath: '/project', fs,
      projectFonts, projectIconSeries, customBlockManifestCatalog,
    })
    expect(result.files.has('resources/assets/background.png')).toBe(false)
    expect(result.files.has('resources/assets/dynamic/one.png')).toBe(true)
    expect(result.files.has('resources/assets/dynamic/two.png')).toBe(false)
    expect(result.files.has('resources/.opencard/blocks/bob/child/manifest.json')).toBe(true)
    expect(result.files.has('resources/.opencard/blocks/bob/child/resources/.opencard/blocks/carol/grandchild/manifest.json')).toBe(true)

    const fontRegistry = parseProjectFontRegistryText(strFromU8(result.files.get('resources/.opencard/.ocfonts')!))
    expect(fontRegistry?.families?.map(font => font.key)).toEqual(['body', 'symbols'])
    expect(fontRegistry?.compositions?.map(composition => composition.key)).toEqual(['mixed'])
    const iconRegistry = parseProjectIconRegistryText(strFromU8(result.files.get('resources/.opencard/.ocicons')!))
    expect(iconRegistry?.iconSeries?.[0]?.icons.map(icon => icon.iconKey)).toEqual(['star'])
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'resource-unavailable', path: 'assets/background.png',
    }))
  })
})
