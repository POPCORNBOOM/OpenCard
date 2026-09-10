import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OcTree from '../../../components/standard/OcTree.vue'
import type { OcTreeData } from '../../../shared/ui/tree/tree.types'
import type { AppSettings, ProjectWorkspaceState } from '../../settings/model/appSettings'
import ResourcePackageBuilderDialog from './ResourcePackageBuilderDialog.vue'

const buildPackage = vi.hoisted(() => vi.fn(async () => ({ outputPath: '/output/theme.ocpack' })))
const pickSavePath = vi.hoisted(() => vi.fn(async () => '/output/theme.ocpack'))

const projectStore = vi.hoisted(() => ({
  projectFontFamilies: { value: [
    { key: 'latin', name: 'Latin', files: { normal: { upright: 'fonts/latin.ttf' } } },
    { key: 'cjk', name: 'CJK', files: { normal: { upright: 'fonts/cjk.ttf' } } },
  ] },
  projectFontCompositions: { value: [
    { key: 'body', name: 'Body', members: [{ fontKey: 'latin' }, { fontKey: 'cjk' }] },
  ] },
  projectIconSeries: { value: [
    { key: 'status', name: 'Status', source: 'icons/status.png', icons: [] },
  ] },
}))

const settings = vi.hoisted(() => ({
  value: {
    identity: { publisherKey: 'publisher-test' },
    projectCreation: { workspaceStates: {} as Record<string, ProjectWorkspaceState> },
  } as unknown as AppSettings,
}))
const updateSetting = vi.hoisted(() => vi.fn())
const updateProjectCreation = vi.hoisted(() => vi.fn((patch: { workspaceStates?: Record<string, ProjectWorkspaceState> }) => {
  if (patch.workspaceStates) settings.value.projectCreation.workspaceStates = patch.workspaceStates
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../store/projectStore', () => ({ useProjectStore: () => projectStore }))
vi.mock('../../settings/store/appSettingsStore', () => ({
  useAppSettingsStore: () => ({ settings, updateSetting, updateProjectCreation }),
}))
vi.mock('../services/buildResourcePackage', () => ({ buildResourcePackageFromProject: buildPackage }))
vi.mock('../services/fileSystemService', () => ({ fileSystemService: { pickSavePath } }))

const imageEntries = [
  'images/card.png', 'images/nested/banner.svg', 'images/notes.txt',
  '.opencard/icons/status.png', '.git/logo.png', '/outside/leak.png',
]

function mountBuilder(entries: readonly string[] = [], projectRootPath = '/project') {
  return mount(ResourcePackageBuilderDialog, {
    props: { open: true, projectRootPath, projectName: 'Project', entries },
    global: { stubs: { Teleport: true } },
  })
}

function actionsOf(data: OcTreeData, key: string): readonly string[] | undefined {
  return data.items.get(key)?.actions
}

beforeEach(() => {
  settings.value.projectCreation.workspaceStates = {}
  updateSetting.mockClear()
  updateProjectCreation.mockClear()
  pickSavePath.mockClear()
  buildPackage.mockClear()
})

describe('ResourcePackageBuilderDialog selection', () => {
  it('keeps public font and composition selections independent and selects everything by default', async () => {
    const wrapper = mountBuilder()
    const tree = wrapper.findComponent(OcTree)
    let data = tree.props('data') as OcTreeData
    expect(data.children.get('category:fonts')).toEqual(['font-group:families', 'font-group:compositions'])
    expect(actionsOf(data, 'font-family:latin')).toEqual(['deselect'])
    expect(actionsOf(data, 'font-family:cjk')).toEqual(['deselect'])
    expect(actionsOf(data, 'font-composition:body')).toEqual(['deselect'])
    expect(actionsOf(data, 'icon-series:status')).toEqual(['deselect'])

    tree.vm.$emit('intent', { type: 'action.invoke', key: 'font-composition:body', actionKey: 'deselect' })
    tree.vm.$emit('intent', { type: 'action.invoke', key: 'font-family:cjk', actionKey: 'deselect' })
    await nextTick()
    data = tree.props('data') as OcTreeData
    expect(actionsOf(data, 'font-composition:body')).toEqual(['select'])
    expect(actionsOf(data, 'font-family:cjk')).toEqual(['select'])
    expect(actionsOf(data, 'font-family:latin')).toEqual(['deselect'])

    tree.vm.$emit('intent', { type: 'action.invoke', key: 'font-family:cjk', actionKey: 'select' })
    await nextTick()
    data = tree.props('data') as OcTreeData
    expect(actionsOf(data, 'font-composition:body')).toEqual(['select'])
    expect(actionsOf(data, 'font-family:cjk')).toEqual(['deselect'])
  })

  it('selects project icon series without exposing spritesheet files', async () => {
    const wrapper = mountBuilder()
    const tree = wrapper.findComponent(OcTree)
    let data = tree.props('data') as OcTreeData
    expect(data.children.get('category:icons')).toEqual(['icon-series:status'])
    expect(data.items.get('category:icons')?.tail).toBeUndefined()
    expect([...data.items.keys()].some(key => key.includes('status.png'))).toBe(false)

    tree.vm.$emit('intent', { type: 'action.invoke', key: 'icon-series:status', actionKey: 'deselect' })
    await nextTick()
    data = tree.props('data') as OcTreeData
    expect(actionsOf(data, 'icon-series:status')).toEqual(['select'])

    tree.vm.$emit('intent', { type: 'action.invoke', key: 'icon-series:status', actionKey: 'select' })
    await nextTick()
    expect(actionsOf(tree.props('data') as OcTreeData, 'icon-series:status')).toEqual(['deselect'])
  })

  it('shows project images by directory without paths or counts and builds from the selection', async () => {
    const wrapper = mountBuilder(imageEntries)
    const tree = wrapper.findComponent(OcTree)
    let data = tree.props('data') as OcTreeData

    expect(data.children.get('category:images')).toEqual(['folder:images:images'])
    expect(data.children.get('folder:images:images')).toEqual([
      'image:images/card.png', 'folder:images:images/nested',
    ])
    expect(data.items.has('image:images/nested/banner.svg')).toBe(true)
    expect([...data.items.keys()].some(key => key.includes('notes.txt') || key.includes('.opencard')
      || key.includes('.git') || key.includes('outside'))).toBe(false)
    expect(data.items.get('category:images')?.tail).toBeUndefined()
    expect(data.items.get('image:images/card.png')?.tail).toBeUndefined()
    expect(data.items.get('image:images/card.png')?.actions).toEqual(['deselect'])

    tree.vm.$emit('intent', { type: 'action.invoke', key: 'image:images/card.png', actionKey: 'deselect' })
    await nextTick()
    tree.vm.$emit('intent', { type: 'action.invoke', key: 'image:images/nested/banner.svg', actionKey: 'deselect' })
    await nextTick()
    data = tree.props('data') as OcTreeData
    expect(data.items.get('image:images/card.png')?.actions).toEqual(['select'])

    tree.vm.$emit('intent', { type: 'action.invoke', key: 'image:images/card.png', actionKey: 'select' })
    await nextTick()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(buildPackage).toHaveBeenCalledWith(expect.objectContaining({
      key: 'local-publisher-test-project-09d226',
      imageSelection: { paths: ['images/card.png'] },
    }))
  })

  it('restores the previous build and falls back to every candidate when nothing was remembered', async () => {
    settings.value.projectCreation.workspaceStates = {
      '/other': { expandedDirectories: [] },
      '/project': {
        expandedDirectories: [],
        packageBuilder: {
          name: 'Theme',
          version: '2.1.0',
          fontFamilyKeys: ['cjk'],
          fontCompositionKeys: [],
          iconSeriesKeys: [],
          imagePaths: ['images/nested/banner.svg'],
        },
      },
    }
    const wrapper = mountBuilder(imageEntries)
    const tree = wrapper.findComponent(OcTree)
    const data = tree.props('data') as OcTreeData

    expect(actionsOf(data, 'font-family:latin')).toEqual(['select'])
    expect(actionsOf(data, 'font-family:cjk')).toEqual(['deselect'])
    expect(actionsOf(data, 'font-composition:body')).toEqual(['select'])
    expect(actionsOf(data, 'icon-series:status')).toEqual(['select'])
    expect(actionsOf(data, 'image:images/nested/banner.svg')).toEqual(['deselect'])
    expect(actionsOf(data, 'image:images/card.png')).toEqual(['select'])

    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(buildPackage).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Theme',
      version: '2.1.0',
      imageSelection: { paths: ['images/nested/banner.svg'] },
      fontSelection: { familyKeys: ['cjk'], compositionKeys: [] },
      iconSelection: { seriesKeys: [] },
    }))
  })

  it('remembers the build inputs for the project and restores them on reopen', async () => {
    const wrapper = mountBuilder(imageEntries)
    const tree = wrapper.findComponent(OcTree)
    tree.vm.$emit('intent', { type: 'action.invoke', key: 'image:images/card.png', actionKey: 'deselect' })
    await nextTick()
    tree.vm.$emit('intent', { type: 'action.invoke', key: 'font-family:latin', actionKey: 'deselect' })
    await nextTick()
    tree.vm.$emit('intent', { type: 'action.invoke', key: 'font-composition:body', actionKey: 'deselect' })
    await nextTick()
    tree.vm.$emit('intent', { type: 'action.invoke', key: 'icon-series:status', actionKey: 'deselect' })
    await nextTick()
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const currentStates = settings.value.projectCreation.workspaceStates
    expect(updateProjectCreation).toHaveBeenCalledTimes(1)
    expect(currentStates['/project']?.packageBuilder).toEqual({
      name: 'Project',
      version: '1.0.0',
      fontFamilyKeys: ['cjk'],
      fontCompositionKeys: [],
      iconSeriesKeys: [],
      imagePaths: ['images/nested/banner.svg'],
    })

    const reopened = mountBuilder(imageEntries)
    const reopenedTree = reopened.findComponent(OcTree)
    const data = reopenedTree.props('data') as OcTreeData
    expect(actionsOf(data, 'font-family:latin')).toEqual(['select'])
    expect(actionsOf(data, 'font-family:cjk')).toEqual(['deselect'])
    expect(actionsOf(data, 'image:images/card.png')).toEqual(['select'])
    expect(actionsOf(data, 'image:images/nested/banner.svg')).toEqual(['deselect'])
  })
})
