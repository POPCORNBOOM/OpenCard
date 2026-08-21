import { describe, expect, it } from 'vitest'
import { EMPTY_PROJECT_ICON_CATALOG } from './projectIconCatalog'
import {
  createProjectResourceNamespace,
  normalizeProjectResourcePath,
  projectResourceScopeIdentity,
  resolveProjectEnvironmentFontFamily,
  resolveProjectResourceFilePath,
  type ProjectResourceEnvironment,
} from './projectResourceEnvironment'

function packageEnvironment(packageId: string): ProjectResourceEnvironment {
  const namespace = createProjectResourceNamespace('package', packageId)
  return {
    kind: 'package',
    namespace,
    rootPath: `/packages/${packageId}/resources`,
    fontDocument: {},
    fonts: { body: { kind: 'family', name: 'Body', family: { key: 'body', name: 'Body', files: {} } } },
    iconDocument: {},
    iconCatalog: EMPTY_PROJECT_ICON_CATALOG,
    issues: [],
  }
}

describe('ProjectResourceEnvironment', () => {
  it('resolves only safe project-relative paths beneath the environment root', () => {
    expect(normalizeProjectResourcePath('assets/card/a.png')).toBe('assets/card/a.png')
    expect(resolveProjectResourceFilePath({ rootPath: '/project' }, 'assets/card/a.png'))
      .toBe('/project/assets/card/a.png')
    for (const unsafe of ['../secret.png', '/absolute.png', 'C:/absolute.png', 'a/../../secret.png', 'a//b.png']) {
      expect(normalizeProjectResourcePath(unsafe)).toBeNull()
    }
  })

  it('isolates same-key package fonts by Package ID namespace', () => {
    const alice = packageEnvironment('alice/badge')
    const bob = packageEnvironment('bob/badge')
    const fallback = (value: string) => value
    const aliceFamily = resolveProjectEnvironmentFontFamily('font:body', alice, fallback)
    const bobFamily = resolveProjectEnvironmentFontFamily('font:body', bob, fallback)
    expect(aliceFamily).toContain('package-alice-badge')
    expect(bobFamily).toContain('package-bob-badge')
    expect(aliceFamily).not.toBe(bobFamily)
  })

  it('keeps field-level scope identities distinct for the same block', () => {
    expect(projectResourceScopeIdentity('block', 'image')).not.toBe(projectResourceScopeIdentity('block', 'fontFamily'))
    expect(projectResourceScopeIdentity('block', 'image')).not.toBe(projectResourceScopeIdentity('other', 'image'))
  })
})
