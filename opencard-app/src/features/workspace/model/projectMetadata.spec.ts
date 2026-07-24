import { describe, expect, it } from 'vitest'
import {
  parseProjectMetadata,
  parseProjectMetadataText,
  serializeProjectMetadata,
  toProjectInformation,
} from './projectMetadata'

describe('project profile metadata', () => {
  it('accepts an empty profile', () => {
    expect(parseProjectMetadata({})).toEqual({})
    expect(parseProjectMetadataText('{}')).toEqual({})
  })

  it('parses only the three project introduction fields', () => {
    expect(parseProjectMetadata({
      name: 'Demo',
      description: 'Description',
      version: '1.0.0',
    })).toEqual({ name: 'Demo', description: 'Description', version: '1.0.0' })
  })

  it('rejects unknown fields and wrong value types', () => {
    expect(parseProjectMetadata({ name: 'Demo', globalvariables: {} })).toBeNull()
    expect(parseProjectMetadata({ version: 2 })).toBeNull()
    expect(parseProjectMetadataText('{broken')).toBeNull()
  })

  it('omits empty fields when serializing', () => {
    expect(JSON.parse(serializeProjectMetadata({ name: '', description: '', version: '' }))).toEqual({})
  })

  it('creates a complete runtime snapshot', () => {
    expect(toProjectInformation({ name: 'Demo' })).toEqual({
      name: 'Demo',
      description: '',
      version: '',
    })
  })
})
