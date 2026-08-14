import { describe, expect, it } from 'vitest'
import {
  isProjectInternalRelativePath,
  PROJECT_CUSTOM_BLOCK_REGISTRY_FILE_NAME,
  PROJECT_DICTIONARY_FILE_NAME,
  PROJECT_FONT_REGISTRY_FILE_NAME,
  PROJECT_ICON_REGISTRY_FILE_NAME,
  PROJECT_INTERNAL_DIRECTORIES,
  PROJECT_PROFILE_FILE_NAME,
  resolveProjectInternalRelativePath,
} from './projectStructure'

describe('projectStructure', () => {
  it('keeps every managed document and asset directory under .opencard', () => {
    expect([
      PROJECT_PROFILE_FILE_NAME,
      PROJECT_FONT_REGISTRY_FILE_NAME,
      PROJECT_ICON_REGISTRY_FILE_NAME,
      PROJECT_DICTIONARY_FILE_NAME,
      PROJECT_CUSTOM_BLOCK_REGISTRY_FILE_NAME,
      ...PROJECT_INTERNAL_DIRECTORIES,
    ]).toEqual([
      '.opencard/.ocproject',
      '.opencard/.ocfonts',
      '.opencard/.ocicons',
      '.opencard/.oclocale',
      '.opencard/.ocblocks',
      '.opencard/fonts',
      '.opencard/icons',
      '.opencard/blocks',
    ])
  })

  it('resolves registry asset paths relative to the internal directory', () => {
    expect(resolveProjectInternalRelativePath('fonts\\Body.ttf')).toBe('.opencard/fonts/Body.ttf')
    expect(resolveProjectInternalRelativePath()).toBe('.opencard')
  })

  it('recognizes only the internal directory and its descendants', () => {
    expect(isProjectInternalRelativePath('.opencard')).toBe(true)
    expect(isProjectInternalRelativePath('.opencard/fonts/Body.ttf')).toBe(true)
    expect(isProjectInternalRelativePath('.opencard-cache')).toBe(false)
    expect(isProjectInternalRelativePath('cards/.opencard/file')).toBe(false)
  })
})
