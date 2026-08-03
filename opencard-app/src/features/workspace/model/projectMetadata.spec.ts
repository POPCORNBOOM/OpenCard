import { describe, expect, it } from 'vitest'
import {
  parseProjectMetadata,
  parseProjectMetadataText,
  serializeProjectMetadata,
  toProjectInformation,
} from './projectMetadata'

describe('project profile metadata', () => {
  it('accepts an empty profile', () => {
    expect(parseProjectMetadata({})).toEqual({})
    expect(parseProjectMetadataText('{}')).toEqual({})
  })

  it('ignores legacy registries and other unknown top-level fields', () => {
    expect(parseProjectMetadata({
      name: 'Demo',
      fonts: { 'brand-sans': { family: 'Brand Sans', faces: [] } },
      iconSeries: [{ invalid: true }],
      globalvariables: {},
    })).toEqual({ name: 'Demo' })
  })

  it('rejects wrong values for known fields', () => {
    expect(parseProjectMetadata({ version: 2 })).toBeNull()
    expect(parseProjectMetadataText('{broken')).toBeNull()
  })

  it('normalizes an HTTPS remote-resource host allowlist', () => {
    expect(parseProjectMetadata({
      remoteResources: {
        mode: 'allowlist',
        allowedHosts: ['Images.Example.com.', '*.cdn.example.com', 'images.example.com'],
      },
    })).toEqual({
      remoteResources: {
        mode: 'allowlist',
        allowedHosts: ['images.example.com', '*.cdn.example.com'],
      },
    })
  })

  it('rejects malformed remote-resource policies', () => {
    expect(parseProjectMetadata({ remoteResources: { mode: 'allow-all' } })).toEqual({
      remoteResources: { mode: 'allow-all' },
    })
    expect(parseProjectMetadata({ remoteResources: { mode: 'deny', allowedHosts: [] } })).toBeNull()
    expect(parseProjectMetadata({
      remoteResources: { mode: 'allowlist', allowedHosts: ['https://example.com/image.png'] },
    })).toBeNull()
  })

  it('omits empty fields when serializing', () => {
    expect(JSON.parse(serializeProjectMetadata({ name: '', description: '', version: '' }))).toEqual({})
  })

  it('creates a complete runtime snapshot', () => {
    expect(toProjectInformation({ name: 'Demo' })).toEqual({
      name: 'Demo',
      description: '',
      version: '',
    })
  })
})
