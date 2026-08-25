import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { ProjectCustomBlockResourceCandidate } from '../services/projectCustomBlockResources'
import OcTree from '../../../components/standard/OcTree.vue'
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
    automatic: true, suggested: false, referenceCount: 1, references: ['child.blockKey'], blockKey: 'bob/child',
  },
  {
    id: 'font:brand', kind: 'font', path: '.opencard/fonts/Brand.otf', label: 'Brand.otf',
    automatic: false, suggested: false, referenceCount: 0, references: [], fontKey: 'brand',
  },
  {
    id: 'icon:suits', kind: 'icon', path: '.opencard/icons/suits.png', label: 'Suits',
    automatic: false, suggested: false, referenceCount: 0, references: [], iconSeriesKey: 'suits',
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
      fontLabel: 'Fonts',
      iconLabel: 'Icons',
      packageLabel: 'Packages',
      imageLabel: 'Images',
      selectLabel: 'Select',
      deselectLabel: 'Deselect',
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
    const tree = wrapper.getComponent(OcTree)
    expect(tree.props('data').items.get('resource:path:image:assets')?.actions).toEqual(['resource.select'])
    expect(tree.props('actions')?.get('resource.select')).toEqual({ title: 'Select', icon: 'action.checkbox-blank' })
    expect(tree.props('actions')?.get('resource.deselect')).toEqual({ title: 'Deselect', icon: 'action.checkbox-marked' })
    expect(tree.props('data').items.get('font:brand')).toMatchObject({ icon: 'file.font', iconTone: 'active' })
    expect(tree.props('data').items.get('icon:suits')).toMatchObject({ icon: 'file.image', iconTone: 'image' })
    expect(tree.props('data').items.get('custom-block:bob/child')).toMatchObject({ icon: 'file.custom-block', iconTone: 'folder-open' })
  })

  it('keeps all package resource categories visible and aligned with project tree presentation', () => {
    const tree = mountTree([]).getComponent(OcTree)
    expect(tree.props('data').items.get('resource:category:font')).toMatchObject({ icon: 'file.font', iconTone: 'config' })
    expect(tree.props('data').items.get('resource:category:icon')).toMatchObject({ icon: 'file.project-icon', iconTone: 'config' })
    expect(tree.props('data').items.get('resource:category:custom-block')).toMatchObject({ icon: 'file.custom-block', iconTone: 'config' })
    expect(tree.props('data').items.get('resource:category:image')).toMatchObject({ icon: 'folder.open', iconTone: 'folder-open' })
    expect(tree.props('data').rootKeys).toEqual([
      'resource:category:font', 'resource:category:icon',
      'resource:category:custom-block', 'resource:category:image',
    ])
    expect(tree.props('data').rootKeys.map((key: string) => tree.props('data').items.get(key)?.label))
      .toEqual(['Fonts', 'Icons', 'Packages', 'Images'])
  })

  it('toggles all descendants from a folder without restoring unrelated resources', async () => {
    const wrapper = mountTree(['custom-block:bob/child'])
    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'action.invoke', key: 'resource:path:image:assets', actionKey: 'resource.select', source: 'inline',
    })
    await wrapper.vm.$nextTick()
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
