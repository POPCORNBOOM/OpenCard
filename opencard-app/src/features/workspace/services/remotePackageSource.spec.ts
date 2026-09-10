import { describe, expect, it } from 'vitest'
import { createRemotePackageLocator, parseRemotePackageEntry, parseRemotePackageSource } from './remotePackageSource'

describe('parseRemotePackageEntry', () => {
  it('derives a readable prefix plus an identity hash from the platform, author, and repository', () => {
    expect(parseRemotePackageEntry('github:Alice/My-Theme@v1.2.3')).toMatchObject({
      platform: 'github',
      key: 'github-alice-my-theme-e7c306',
      owner: 'Alice',
      repo: 'My-Theme',
      version: 'v1.2.3',
    })
    expect(parseRemotePackageEntry('https://github.com/alice/my-theme.git@1.0.0')).toMatchObject({
      platform: 'github',
      key: 'github-alice-my-theme-e7c306',
      version: '1.0.0',
    })
    expect(parseRemotePackageEntry('alice/my.theme@latest')).toMatchObject({
      platform: 'github',
      key: 'github-alice-my.theme-1cebb8',
      version: 'latest',
    })
  })

  it('keeps hyphenated authors and repositories on distinct package identities', () => {
    expect(parseRemotePackageEntry('github:xx-xx/theme@1.0.0')!.key).toBe('github-xx-xx-theme-7fcaed')
    expect(parseRemotePackageEntry('github:xx/xx-theme@1.0.0')!.key).toBe('github-xx-xx-theme-764829')
  })

  it('ignores the tag when deriving the package identity', () => {
    expect(parseRemotePackageEntry('github:alice/my-theme@1.0.0')!.key)
      .toBe(parseRemotePackageEntry('github:alice/my-theme@v2.0.0')!.key)
  })

  it('rejects entries without a version or without exactly one author and repository', () => {
    for (const entry of ['github:alice/my-theme', 'alice/my-theme', 'a/b/c@1.0.0', 'github:alice/my-theme@', 'hello world']) {
      expect(parseRemotePackageEntry(entry)).toBeNull()
    }
  })

  it('round-trips a declaration into its canonical source locator', () => {
    const parsed = parseRemotePackageEntry('https://github.com/Alice/My-Theme@v1.0.0')!
    expect(createRemotePackageLocator(parsed)).toBe('github:Alice/My-Theme')
    expect(parseRemotePackageSource('github:Alice/My-Theme', 'v1.0.0')).toEqual({
      platform: 'github',
      owner: 'Alice',
      repo: 'My-Theme',
      version: 'v1.0.0',
    })
  })
})
