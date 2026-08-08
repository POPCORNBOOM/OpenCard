import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SnapshotResourceDiffEditor from './SnapshotResourceDiffEditor.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('../../../components/editors/ImagePreviewEditor.vue', () => ({
  default: {
    props: ['filePath', 'viewportTransform', 'pixelated'],
    emits: ['update-viewport-transform', 'update:pixelated'],
    template: '<button class="image-stub" @click="$emit(\'update-viewport-transform\', { x: 4, y: 5, scale: 2 })">{{ filePath }}|{{ viewportTransform.scale }}|{{ pixelated }}</button>',
  },
}))
vi.mock('../../../components/editors/FontPreviewEditor.vue', () => ({
  default: {
    props: ['filePath', 'fontPreviewText'],
    emits: ['update-font-preview-text'],
    template: '<button class="font-stub" @click="$emit(\'update-font-preview-text\', \'shared sample\')">{{ filePath }}|{{ fontPreviewText }}</button>',
  },
}))

const historical = {
  rootPath: 'D:/historical',
  relativePath: 'assets/example.png',
  completeness: 'project' as const,
  exists: true,
}
const current = {
  rootPath: 'D:/current',
  relativePath: 'assets/example.png',
  completeness: 'project' as const,
  exists: true,
}

describe('SnapshotResourceDiffEditor', () => {
  it('renders the two immutable image paths and shares the viewport transform', async () => {
    const wrapper = mount(SnapshotResourceDiffEditor, {
      props: { historical, current, kind: 'image', fileName: 'example.png' },
    })
    const previews = wrapper.findAll('.image-stub')
    expect(previews.map(preview => preview.text())).toEqual([
      'D:/historical/assets/example.png|1|false',
      'D:/current/assets/example.png|1|false',
    ])

    await previews[0]!.trigger('click')
    expect(wrapper.findAll('.image-stub').map(preview => preview.text())).toEqual([
      'D:/historical/assets/example.png|2|false',
      'D:/current/assets/example.png|2|false',
    ])
  })

  it('keeps a missing side neutral and shares font specimen text', async () => {
    const wrapper = mount(SnapshotResourceDiffEditor, {
      props: {
        historical: { ...historical, relativePath: 'fonts/example.ttf', exists: false },
        current: { ...current, relativePath: 'fonts/example.ttf' },
        kind: 'font',
        fileName: 'example.ttf',
      },
    })
    expect(wrapper.text()).toContain('versioning.diff.missing')
    expect(wrapper.findAll('.font-stub')).toHaveLength(1)

    await wrapper.get('.font-stub').trigger('click')
    expect(wrapper.get('.font-stub').text()).toContain('shared sample')
  })
})
