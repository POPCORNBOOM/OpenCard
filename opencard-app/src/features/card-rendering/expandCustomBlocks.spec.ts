import { describe, expect, it } from 'vitest'
import { createBlock, type CardBlock, type CardDocument } from '../../entities/card/model'
import { EMPTY_PROJECT_ICON_CATALOG } from '../workspace/services/projectIconCatalog'
import {
  projectResourceScopeIdentity,
  type ProjectResourceEnvironment,
} from '../workspace/services/projectResourceEnvironment'
import { expandCustomBlocks, type CustomBlockRuntimeCatalog, type CustomBlockRuntimeEntry } from './expandCustomBlocks'

function environment(kind: 'project' | 'package', identity: string, rootPath: string): ProjectResourceEnvironment {
  return {
    kind,
    namespace: `${kind}-${identity.replace('/', '-')}`,
    rootPath,
    fontDocument: {},
    fonts: {},
    iconDocument: {},
    iconCatalog: EMPTY_PROJECT_ICON_CATALOG,
    issues: [],
  }
}

function runtime(
  packageId: string,
  block: CardBlock,
  resourceEnvironment: ProjectResourceEnvironment,
  dependencies: CustomBlockRuntimeCatalog = new Map(),
  publicFieldKeys: readonly string[] = [],
): CustomBlockRuntimeEntry {
  return {
    manifest: { packageId, publicFieldKeys, resize: { widthLocked: false, heightLocked: false } },
    block,
    environment: { ...resourceEnvironment, customBlockCatalog: dependencies },
    dependencies,
  }
}

function documentWith(...blocks: CardBlock[]): CardDocument {
  return {
    type: 'card-document', id: 'document', version: '1', width: '100', height: '100', instances: [],
    faces: {
      front: {
        type: 'card-face', id: 'front', background: '',
        children: blocks.map((block, index) => ({
          block,
          location: { type: 'simple-container-location', id: `location-${index}`, anchor: 'lt' },
        })),
      },
      back: { type: 'card-face', id: 'back', background: '', children: [] },
    },
  }
}

describe('expandCustomBlocks', () => {
  it('namespaces descendants independently for each Package ID instance', () => {
    const root = createBlock('simple-container-block', { id: 'root' })
    root.children.push({
      block: createBlock('text-block', { id: 'label' }),
      location: { id: 'label-location', type: 'simple-container-location', anchor: 'lt' },
    })
    const packageEnvironment = environment('package', 'alice/item', '/packages/alice/item/resources')
    const entry = runtime('alice/item', root, packageEnvironment)
    const first = createBlock('custom-block', { id: 'first', packageId: 'alice/item' })
    const second = createBlock('custom-block', { id: 'second', packageId: 'alice/item' })
    const result = expandCustomBlocks(documentWith(first, second), new Map([['alice/item', entry]]))
    const [a, b] = result.document.faces.front.children.map(child => child.block)
    expect(a.type === 'simple-container-block' && a.children[0]?.block.id).toBe('first::block:label')
    expect(b.type === 'simple-container-block' && b.children[0]?.block.id).toBe('second::block:label')
    expect(a.type === 'simple-container-block' && a.children[0]?.location.id).toBe('first::location:label-location')
  })

  it('reports a missing Package ID without removing the host reference', () => {
    const host = createBlock('custom-block', { id: 'host', packageId: 'alice/missing' })
    const result = expandCustomBlocks(documentWith(host), new Map())
    expect(result.document.faces.front.children[0]?.block).toMatchObject({
      type: 'custom-block', packageId: 'alice/missing',
    })
    expect(result.issues).toEqual([{
      blockId: 'host', faceKey: 'front', reason: 'missing', packageId: 'alice/missing',
    }])
  })

  it('uses package scope for defaults and host scope for explicit public overrides', () => {
    const packageEnvironment = environment('package', 'alice/picture', '/packages/alice/picture/resources')
    const hostEnvironment = environment('project', 'host', '/host')
    const root = createBlock('image-block', { id: 'root', image: 'assets/default.png' })
    const entry = runtime('alice/picture', root, packageEnvironment, new Map(), ['image'])

    const defaultHost = createBlock('custom-block', { id: 'default-host', packageId: 'alice/picture' })
    const overrideHost = createBlock('custom-block', { id: 'override-host', packageId: 'alice/picture' })
    Object.assign(overrideHost, { image: 'assets/override.png' })
    const result = expandCustomBlocks(documentWith(defaultHost, overrideHost), new Map([
      ['alice/picture', entry],
    ]), hostEnvironment)

    expect(result.resourceScopes.get(projectResourceScopeIdentity('default-host', 'image'))?.rootPath)
      .toBe(packageEnvironment.rootPath)
    expect(result.resourceScopes.get(projectResourceScopeIdentity('override-host', 'image'))).toBe(hostEnvironment)
  })

  it('keeps nested overrides in the defining package scope', () => {
    const aEnvironment = environment('package', 'alice/a', '/packages/alice/a/resources')
    const bEnvironment = environment('package', 'bob/b', '/packages/bob/b/resources')
    const bRoot = createBlock('image-block', { id: 'b-root', image: 'assets/b-default.png' })
    const bEntry = runtime('bob/b', bRoot, bEnvironment, new Map(), ['image'])
    const bDependencies = new Map([['bob/b', bEntry]])
    const aRoot = createBlock('simple-container-block', { id: 'a-root' })
    const nested = createBlock('custom-block', { id: 'nested-b', packageId: 'bob/b' })
    Object.assign(nested, { image: 'assets/a-override.png' })
    aRoot.children.push({
      block: nested,
      location: { id: 'nested-location', type: 'simple-container-location', anchor: 'lt' },
    })
    const aEntry = runtime('alice/a', aRoot, aEnvironment, bDependencies)
    const host = createBlock('custom-block', { id: 'host-a', packageId: 'alice/a' })
    const result = expandCustomBlocks(documentWith(host), new Map([['alice/a', aEntry]]))
    const expandedA = result.document.faces.front.children[0]?.block
    const expandedB = expandedA?.type === 'simple-container-block' ? expandedA.children[0]?.block : null
    expect(expandedB).toMatchObject({ type: 'image-block', image: 'assets/a-override.png' })
    expect(expandedB && result.resourceScopes.get(projectResourceScopeIdentity(expandedB.id, 'image'))?.rootPath)
      .toBe(aEnvironment.rootPath)
  })

  it('resolves three nested levels lexically instead of using a host package with the same ID', () => {
    const aEnvironment = environment('package', 'alice/a', '/a/resources')
    const bEnvironment = environment('package', 'bob/b', '/a/resources/b/resources')
    const cEnvironment = environment('package', 'carol/c', '/a/resources/b/resources/c/resources')
    const hostBEnvironment = environment('package', 'bob/b-host', '/host/b/resources')

    const cEntry = runtime('carol/c', createBlock('text-block', { id: 'c', content: 'nested-c' }), cEnvironment)
    const cDependencies = new Map([['carol/c', cEntry]])
    const bRoot = createBlock('simple-container-block', { id: 'b' })
    bRoot.children.push({
      block: createBlock('custom-block', { id: 'c-host', packageId: 'carol/c' }),
      location: { id: 'c-location', type: 'simple-container-location', anchor: 'lt' },
    })
    const bEntry = runtime('bob/b', bRoot, bEnvironment, cDependencies)
    const bDependencies = new Map([['bob/b', bEntry]])
    const aRoot = createBlock('simple-container-block', { id: 'a' })
    aRoot.children.push({
      block: createBlock('custom-block', { id: 'b-host', packageId: 'bob/b' }),
      location: { id: 'b-location', type: 'simple-container-location', anchor: 'lt' },
    })
    const aEntry = runtime('alice/a', aRoot, aEnvironment, bDependencies)
    const incompatibleHostB = runtime('bob/b', createBlock('text-block', { id: 'host-b', content: 'wrong-host-version' }), hostBEnvironment)
    const result = expandCustomBlocks(
      documentWith(createBlock('custom-block', { id: 'a-host', packageId: 'alice/a' })),
      new Map([['alice/a', aEntry], ['bob/b', incompatibleHostB]]),
    )
    const expandedA = result.document.faces.front.children[0]?.block
    const expandedB = expandedA?.type === 'simple-container-block' ? expandedA.children[0]?.block : null
    const expandedC = expandedB?.type === 'simple-container-block' ? expandedB.children[0]?.block : null
    expect(expandedC).toMatchObject({ type: 'text-block', content: 'nested-c' })
  })

  it('reports a recursive Package ID cycle', () => {
    const aEnvironment = environment('package', 'alice/a', '/a/resources')
    const aRoot = createBlock('simple-container-block', { id: 'a' })
    aRoot.children.push({
      block: createBlock('custom-block', { id: 'a-again', packageId: 'alice/a' }),
      location: { id: 'cycle-location', type: 'simple-container-location', anchor: 'lt' },
    })
    const dependencies = new Map<string, CustomBlockRuntimeEntry>()
    const entry = runtime('alice/a', aRoot, aEnvironment, dependencies)
    dependencies.set('alice/a', entry)
    const result = expandCustomBlocks(
      documentWith(createBlock('custom-block', { id: 'host', packageId: 'alice/a' })),
      new Map([['alice/a', entry]]),
    )
    expect(result.issues).toEqual([expect.objectContaining({ reason: 'cycle', packageId: 'alice/a' })])
  })
})
