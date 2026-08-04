import { beforeEach, describe, expect, it, vi } from 'vitest'

const { convertFileSrc } = vi.hoisted(() => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}))

vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc }))

import {
  getEditorResourceRelativePath,
  resolveEditorAssetSrc,
  resolveEditorResourcePath,
} from './editorResource'

describe('editorResource', () => {
  beforeEach(() => convertFileSrc.mockClear())

  it('resolves relative paths against the editor resource root', () => {
    expect(resolveEditorResourcePath('D:\\Cards', 'assets\\portrait.png'))
      .toBe('D:/Cards/assets/portrait.png')
    expect(resolveEditorAssetSrc('D:/Cards', 'assets/portrait.png'))
      .toBe('asset://D:/Cards/assets/portrait.png')
  })

  it('keeps absolute paths independent from the resource root', () => {
    expect(resolveEditorResourcePath('D:/Cards', 'C:/Shared/portrait.png'))
      .toBe('C:/Shared/portrait.png')
  })

  it('cannot resolve a relative path without a resource root', () => {
    expect(resolveEditorResourcePath(null, 'assets/portrait.png')).toBeNull()
    expect(resolveEditorAssetSrc(null, 'assets/portrait.png')).toBe('')
    expect(convertFileSrc).not.toHaveBeenCalled()
  })

  it('allows only HTTPS URLs matching the project host allowlist', () => {
    const policy = {
      mode: 'allowlist' as const,
      allowedHosts: ['images.example.com', '*.cdn.example.com'],
    }
    expect(resolveEditorAssetSrc('D:/Cards', 'https://images.example.com/portrait.png', policy))
      .toBe('https://images.example.com/portrait.png')
    expect(resolveEditorAssetSrc('D:/Cards', 'https://a.cdn.example.com/portrait.png', policy))
      .toBe('https://a.cdn.example.com/portrait.png')
    expect(resolveEditorAssetSrc('D:/Cards', 'https://cdn.example.com/portrait.png', policy)).toBe('')
    expect(resolveEditorAssetSrc('D:/Cards', 'http://images.example.com/portrait.png', policy)).toBe('')
    expect(resolveEditorAssetSrc('D:/Cards', 'data:image/png;base64,abc', policy)).toBe('')
    expect(resolveEditorAssetSrc('D:/Cards', 'https://images.example.com/portrait.png')).toBe('')
    expect(resolveEditorAssetSrc('D:/Cards', 'https://any.example.net/portrait.png', { mode: 'allow-all' }))
      .toBe('https://any.example.net/portrait.png')
  })

  it('projects files inside the resource root as relative display paths', () => {
    expect(getEditorResourceRelativePath('D:/Project', 'd:/project/cards/hero.ocdocument'))
      .toBe('cards/hero.ocdocument')
    expect(getEditorResourceRelativePath('D:/Project', 'C:/External/hero.ocdocument')).toBeNull()
    expect(getEditorResourceRelativePath(null, 'draft://card-id')).toBeNull()
  })
})
