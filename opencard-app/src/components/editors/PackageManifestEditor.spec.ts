import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
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

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/store/projectStore', () => ({
  useProjectStore: () => ({ projectResourcePackages: ref(new Map([['theme', { manifest }]])) }),
}))

describe('PackageManifestEditor', () => {
  it('renders the installed package through its dedicated viewer', () => {
    const wrapper = mount(PackageManifestEditor, {
      props: { filePath: 'D:/project/.opencard/packages/theme/.opencard/manifest.json' },
    })

    expect(wrapper.getComponent(ProjectRegistryEditorShell).props('heading')).toBe('Theme Package')
    expect(wrapper.text()).toContain('1.2.3')
    expect(wrapper.text()).toContain('0000000000000000000000000000000000000000000000000000000000000000')
  })
})
