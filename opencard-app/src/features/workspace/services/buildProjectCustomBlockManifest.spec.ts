import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import { createBlock } from '../../../entities/card/model'
import { buildProjectCustomBlockManifest, buildProjectCustomBlockRoot } from './buildProjectCustomBlockManifest'

describe('buildProjectCustomBlockManifest', () => {
  it('builds the package identity, SemVer, and public fields', async () => {
    const root = createBlock('text-block', { id: 'root', name: 'Badge', content: 'Default' })
    const manifest = await buildProjectCustomBlockManifest({
      root,
      publisherKey: 'Alice',
      blockKey: 'Status-Badge',
      exposedFieldKeys: ['content'],
    })
    expect(manifest).toEqual({
      type: 'opencard-custom-block',
      packageId: 'alice/status-badge',
      version: '0.1.0',
      name: 'Badge',
      publicFieldKeys: ['name', 'notes', 'content'],
    })
  })

  it('requires shared Key slugs and a valid semantic version', async () => {
    const root = createBlock('text-block', { id: 'root' })
    await expect(buildProjectCustomBlockManifest({
      root, publisherKey: 'bad key', blockKey: 'badge',
    })).rejects.toThrow('Package ID')
    await expect(buildProjectCustomBlockManifest({
      root, publisherKey: 'alice', blockKey: 'badge', version: '1',
    })).rejects.toThrow('version')
  })

  it('rejects fields that are not exposed by the root schema', async () => {
    const root = createBlock('text-block', { id: 'root' })
    await expect(buildProjectCustomBlockManifest({
      root,
      publisherKey: 'alice',
      blockKey: 'badge',
      exposedFieldKeys: ['missing'],
    })).rejects.toThrow('not available on the root')
  })

  it('projects reactive editor blocks without invoking structuredClone on proxies', () => {
    const root = reactive(createBlock('image-block', {
      id: 'root',
      image: 'assets/picture.png',
    }))
    expect(buildProjectCustomBlockRoot(root)).toMatchObject({
      id: 'root',
      image: 'assets/picture.png',
    })
  })

  it('removes editor packaging state without flattening nested custom blocks', () => {
    const root = createBlock('simple-container-block', { id: 'root' })
    root.packaged = 'true'
    root.children.push({
      block: createBlock('custom-block', { id: 'nested', packageId: 'bob/label' }),
      location: { id: 'location', type: 'simple-container-location', anchor: 'lt' },
    })
    const projected = buildProjectCustomBlockRoot(root)
    expect(projected).not.toHaveProperty('packaged')
    expect(projected.type === 'simple-container-block' && projected.children[0]?.block).toMatchObject({
      type: 'custom-block', packageId: 'bob/label',
    })
  })
})
