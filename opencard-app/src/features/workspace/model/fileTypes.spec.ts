import { describe, expect, it } from 'vitest'
import { resolveFileType } from './fileTypes'

describe('project metadata file types', () => {
  it('recognizes only the two exact special file names', () => {
    expect(resolveFileType('D:/Cards/.opencardprojectprofile').id).toBe('opencard-project-profile')
    expect(resolveFileType('D:/Cards/.dictionary').id).toBe('opencard-dictionary')
    expect(resolveFileType('D:/Cards/en_US.opencardproject').id).toBe('plaintext')
    expect(resolveFileType('D:/Cards/notes.dictionary').id).toBe('plaintext')
  })

  it('restricts special files to the project root', () => {
    expect(resolveFileType('D:/Cards/.dictionary', 'D:/Cards').id).toBe('opencard-dictionary')
    expect(resolveFileType('D:/Cards/locales/.dictionary', 'D:/Cards').id).toBe('plaintext')
    expect(resolveFileType('D:/Cards/nested/.opencardprojectprofile', 'D:/Cards').id).toBe('plaintext')
  })

  it('uses Windows-style case-insensitive project path comparison', () => {
    expect(resolveFileType('D:/CARDS/.DICTIONARY', 'd:/cards').id).toBe('opencard-dictionary')
  })

  it('keeps special file names case-sensitive on POSIX paths', () => {
    expect(resolveFileType('/cards/.dictionary', '/cards').id).toBe('opencard-dictionary')
    expect(resolveFileType('/cards/.DICTIONARY', '/cards').id).toBe('plaintext')
  })
})
