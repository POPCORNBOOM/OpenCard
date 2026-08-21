import { describe, expect, it } from 'vitest'
import { createBlock } from '../../../entities/card/model'
import {
  flattenCustomBlockRuntimeCatalog,
  loadInstalledProjectCustomBlockRuntime,
} from './projectCustomBlockAssetLoader'

type Entry = { name: string; isFile: boolean; isDirectory: boolean; isSymlink: boolean }

function manifest(packageId: string, name: string): string {
  return JSON.stringify({
    type: 'opencard-custom-block',
    packageId,
    version: '1.2.0',
    name,
    publicFieldKeys: [],
    resize: { widthLocked: false, heightLocked: false },
  })
}

function createInstalledPackageFileSystem() {
  const files = new Map<string, string>([
    ['/project/.opencard/blocks/alice/picture/manifest.json', manifest('alice/picture', 'Picture')],
    ['/project/.opencard/blocks/alice/picture/block.json', JSON.stringify(
      createBlock('image-block', { id: 'root', image: 'assets/picture.png' }),
    )],
    ['/project/.opencard/blocks/alice/picture/resources/.opencard/.ocfonts', '{}'],
    ['/project/.opencard/blocks/alice/picture/resources/.opencard/.ocicons', '{}'],
    ['/project/.opencard/blocks/alice/picture/resources/.opencard/blocks/bob/frame/manifest.json',
      manifest('bob/frame', 'Frame')],
    ['/project/.opencard/blocks/alice/picture/resources/.opencard/blocks/bob/frame/block.json',
      JSON.stringify(createBlock('simple-container-block', { id: 'frame' }))],
  ])
  const directories = new Set([
    '/project/.opencard/blocks/alice/picture/resources',
    '/project/.opencard/blocks/alice/picture/resources/.opencard/blocks',
    '/project/.opencard/blocks/alice/picture/resources/.opencard/blocks/bob/frame',
    '/project/.opencard/blocks/alice/picture/resources/.opencard/blocks/bob/frame/resources',
  ])
  const entries: Record<string, Entry[]> = {
    '/project/.opencard/blocks/alice/picture/resources/.opencard/blocks': [
      { name: 'bob', isFile: false, isDirectory: true, isSymlink: false },
      { name: 'bob/frame', isFile: false, isDirectory: true, isSymlink: false },
    ],
    '/project/.opencard/blocks/alice/picture/resources/.opencard/blocks/bob/frame/resources/.opencard/blocks': [],
  }
  return {
    fileExists: async (path: string) => files.has(path) || directories.has(path),
    readFile: async (path: string) => {
      const value = files.get(path)
      if (value === undefined) throw new Error(`Missing file: ${path}`)
      return value
    },
    readDirectoryEntries: async (path: string) => entries[path] ?? [],
  }
}

describe('installed project custom block runtime loader', () => {
  it('loads a package from its installation directory into a unified resource environment', async () => {
    const result = await loadInstalledProjectCustomBlockRuntime({
      fs: createInstalledPackageFileSystem(),
      installationPath: '/project/.opencard/blocks/alice/picture',
    })

    expect(result.entry).toMatchObject({
      manifest: { packageId: 'alice/picture', version: '1.2.0' },
      installationPath: '/project/.opencard/blocks/alice/picture',
      resourceRootPath: '/project/.opencard/blocks/alice/picture/resources',
    })
    expect(result.runtimeEntry.environment).toMatchObject({
      kind: 'package',
      namespace: 'package-alice-picture',
      rootPath: '/project/.opencard/blocks/alice/picture/resources',
    })
    expect(result.runtimeEntry.block).toMatchObject({ id: 'root', image: 'assets/picture.png' })
  })

  it('loads nested installed packages in lexical environments and flattens them for lifecycle use', async () => {
    const result = await loadInstalledProjectCustomBlockRuntime({
      fs: createInstalledPackageFileSystem(),
      installationPath: '/project/.opencard/blocks/alice/picture',
    })

    expect(result.runtimeEntry.dependencies.get('bob/frame')).toMatchObject({
      manifest: { packageId: 'bob/frame', version: '1.2.0' },
      environment: {
        rootPath: '/project/.opencard/blocks/alice/picture/resources/.opencard/blocks/bob/frame/resources',
      },
    })
    expect(result.environments.map(environment => environment.namespace)).toEqual([
      'package-alice-picture',
      'package-bob-frame',
    ])
    expect([...flattenCustomBlockRuntimeCatalog(new Map([
      ['alice/picture', result.runtimeEntry],
    ])).keys()]).toEqual(['alice/picture', 'bob/frame'])
  })
})
