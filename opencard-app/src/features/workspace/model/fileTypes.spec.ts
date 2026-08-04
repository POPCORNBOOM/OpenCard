import { describe, expect, it } from 'vitest'
import { resolveDirectoryIcon, resolveEntryIcon, resolveFileType } from './fileTypes'

describe('project metadata file types', () => {
  it('recognizes only the four exact project resource file names', () => {
    expect(resolveFileType('D:/Cards/.ocproject').id).toBe('opencard-project-profile')
    expect(resolveFileType('D:/Cards/.oclocale').id).toBe('opencard-dictionary')
    expect(resolveFileType('D:/Cards/.ocfonts').id).toBe('opencard-font-registry')
    expect(resolveFileType('D:/Cards/.ocicons').id).toBe('opencard-icon-registry')
    expect(resolveFileType('D:/Cards/en_US.ocproject').id).toBe('unsupported')
    expect(resolveFileType('D:/Cards/notes.oclocale').id).toBe('unsupported')
  })

  it('restricts special files to the project root', () => {
    expect(resolveFileType('D:/Cards/.oclocale', 'D:/Cards').id).toBe('opencard-dictionary')
    expect(resolveFileType('D:/Cards/locales/.oclocale', 'D:/Cards').id).toBe('unsupported')
    expect(resolveFileType('D:/Cards/nested/.ocproject', 'D:/Cards').id).toBe('unsupported')
    expect(resolveFileType('D:/Cards/nested/.ocfonts', 'D:/Cards').id).toBe('unsupported')
    expect(resolveFileType('D:/Cards/nested/.ocicons', 'D:/Cards').id).toBe('unsupported')
  })

  it('uses Windows-style case-insensitive project path comparison', () => {
    expect(resolveFileType('D:/CARDS/.OCLOCALE', 'd:/cards').id).toBe('opencard-dictionary')
  })

  it('keeps special file names case-sensitive on POSIX paths', () => {
    expect(resolveFileType('/cards/.oclocale', '/cards').id).toBe('opencard-dictionary')
    expect(resolveFileType('/cards/.OCLOCALE', '/cards').id).toBe('unsupported')
  })

  it('recognizes card documents only by the new extension', () => {
    expect(resolveFileType('D:/Cards/main.ocdocument').id).toBe('opencard')
    expect(resolveFileType('D:/Cards/main.opencard').id).toBe('unsupported')
  })
})

describe('workspace entry icon tokens', () => {
  it('keeps category-specific collapsed folders and shares the open-folder token', () => {
    expect(resolveDirectoryIcon('D:/Cards/src', false)).toEqual({
      icon: 'folder.src',
      tone: 'folder-default',
    })
    expect(resolveDirectoryIcon('D:/Cards/src', true)).toEqual({
      icon: 'folder.open',
      tone: 'folder-open',
    })
  })

  it('uses the generic fallback token for unknown folders', () => {
    expect(resolveDirectoryIcon('D:/Cards/custom', false)).toEqual({
      icon: 'folder.generic',
      tone: 'folder-default',
    })
  })

  it('uses the config tone for package metadata', () => {
    expect(resolveEntryIcon('D:/Cards/package.json', false)).toEqual({
      icon: 'file.package',
      tone: 'config',
    })
  })

  it('uses the package variant icon for the project icon registry', () => {
    expect(resolveEntryIcon('D:/Cards/.ocicons', false, false, 'D:/Cards')).toEqual({
      icon: 'file.package-variant',
      tone: 'config',
    })
  })

  it('uses a dedicated icon for project font files', () => {
    expect(resolveFileType('D:/Cards/assets/fonts/Brand.woff2')).toMatchObject({
      id: 'font',
      editorId: 'font-preview',
    })
    expect(resolveEntryIcon('D:/Cards/assets/fonts/Brand.ttf', false)).toEqual({
      icon: 'file.font',
      tone: 'active',
    })
  })

  it('keeps known text files editable and routes unknown extensions to the unsupported-file session', () => {
    expect(resolveFileType('D:/Cards/notes.txt')).toMatchObject({
      id: 'plaintext',
      editorId: 'monaco',
    })
    expect(resolveFileType('D:/Cards/archive.bin')).toMatchObject({
      id: 'unsupported',
      editorId: 'unsupported-file',
    })
  })
})
