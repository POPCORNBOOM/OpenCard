import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RESOURCE_PACKAGE_TYPE, type ResourcePackageManifest } from '../../features/workspace/model/resourcePackage'
import PackageManifestEditor from './PackageManifestEditor.vue'
import ProjectRegistryEditorShell from './ProjectRegistryEditorShell.vue'

const manifest: ResourcePackageManifest = {
  type: RESOURCE_PACKAGE_TYPE,
  key: 'theme',
  name: 'Theme Package',
  version: '1.2.3',
  contentHash: '0'.repeat(64),
  public: {
    fonts: [{ key: 'body', title: 'Body' }],
    iconSeries: [{ key: 'actions', title: 'Actions', count: 4 }],
  },
}

const projectResourcePackages = vi.hoisted(() => (
  { value: new Map() } as { value: Map<string, { manifest: unknown }> }
))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (
      params?.count === undefined ? key : `${key}:${String(params.count)}`
    ),
  }),
}))
vi.mock('../../features/workspace/store/projectStore', () => ({
  useProjectStore: () => ({ projectResourcePackages }),
}))

function mountEditor() {
  return mount(PackageManifestEditor, {
    props: { filePath: 'D:/project/.opencard/packages/theme/.opencard/manifest.json' },
  })
}

beforeEach(() => {
  projectResourcePackages.value = new Map([['theme', { manifest }]])
})

describe('PackageManifestEditor', () => {
  it('renders the installed package through its dedicated viewer', () => {
    const wrapper = mountEditor()

    expect(wrapper.vm.presentation?.title).toBe('Theme Package')
    expect(wrapper.vm.presentation?.icon).toBe('file.package')
    expect(wrapper.findComponent(ProjectRegistryEditorShell).exists()).toBe(true)
    expect(wrapper.text()).toContain('1.2.3')
    expect(wrapper.text()).toContain('0000000000000000000000000000000000000000000000000000000000000000')
  })

  it('lists the public fonts and icon series the package provides', () => {
    const wrapper = mountEditor()

    expect(wrapper.findAll('.package-manifest-editor h2').map(node => node.text())).toEqual([
      'packageManifest.information',
      'packageManifest.fonts',
      'packageManifest.iconSeries',
    ])
    expect(wrapper.findAll('.package-manifest-editor__resources > li').map(node => node.text())).toEqual([
      'Bodybody',
      'ActionsactionspackageManifest.iconCount:4',
    ])
  })

  it('explains an empty public resource list instead of rendering nothing', () => {
    projectResourcePackages.value = new Map([['theme', {
      manifest: { ...manifest, public: { fonts: [], iconSeries: [] } },
    }]])

    const wrapper = mountEditor()

    expect(wrapper.text()).toContain('packageManifest.noFonts')
    expect(wrapper.text()).toContain('packageManifest.noIconSeries')
    expect(wrapper.findAll('.package-manifest-editor__resources')).toHaveLength(0)
  })

  it('reports an unavailable package instead of an empty overview', () => {
    projectResourcePackages.value = new Map()

    const wrapper = mountEditor()

    expect(wrapper.text()).toContain('packageManifest.unavailable')
  })
})
