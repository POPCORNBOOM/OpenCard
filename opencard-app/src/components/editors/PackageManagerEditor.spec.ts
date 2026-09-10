import { Fragment, nextTick, ref } from 'vue'
import { flushPromises, mount, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PackageManagerEditor from './PackageManagerEditor.vue'

const storeState = vi.hoisted(() => ({
  packageManifests: new Map<string, unknown>(),
  addRequiredPackages: vi.fn().mockResolvedValue(undefined),
  installResourcePackageFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/fileSystemService', () => ({
  fileSystemService: { pickFile: vi.fn() },
}))
vi.mock('../../features/workspace/store/projectStore', () => ({
  useProjectStore: () => ({
    projectPath: ref('D:/project'),
    projectPackageManifests: ref(storeState.packageManifests),
    projectResourcePackages: ref(new Map()),
    reloadProjectResourceEnvironment: vi.fn().mockResolvedValue(true),
    installResourcePackageFile: storeState.installResourcePackageFile,
    addRequiredPackages: storeState.addRequiredPackages,
    removeResourcePackage: vi.fn().mockResolvedValue(true),
    checkResourcePackage: vi.fn(),
  }),
}))

describe('PackageManagerEditor', () => {
  beforeEach(() => {
    storeState.packageManifests.clear()
    storeState.addRequiredPackages.mockClear()
    storeState.installResourcePackageFile.mockClear()
  })

  it('renders one root node so the workspace transition can animate it', () => {
    const wrapper = shallowMount(PackageManagerEditor, { props: { filePath: 'D:/project/.opencard/packages/packages.json' } })
    expect((wrapper.vm as unknown as { $: { subTree: { type: unknown } } }).$.subTree.type).not.toBe(Fragment)
  })

  async function openRemoteAddDialog(): Promise<ReturnType<typeof mount>> {
    const wrapper = mount(PackageManagerEditor, { props: { filePath: 'D:/project/.opencard/packages/packages.json' }, attachTo: document.body })
    await nextTick()
    expect(wrapper.vm.workspaceActions.map(action => (
      typeof action === 'string' ? action : action.hoverTip
    ))).toEqual([
      'packageManager.sync',
      'packageManager.add',
    ])
    await wrapper.vm.runWorkspaceAction('project-package-manager.add')
    await nextTick()
    findButton('packageManager.remote').click()
    await nextTick()
    expect(document.body.querySelector('textarea')).toBeTruthy()
    return wrapper
  }

  function closeDialog(wrapper: ReturnType<typeof mount>): void {
    wrapper.unmount()
    document.body.innerHTML = ''
  }

  function findButton(label: string): HTMLButtonElement {
    const buttons = [...document.body.querySelectorAll('button')].filter(button => button.textContent?.trim() === label) as HTMLButtonElement[]
    return buttons[buttons.length - 1]!
  }

  async function typeRemoteSource(value: string): Promise<HTMLButtonElement> {
    const textarea = document.body.querySelector('textarea')!
    textarea.value = value
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    return findButton('packageManager.add')
  }

  it('enables the remote Add button for the documented source forms', async () => {
    const wrapper = await openRemoteAddDialog()
    for (const source of ['github:owner/repo@1.0.0', 'owner/repo@1.0', 'https://github.com/owner/repo.git@v0.4.7', 'github:a/b@1.0.0\ngithub:c/d@2.0.0']) {
      expect((await typeRemoteSource(source)).disabled).toBe(false)
    }
    expect((await typeRemoteSource('hello world')).disabled).toBe(true)
    closeDialog(wrapper)
  })

  it('reports an unusable remote source instead of leaving the Add button silently disabled', async () => {
    const wrapper = await openRemoteAddDialog()
    await typeRemoteSource('hello world')
    expect(document.body.querySelector('textarea')!.getAttribute('aria-invalid')).toBe('true')
    expect(document.body.textContent).toContain('packageManager.invalidSource')
    await typeRemoteSource('https://github.com/owner/repo.git@v1.2.3')
    expect(document.body.querySelector('textarea')!.getAttribute('aria-invalid')).toBe('false')
    findButton('packageManager.add').click()
    await flushPromises()
    expect(storeState.addRequiredPackages).toHaveBeenCalledWith([
      { key: 'github-owner-repo-12a029', version: 'v1.2.3', source: 'github:owner/repo' },
    ])
    closeDialog(wrapper)
  })

  it('declares the same identity Key every time a remote source is added', async () => {
    storeState.packageManifests.set('github-alice-my-theme-e7c306', { version: '0.9.0', source: 'github:alice/my-theme' })
    const wrapper = await openRemoteAddDialog()
    await typeRemoteSource('github:alice/my-theme@1.0.0')
    findButton('packageManager.add').click()
    await flushPromises()
    expect(storeState.addRequiredPackages).toHaveBeenCalledWith([
      { key: 'github-alice-my-theme-e7c306', version: '1.0.0', source: 'github:alice/my-theme' },
    ])
    closeDialog(wrapper)
  })

  it('keeps hyphenated sources on distinct Keys even with the same readable prefix', async () => {
    const wrapper = await openRemoteAddDialog()
    await typeRemoteSource('github:xx-xx/theme@1.0.0;github:xx/xx-theme@1.0.0')
    findButton('packageManager.add').click()
    await flushPromises()
    expect(storeState.addRequiredPackages).toHaveBeenCalledWith([
      { key: 'github-xx-xx-theme-7fcaed', version: '1.0.0', source: 'github:xx-xx/theme' },
      { key: 'github-xx-xx-theme-764829', version: '1.0.0', source: 'github:xx/xx-theme' },
    ])
    closeDialog(wrapper)
  })
})
