import { describe, expect, it } from 'vitest'
import {
  findActiveBindingToken,
  parseBindingScopeToken,
  parseFieldReference,
} from './bindingExpression'

describe('binding expression grammar', () => {
  it('parses fixed and arbitrary parent scopes', () => {
    expect(parseBindingScopeToken('S')).toEqual({ kind: 'current-block' })
    expect(parseBindingScopeToken('p.p.p')).toEqual({ kind: 'parent', parentDepth: 3 })
    expect(parseFieldReference('p.p:width')).toEqual({
      kind: 'parent',
      parentDepth: 2,
      fieldKey: 'width',
    })
  })

  it('finds only the binding token containing the cursor', () => {
    expect(findActiveBindingToken('Value {{p.p:wi}}', 14)).toEqual({
      body: 'p.p:wi',
      bodyStart: 8,
      cursor: 14,
    })
    expect(findActiveBindingToken('Value {{done}} tail', 19)).toBeNull()
  })
})
