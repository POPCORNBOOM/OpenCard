import { Fragment, ref } from 'vue'
import { shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PackageManagerEditor from './PackageManagerEditor.vue'

const storeState = vi.hoisted(() => ({ packageManifests: new Map<string, unknown>() }))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/fileSystemService', () => ({
  fileSystemService: { pickFile: vi.fn() },
}))
vi.mock('../../features/workspace/store/projectStore', () => ({
  useProjectStore: () => ({
    projectPath: ref('D:/project'),
    projectPackageManifests: ref(storeState.packageManifests),
    reloadProjectResourceEnvironment: vi.fn().mockResolvedValue(true),
    installResourcePackageFile: vi.fn(),
  }),
}))

describe('PackageManagerEditor', () => {
  beforeEach(() => {
    storeState.packageManifests.clear()
  })

  it('renders one root node so the workspace transition can animate it', () => {
    const wrapper = shallowMount(PackageManagerEditor, { props: { filePath: 'D:/project/.opencard/packages/packages.json' } })
    expect((wrapper.vm as unknown as { $: { subTree: { type: unknown } } }).$.subTree.type).not.toBe(Fragment)
  })

})
