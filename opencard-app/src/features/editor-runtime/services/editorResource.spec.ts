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

  it('projects files inside the resource root as relative display paths', () => {
    expect(getEditorResourceRelativePath('D:/Project', 'd:/project/cards/hero.opencard'))
      .toBe('cards/hero.opencard')
    expect(getEditorResourceRelativePath('D:/Project', 'C:/External/hero.opencard')).toBeNull()
    expect(getEditorResourceRelativePath(null, 'draft://card-id')).toBeNull()
  })
})
