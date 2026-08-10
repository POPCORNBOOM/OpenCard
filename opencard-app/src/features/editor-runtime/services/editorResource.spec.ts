import { describe, expect, it } from 'vitest'

import {
  getEditorResourceRelativePath,
  isRemoteResourceAllowed,
  resolveEditorResourcePath,
} from './editorResource'

describe('editorResource', () => {
  it('resolves relative paths against the editor resource root', () => {
    expect(resolveEditorResourcePath('D:\\Cards', 'assets\\portrait.png'))
      .toBe('D:/Cards/assets/portrait.png')
  })

  it('keeps absolute paths independent from the resource root', () => {
    expect(resolveEditorResourcePath('D:/Cards', 'C:/Shared/portrait.png'))
      .toBe('C:/Shared/portrait.png')
  })

  it('cannot resolve a relative path without a resource root', () => {
    expect(resolveEditorResourcePath(null, 'assets/portrait.png')).toBeNull()
  })

  it('allows only HTTPS URLs matching the project host allowlist', () => {
    const policy = {
      mode: 'allowlist' as const,
      allowedHosts: ['images.example.com', '*.cdn.example.com'],
    }
    expect(isRemoteResourceAllowed('https://images.example.com/portrait.png', policy)).toBe(true)
    expect(isRemoteResourceAllowed('https://a.cdn.example.com/portrait.png', policy)).toBe(true)
    expect(isRemoteResourceAllowed('https://cdn.example.com/portrait.png', policy)).toBe(false)
    expect(isRemoteResourceAllowed('http://images.example.com/portrait.png', policy)).toBe(false)
    expect(isRemoteResourceAllowed('data:image/png;base64,abc', policy)).toBe(false)
    expect(isRemoteResourceAllowed('https://images.example.com/portrait.png', undefined)).toBe(false)
    expect(isRemoteResourceAllowed('https://any.example.net/portrait.png', { mode: 'allow-all' })).toBe(true)
  })

  it('projects files inside the resource root as relative display paths', () => {
    expect(getEditorResourceRelativePath('D:/Project', 'd:/project/cards/hero.ocdocument'))
      .toBe('cards/hero.ocdocument')
    expect(getEditorResourceRelativePath('D:/Project', 'C:/External/hero.ocdocument')).toBeNull()
    expect(getEditorResourceRelativePath(null, 'draft://card-id')).toBeNull()
  })
})
