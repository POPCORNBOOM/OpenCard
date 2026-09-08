import { describe, expect, it } from 'vitest'
import { relativizeResourcePath, resolveResourcePath, type ScopedResourcePathResult } from './scopedResourcePath'

function expectPath(result: ScopedResourcePathResult, value: string): void {
  expect(result).toEqual({ ok: true, value })
}

function expectIssue(result: ScopedResourcePathResult, code: string): void {
  expect(result).toMatchObject({ ok: false, code })
}

describe('resolveResourcePath', () => {
  const root = 'D:/project'

  it('resolves local, project, package, and nested-package references without a scope cache', () => {
    expectPath(resolveResourcePath(root, `${root}/cards/main.ocdocument`, 'images/bg.png'), `${root}/images/bg.png`)
    expectPath(resolveResourcePath(root, `${root}/cards/main.ocdocument`, '/images/bg.png'), `${root}/images/bg.png`)
    expectPath(resolveResourcePath(root, `${root}/cards/main.ocdocument`, 'theme@images/bg.png'), `${root}/.opencard/packages/theme/images/bg.png`)

    const themeDocument = `${root}/.opencard/packages/theme/cards/main.ocdocument`
    expectPath(resolveResourcePath(root, themeDocument, 'images/bg.png'), `${root}/.opencard/packages/theme/images/bg.png`)
    expectPath(resolveResourcePath(root, themeDocument, '@assets/logo.png'), `${root}/assets/logo.png`)
    expectPath(resolveResourcePath(root, themeDocument, 'icons@sprites/main.png'), `${root}/.opencard/packages/theme/.opencard/packages/icons/sprites/main.png`)

    const nestedDocument = `${root}/.opencard/packages/theme/.opencard/packages/icons/cards/main.ocdocument`
    expectPath(resolveResourcePath(root, nestedDocument, 'sprites/main.png'), `${root}/.opencard/packages/theme/.opencard/packages/icons/sprites/main.png`)
  })

  it('rejects unsafe syntax, package-storage bypasses, and invalid source scopes', () => {
    expectIssue(resolveResourcePath(root, `${root}/card.ocdocument`, '../secret.png'), 'unsafe-path')
    expectIssue(resolveResourcePath(root, `${root}/card.ocdocument`, 'images\\bg.png'), 'unsafe-path')
    expectIssue(resolveResourcePath(root, `${root}/card.ocdocument`, '.opencard/packages/theme/bg.png'), 'reserved-path')
    expectIssue(resolveResourcePath(root, `${root}/card.ocdocument`, 'theme@icons@main.png'), 'invalid-reference')
    expectIssue(resolveResourcePath(root, `${root}/card.ocdocument`, 'bad key@main.png'), 'invalid-reference')
    expectIssue(resolveResourcePath(root, `${root}/card.ocdocument`, 'packages.json@main.png'), 'invalid-reference')
    expectIssue(resolveResourcePath(root, 'D:/other/card.ocdocument', 'image.png'), 'source-outside-project')
    expectIssue(resolveResourcePath(root, `${root}/.opencard/packages/packages.json`, 'image.png'), 'source-outside-project')
  })

  it('supports POSIX projects and keeps POSIX containment case-sensitive', () => {
    expectPath(resolveResourcePath('/project', '/project/.opencard/packages/theme/card.ocdocument', 'image.png'), '/project/.opencard/packages/theme/image.png')
    expectIssue(resolveResourcePath('/project', '/PROJECT/card.ocdocument', 'image.png'), 'source-outside-project')
  })
})

describe('relativizeResourcePath', () => {
  const root = 'D:/project'
  const projectDocument = `${root}/cards/main.ocdocument`
  const themeDocument = `${root}/.opencard/packages/theme/cards/main.ocdocument`
  const iconDocument = `${root}/.opencard/packages/theme/.opencard/packages/icons/cards/main.ocdocument`

  it('creates the shortest canonical reference for representable scope relationships', () => {
    expectPath(relativizeResourcePath(root, projectDocument, `${root}/assets/logo.png`), 'assets/logo.png')
    expectPath(relativizeResourcePath(root, themeDocument, `${root}/.opencard/packages/theme/images/bg.png`), 'images/bg.png')
    expectPath(relativizeResourcePath(root, themeDocument, `${root}/assets/logo.png`), '@assets/logo.png')
    expectPath(relativizeResourcePath(root, projectDocument, `${root}/.opencard/packages/theme/images/bg.png`), 'theme@images/bg.png')
    expectPath(relativizeResourcePath(root, themeDocument, `${root}/.opencard/packages/theme/.opencard/packages/icons/sprites/main.png`), 'icons@sprites/main.png')
    expectPath(relativizeResourcePath(root, iconDocument, `${root}/.opencard/packages/theme/.opencard/packages/icons/sprites/main.png`), 'sprites/main.png')
  })

  it('rejects parent, sibling, deep-descendant, external, and reserved targets', () => {
    expectIssue(relativizeResourcePath(root, iconDocument, `${root}/.opencard/packages/theme/image.png`), 'unrepresentable-scope')
    expectIssue(relativizeResourcePath(root, themeDocument, `${root}/.opencard/packages/other/image.png`), 'unrepresentable-scope')
    expectIssue(relativizeResourcePath(root, projectDocument, `${root}/.opencard/packages/theme/.opencard/packages/icons/image.png`), 'unrepresentable-scope')
    expectIssue(relativizeResourcePath(root, projectDocument, 'D:/other/image.png'), 'target-outside-project')
    expectIssue(relativizeResourcePath(root, projectDocument, `${root}/.opencard/packages/packages.json`), 'target-outside-project')
  })
})
