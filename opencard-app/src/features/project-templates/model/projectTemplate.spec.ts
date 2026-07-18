import { describe, expect, it } from 'vitest'
import {
  parseProjectTemplateManifest,
  validateProjectName,
  validateTemplateDescription,
  validateTemplateName,
} from './projectTemplate'

describe('project template model', () => {
  it('normalizes a valid manifest', () => {
    expect(parseProjectTemplateManifest({
      schemaVersion: 1,
      id: 'tactical-showcase',
      name: '  Tactical Showcase  ',
      description: '  Advanced demo  ',
      entry: 'cards\\main.opencard',
      covers: ['assets\\cover.png', 'assets/cover.png', 'assets/second.webp'],
    })).toEqual({
      schemaVersion: 1,
      id: 'tactical-showcase',
      name: 'Tactical Showcase',
      description: 'Advanced demo',
      entry: 'cards/main.opencard',
      covers: ['assets/cover.png', 'assets/second.webp'],
    })
  })

  it.each([
    '',
    '.',
    '..',
    'bad/name',
    'bad:name',
    'CON',
    'lpt1.txt',
    'trailing.',
    'trailing ',
    'Demo\t',
    '\nDemo',
    'x'.repeat(81),
  ])('rejects invalid project name %j', (name) => {
    expect(validateProjectName(name)).toBe('invalid-project-name')
  })

  it('accepts a normalized project name and enforces template text limits', () => {
    expect(validateProjectName('  My Cards')).toBeNull()
    expect(validateTemplateName('  Personal Template  ')).toBeNull()
    expect(validateTemplateName(' '.repeat(4))).toBe('invalid-template-name')
    expect(validateTemplateDescription('x'.repeat(201))).toBe('description-too-long')
  })

  it.each([
    { id: 'valid-id', entry: 'main.opencard', covers: ['../cover.png'] },
    { id: 'valid-id', entry: 'main.opencard', covers: ['assets/cover.txt'] },
  ])('rejects unsafe cover data %#', ({ id, entry, covers }) => {
    expect(parseProjectTemplateManifest({
      schemaVersion: 1,
      id,
      name: 'Template',
      description: '',
      entry,
      covers,
    })).toBeNull()
  })

  it.each([
    { id: 'Bad_ID', entry: 'main.opencard' },
    { id: 'valid-id', entry: '../main.opencard' },
    { id: 'valid-id', entry: '/main.opencard' },
    { id: 'valid-id', entry: 'C:\\main.opencard' },
  ])('rejects unsafe manifest data %#', ({ id, entry }) => {
    expect(parseProjectTemplateManifest({
      schemaVersion: 1,
      id,
      name: 'Template',
      description: '',
      entry,
    })).toBeNull()
  })
})
