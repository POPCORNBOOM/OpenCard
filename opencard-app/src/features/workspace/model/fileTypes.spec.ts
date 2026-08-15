import { describe, expect, it } from 'vitest'
import { resolveDirectoryIcon, resolveEntryIcon, resolveFileType } from './fileTypes'

describe('project metadata file types', () => {
  it('recognizes exact project resource file names and custom block packages', () => {
    expect(resolveFileType('D:/Cards/.ocproject').id).toBe('opencard-project-profile')
    expect(resolveFileType('D:/Cards/.oclocale').id).toBe('opencard-dictionary')
    expect(resolveFileType('D:/Cards/.ocfonts').id).toBe('opencard-font-registry')
    expect(resolveFileType('D:/Cards/.ocicons').id).toBe('opencard-icon-registry')
    expect(resolveFileType('D:/Cards/.ocblocks')).toMatchObject({
      id: 'opencard-custom-block-registry',
      editorId: 'custom-block-registry',
    })
    expect(resolveFileType('D:/Cards/assets/square.ocblock')).toMatchObject({
      id: 'opencard-custom-block',
      editorId: 'custom-block-package',
    })
    expect(resolveFileType('D:/Cards/en_US.ocproject').id).toBe('unsupported')
    expect(resolveFileType('D:/Cards/notes.oclocale').id).toBe('unsupported')
  })

  it('restricts special files to the managed project directory', () => {
    expect(resolveFileType('D:/Cards/.opencard/.oclocale', 'D:/Cards').id).toBe('opencard-dictionary')
    expect(resolveFileType('D:/Cards/.oclocale', 'D:/Cards').id).toBe('unsupported')
    expect(resolveFileType('D:/Cards/locales/.oclocale', 'D:/Cards').id).toBe('unsupported')
    expect(resolveFileType('D:/Cards/nested/.ocproject', 'D:/Cards').id).toBe('unsupported')
    expect(resolveFileType('D:/Cards/nested/.ocfonts', 'D:/Cards').id).toBe('unsupported')
    expect(resolveFileType('D:/Cards/nested/.ocicons', 'D:/Cards').id).toBe('unsupported')
    expect(resolveFileType('D:/Cards/nested/.ocblocks', 'D:/Cards').id).toBe('unsupported')
  })

  it('uses Windows-style case-insensitive project path comparison', () => {
    expect(resolveFileType('D:/CARDS/.OPENCARD/.OCLOCALE', 'd:/cards').id).toBe('opencard-dictionary')
  })

  it('keeps special file names case-sensitive on POSIX paths', () => {
    expect(resolveFileType('/cards/.opencard/.oclocale', '/cards').id).toBe('opencard-dictionary')
    expect(resolveFileType('/cards/.opencard/.OCLOCALE', '/cards').id).toBe('unsupported')
  })

  it('recognizes card documents only by the new extension', () => {
    expect(resolveFileType('D:/Cards/main.ocdocument').id).toBe('opencard')
    expect(resolveFileType('D:/Cards/main.opencard').id).toBe('unsupported')
  })
})

describe('workspace entry icon tokens', () => {
  it('uses closed and open folder glyphs with the same yellow tone', () => {
    expect(resolveDirectoryIcon('D:/Cards/src', false)).toEqual({
      icon: 'folder.generic',
      tone: 'folder-open',
    })
    expect(resolveDirectoryIcon('D:/Cards/src', true)).toEqual({
      icon: 'folder.open',
      tone: 'folder-open',
    })
  })

  it('uses the generic fallback token for unknown folders', () => {
    expect(resolveDirectoryIcon('D:/Cards/custom', false)).toEqual({
      icon: 'folder.generic',
      tone: 'folder-open',
    })
  })

  it('uses the config tone for package metadata', () => {
    expect(resolveEntryIcon('D:/Cards/package.json', false)).toEqual({
      icon: 'file.package',
      tone: 'config',
    })
  })

  it('uses the project icon glyph for the project icon registry', () => {
    expect(resolveEntryIcon('D:/Cards/.opencard/.ocicons', false, false, 'D:/Cards')).toEqual({
      icon: 'file.project-icon',
      tone: 'config',
    })
  })

  it('uses the translate icon for the project dictionary', () => {
    expect(resolveEntryIcon('D:/Cards/.opencard/.oclocale', false, false, 'D:/Cards')).toEqual({
      icon: 'file.dictionary',
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

  it('separates registered and unregistered project font files', () => {
    const registeredSources = new Set(['assets/fonts/Brand.woff2'])

    expect(resolveEntryIcon(
      'D:/Cards/assets/fonts/Brand.woff2',
      false,
      false,
      'D:/Cards',
      registeredSources,
    )).toEqual({
      icon: 'file.font',
      tone: 'active',
    })
    expect(resolveEntryIcon(
      'D:/Cards/assets/fonts/Other.woff2',
      false,
      false,
      'D:/Cards',
      registeredSources,
    )).toEqual({
      icon: 'file.font',
      tone: 'muted',
    })
    expect(resolveEntryIcon(
      'd:/cards/assets/fonts/BRAND.WOFF2',
      false,
      false,
      'D:/Cards',
      registeredSources,
    )).toEqual({
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
