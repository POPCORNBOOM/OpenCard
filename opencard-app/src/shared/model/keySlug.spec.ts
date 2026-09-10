import { describe, expect, it } from 'vitest'
import { createAvailableKey, createPackageKey, toKeySlug } from './keySlug'

describe('keySlug', () => {
  it('creates readable keys for Chinese and normalized Latin text', () => {
    expect(toKeySlug('虚怀若谷')).toBe('xu-huai-ruo-gu')
    expect(toKeySlug('Résumé Display')).toBe('resume-display')
  })

  it('keeps other writing systems stable without producing an empty key', () => {
    expect(toKeySlug('Привет')).toMatch(/^u[0-9a-f]+(?:-u[0-9a-f]+)+$/)
    expect(toKeySlug('---', 'family')).toBe('family')
  })

  it('resolves collisions without regard to key casing', () => {
    expect(createAvailableKey('Brand Sans', ['brand-sans', 'BRAND-SANS-2'], 'font'))
      .toBe('brand-sans-3')
  })

  it('derives a package identity key from source, author, and name', () => {
    expect(createPackageKey({ source: 'github', author: 'alice', name: 'my-theme' }))
      .toBe('github-alice-my-theme-e7c306')
    expect(createPackageKey({ source: 'github', author: 'Alice', name: 'My-Theme' }))
      .toBe('github-alice-my-theme-e7c306')
  })

  it('keeps identities with the same readable prefix apart', () => {
    expect(createPackageKey({ source: 'github', author: 'xx-xx', name: 'theme' }))
      .toBe('github-xx-xx-theme-7fcaed')
    expect(createPackageKey({ source: 'github', author: 'xx', name: 'xx-theme' }))
      .toBe('github-xx-xx-theme-764829')
  })

  it('lets a local package carry its publisher in the readable prefix', () => {
    expect(createPackageKey({ source: 'local', author: 'publisher-a', name: 'my-theme' }))
      .toBe('local-publisher-a-my-theme-49d6e4')
    expect(createPackageKey({ source: 'local', author: 'publisher-b', name: 'my-theme' }))
      .not.toBe(createPackageKey({ source: 'local', author: 'publisher-a', name: 'my-theme' }))
  })
})
