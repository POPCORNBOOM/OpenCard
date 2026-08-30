import { describe, expect, it } from 'vitest'
import {
  networkResourceExtension,
  normalizeNetworkResourceProjectPath,
  normalizeNetworkResourceUrl,
  parseNetworkResourceProjectManifest,
  parseNetworkResourceRootManifest,
} from './networkResourceCache'

const UID = '550e8400-e29b-41d4-a716-446655440000'

describe('network resource cache model', () => {
  it('normalizes project identities and remote URL keys', () => {
    expect(normalizeNetworkResourceProjectPath('D:\\Projects\\OpenCard\\')).toBe('d:/projects/opencard')
    expect(normalizeNetworkResourceProjectPath('/home/user/OpenCard/')).toBe('/home/user/OpenCard')
    expect(normalizeNetworkResourceProjectPath('relative/project')).toBeNull()
    expect(normalizeNetworkResourceUrl(' HTTPS://Example.com:443/image.png?v=2#preview '))
      .toBe('https://example.com/image.png?v=2')
    expect(normalizeNetworkResourceUrl('http://example.com/image.png')).toBeNull()
  })

  it('keeps valid manifest entries and ignores damaged cache data', () => {
    expect(parseNetworkResourceRootManifest({ projects: {
      'D:\\Projects\\OpenCard': UID,
      broken: 'not-a-uuid',
    } })).toEqual({ projects: { 'd:/projects/opencard': UID } })

    expect(parseNetworkResourceProjectManifest({ resources: {
      'https://EXAMPLE.com/image.png#preview': {
        uid: UID,
        extension: '.PNG',
        refreshedAt: '2026-08-29T12:00:00+00:00',
      },
      'http://example.com/unsafe.png': {
        uid: UID,
        extension: '.png',
        refreshedAt: '2026-08-29T12:00:00.000Z',
      },
    } })).toEqual({ resources: {
      'https://example.com/image.png': {
        uid: UID,
        extension: '.png',
        refreshedAt: '2026-08-29T12:00:00.000Z',
      },
    } })
  })

  it('prefers a safe URL extension and falls back to content type or bin', () => {
    expect(networkResourceExtension('https://example.com/image.WEBP', 'image/png')).toBe('.webp')
    expect(networkResourceExtension('https://example.com/download?id=1', 'image/png; charset=binary')).toBe('.png')
    expect(networkResourceExtension('https://example.com/download?id=1', 'application/octet-stream')).toBe('.bin')
  })

})
