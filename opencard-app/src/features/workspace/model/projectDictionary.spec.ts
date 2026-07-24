import { describe, expect, it } from 'vitest'
import {
  parseProjectDictionary,
  resolveProjectDictionary,
  serializeProjectDictionary,
} from './projectDictionary'

describe('project dictionary', () => {
  it('accepts and serializes an empty dictionary', () => {
    expect(parseProjectDictionary({})).toEqual({})
    expect(JSON.parse(serializeProjectDictionary({}))).toEqual({})
  })

  it('parses base records and sparse language overrides', () => {
    expect(parseProjectDictionary({
      active: 'en_US',
      base: { title: '默认标题', subtitle: '' },
      languages: { en_US: { title: 'English title' } },
    })).toEqual({
      active: 'en_US',
      base: { title: '默认标题', subtitle: '' },
      languages: { en_US: { title: 'English title' } },
    })
  })

  it('rejects invalid keys, case-insensitive duplicates, and orphan overrides', () => {
    expect(parseProjectDictionary({ base: { '1title': 'x' } })).toBeNull()
    expect(parseProjectDictionary({ languages: { '1english': {} } })).toBeNull()
    expect(parseProjectDictionary({ languages: { en_US: {}, EN_us: {} } })).toBeNull()
    expect(parseProjectDictionary({ base: { Title: 'x', title: 'y' } })).toBeNull()
    expect(parseProjectDictionary({ base: { title: 'x' }, languages: { en_US: { missing: 'y' } } })).toBeNull()
  })

  it('rejects unknown fields and non-string values', () => {
    expect(parseProjectDictionary({ version: 1 })).toBeNull()
    expect(parseProjectDictionary({ base: { title: 1 } })).toBeNull()
    expect(parseProjectDictionary({ active: '1english' })).toBeNull()
  })

  it('preserves empty language columns while omitting empty containers', () => {
    expect(JSON.parse(serializeProjectDictionary({ base: {}, languages: { en_US: {} } }))).toEqual({
      languages: { en_US: {} },
    })
  })

  it('resolves the active language over base', () => {
    expect(resolveProjectDictionary({
      active: 'en_US',
      base: { title: '默认', subtitle: '副标题' },
      languages: { en_US: { title: 'English' } },
    })).toEqual({ values: { title: 'English', subtitle: '副标题' }, warning: null })
  })

  it('preserves a missing active language and falls back to base', () => {
    expect(resolveProjectDictionary({ active: 'fr_FR', base: { title: '默认' } })).toEqual({
      values: { title: '默认' },
      warning: 'active-language-missing',
    })
  })
})
