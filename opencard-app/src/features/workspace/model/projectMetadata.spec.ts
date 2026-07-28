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

  it('parses project information and registered fonts', () => {
    expect(parseProjectMetadata({
      name: 'Demo',
      description: 'Description',
      version: '1.0.0',
      fonts: {
        'brand-sans': {
          family: 'Brand Sans',
          faces: [
            { source: 'assets\\fonts\\BrandSans-Regular.woff2', weight: '400' },
            { source: 'assets/fonts/BrandSans-Bold.woff2', weight: '700', style: 'normal' },
          ],
        },
      },
    })).toEqual({
      name: 'Demo',
      description: 'Description',
      version: '1.0.0',
      fonts: {
        'brand-sans': {
          family: 'Brand Sans',
          faces: [
            { source: 'assets/fonts/BrandSans-Regular.woff2', weight: '400' },
            { source: 'assets/fonts/BrandSans-Bold.woff2', weight: '700', style: 'normal' },
          ],
        },
      },
    })
  })

  it('rejects unknown fields and wrong value types', () => {
    expect(parseProjectMetadata({ name: 'Demo', globalvariables: {} })).toBeNull()
    expect(parseProjectMetadata({ version: 2 })).toBeNull()
    expect(parseProjectMetadata({
      fonts: { unsafe: { family: 'Unsafe', faces: [{ source: '../outside.ttf' }] } },
    })).toBeNull()
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
