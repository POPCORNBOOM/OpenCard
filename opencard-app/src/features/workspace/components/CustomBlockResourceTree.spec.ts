import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { ProjectCustomBlockResourceCandidate } from '../services/projectCustomBlockResources'
import CustomBlockResourceTree from './CustomBlockResourceTree.vue'

const candidates: ProjectCustomBlockResourceCandidate[] = [
  {
    id: 'image:assets/automatic.png', kind: 'image', path: 'assets/automatic.png', label: 'automatic.png',
    automatic: true, suggested: false, referenceCount: 1, references: ['image.image'],
  },
  {
    id: 'image:assets/suggested.png', kind: 'image', path: 'assets/suggested.png', label: 'suggested.png',
    automatic: false, suggested: true, referenceCount: 1, references: ['image.image'],
  },
  {
    id: 'image:assets/manual.png', kind: 'image', path: 'assets/manual.png', label: 'manual.png',
    automatic: false, suggested: false, referenceCount: 0, references: [],
  },
  {
    id: 'image:assets/missing.png', kind: 'image', path: 'assets/missing.png', label: 'missing.png',
    automatic: true, suggested: false, referenceCount: 1, references: ['image.image'], missing: true,
  },
  {
    id: 'custom-block:bob/child', kind: 'custom-block', path: '.opencard/blocks/bob/child', label: 'Child',
    automatic: true, suggested: false, referenceCount: 1, references: ['child.packageId'], packageId: 'bob/child',
  },
]

function mountTree(selectedIds: string[]) {
  return mount(CustomBlockResourceTree, {
    props: {
      candidates,
      selectedIds,
      ariaLabel: 'Package resources',
      automaticLabel: 'Automatic',
      suggestedLabel: 'Suggested',
      manualLabel: 'Manual',
      excludedLabel: 'Excluded',
      missingLabel: 'Missing',
      nestedLabel: 'Nested',
    },
  })
}

describe('CustomBlockResourceTree', () => {
  it('keeps project paths hierarchical and exposes resource selection states', () => {
    const wrapper = mountTree([
      'image:assets/suggested.png',
      'image:assets/manual.png',
      'image:assets/missing.png',
      'custom-block:bob/child',
    ])
    const rows = wrapper.findAll('[role="treeitem"]')
    expect(rows.map(row => row.text())).toEqual(expect.arrayContaining([
      expect.stringContaining('assets'),
      expect.stringContaining('automatic.pngExcluded'),
      expect.stringContaining('suggested.pngSuggested'),
      expect.stringContaining('manual.pngManual'),
      expect.stringContaining('missing.pngMissing'),
      expect.stringContaining('ChildNested'),
    ]))
    const assetsRow = rows.find(row => row.text() === 'assets')
    expect(assetsRow?.find('input').attributes('aria-checked')).toBe('mixed')
  })

  it('toggles all descendants from a folder without restoring unrelated resources', async () => {
    const wrapper = mountTree(['custom-block:bob/child'])
    const assetsRow = wrapper.findAll('[role="treeitem"]').find(row => row.text() === 'assets')
    if (!assetsRow) throw new Error('Missing assets folder')
    await assetsRow.find('input').setValue(true)
    const emitted = wrapper.emitted('update:selectedIds')?.[0]?.[0]
    expect(emitted).toBeInstanceOf(Set)
    expect([...(emitted as Set<string>)]).toEqual(expect.arrayContaining([
      'custom-block:bob/child',
      'image:assets/automatic.png',
      'image:assets/suggested.png',
      'image:assets/manual.png',
      'image:assets/missing.png',
    ]))
  })
})
