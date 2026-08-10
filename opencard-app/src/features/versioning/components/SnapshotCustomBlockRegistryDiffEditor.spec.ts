import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import SnapshotCustomBlockRegistryDiffEditor from './SnapshotCustomBlockRegistryDiffEditor.vue'
import ProjectCustomBlockRegistryEditor from '../../../components/editors/ProjectCustomBlockRegistryEditor.vue'

vi.mock('../../../components/editors/ProjectCustomBlockRegistryEditor.vue', () => ({
  default: defineComponent({ name: 'ProjectCustomBlockRegistryEditor', props: [
    'filePath', 'resourceRootPath', 'comparisonResourceRootPath', 'modelValue', 'comparisonContent', 'access',
  ], template: '<div class="registry-editor-stub" />' }),
}))

describe('SnapshotCustomBlockRegistryDiffEditor', () => {
  it('mounts the original registry editor once with current and historical roots', () => {
    const wrapper = mount(SnapshotCustomBlockRegistryDiffEditor, {
      props: {
        historical: { rootPath: 'D:/history', relativePath: '.ocblocks', completeness: 'project', exists: true },
        current: { rootPath: 'D:/current', relativePath: '.ocblocks', completeness: 'project', exists: true },
        comparison: { historicalContent: '{"blocks":[]}', currentContent: '{"blocks":[]}' },
        fileName: '.ocblocks',
        themeId: 'dark',
      },
      global: {
        stubs: {
          ProjectCustomBlockRegistryEditor: true,
        },
      },
    })

    const editors = wrapper.findAllComponents(ProjectCustomBlockRegistryEditor)
    expect(editors).toHaveLength(1)
    expect(editors[0]!.props()).toMatchObject({
      filePath: 'D:/current/.ocblocks',
      resourceRootPath: 'D:/current',
      comparisonResourceRootPath: 'D:/history',
      modelValue: '{"blocks":[]}',
      comparisonContent: '{"blocks":[]}',
      access: 'observe-only',
    })
  })
})
