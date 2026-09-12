import { Fragment, computed, nextTick, ref } from 'vue'
import { flushPromises, mount, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShellAction } from '../../features/shell/shell.types'
import { useShellProgressTasks } from '../../features/shell/composables/useShellProgressTasks'
import PackageManagerEditor from './PackageManagerEditor.vue'
import OcEmpty from '../base/OcEmpty.vue'
import OcOptionGroup from '../standard/OcOptionGroup.vue'
import OcTree from '../standard/OcTree.vue'
import OcAlbum from '../standard/OcAlbum.vue'

const storeState = vi.hoisted(() => ({
  packageManifests: new Map<string, unknown>(),
  addRequiredPackages: vi.fn().mockResolvedValue(undefined),
  installResourcePackageFile: vi.fn().mockResolvedValue(undefined),
}))
const fileSystem = vi.hoisted(() => ({ pickFile: vi.fn() }))
const notifications = vi.hoisted(() => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/fileSystemService', () => ({ fileSystemService: fileSystem }))
vi.mock('../../features/notifications/titlebarNotices', () => notifications)
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

vi.mock('../../features/settings/store/appSettingsStore', () => {
  const view = ref('tree')
  return {
    useAppSettingsStore: () => ({
      settings: computed(() => ({ workspace: { packageManagerView: view.value } })),
      updateSetting: (key: string, value: unknown) => {
        if (key === 'workspace.packageManagerView') view.value = String(value)
      },
    }),
  }
})

describe('PackageManagerEditor', () => {
  beforeEach(() => {
    storeState.packageManifests.clear()
    storeState.addRequiredPackages.mockClear()
    storeState.installResourcePackageFile.mockClear()
    fileSystem.pickFile.mockReset()
    notifications.notifySuccess.mockClear()
    notifications.notifyError.mockClear()
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
      'packageManager.switchView',
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

  function shellTaskKeys(): readonly string[] {
    return useShellProgressTasks().tasks.value.map(task => task.key)
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

  it('closes the Add dialog and finishes a local install on the global progress bar', async () => {
    let finishInstall: () => void = () => {}
    storeState.installResourcePackageFile.mockReturnValueOnce(new Promise<void>(resolve => { finishInstall = resolve }))
    fileSystem.pickFile.mockResolvedValue('D:/packages/theme.ocpack')
    const wrapper = mount(PackageManagerEditor, {
      props: { filePath: 'D:/project/.opencard/packages/packages.json' },
      attachTo: document.body,
    })
    await nextTick()
    await wrapper.vm.runWorkspaceAction('project-package-manager.add')
    await nextTick()
    findButton('packageManager.choosePackages').click()
    await flushPromises()

    findButton('packageManager.add').click()
    await nextTick()

    // The install owns the global progress bar, so the workspace is not frozen behind the dialog.
    expect(document.body.textContent).not.toContain('packageManager.choosePackages')
    expect(shellTaskKeys()).toContain('package-manager-add')

    finishInstall()
    await flushPromises()

    expect(notifications.notifySuccess).toHaveBeenCalledWith('packageManager.added')
    expect(shellTaskKeys()).not.toContain('package-manager-add')
    closeDialog(wrapper)
  })

  it('keeps the chosen package files when an add fails, so it can be retried', async () => {
    storeState.installResourcePackageFile.mockRejectedValueOnce(new Error('broken archive'))
    fileSystem.pickFile.mockResolvedValue('D:/packages/theme.ocpack')
    const wrapper = mount(PackageManagerEditor, {
      props: { filePath: 'D:/project/.opencard/packages/packages.json' },
      attachTo: document.body,
    })
    await nextTick()
    await wrapper.vm.runWorkspaceAction('project-package-manager.add')
    await nextTick()
    findButton('packageManager.choosePackages').click()
    await flushPromises()

    findButton('packageManager.add').click()
    await flushPromises()

    expect(notifications.notifyError).toHaveBeenCalledWith('packageManager.addFailed')
    expect(shellTaskKeys()).not.toContain('package-manager-add')

    // Reopening still shows the same files, so the user does not have to pick them again.
    await wrapper.vm.runWorkspaceAction('project-package-manager.add')
    await nextTick()
    expect(document.body.textContent).toContain('packageManager.selectedFiles')
    closeDialog(wrapper)
  })

  it('switches between the tree and the album through the exposed workspace action', async () => {
    storeState.packageManifests.set('theme', { version: '1.0.0' })
    const wrapper = mount(PackageManagerEditor, {
      props: { filePath: 'D:/project/.opencard/packages/packages.json' },
    })
    await nextTick()

    const viewAction = () => wrapper.vm.workspaceActions.find(action => (
      typeof action !== 'string' && action.key === 'project-package-manager.toggle-view'
    )) as ShellAction | undefined
    // The icon and tip point at the view the action switches to, and nothing else renders a view switch.
    expect(viewAction()).toMatchObject({ icon: 'layout.columns', disabled: false })

    expect(wrapper.findComponent(OcTree).exists()).toBe(true)
    expect(wrapper.findComponent(OcAlbum).exists()).toBe(false)
    expect(wrapper.findComponent(OcOptionGroup).exists()).toBe(false)

    await wrapper.vm.runWorkspaceAction('project-package-manager.toggle-view')
    await nextTick()

    expect(wrapper.findComponent(OcTree).exists()).toBe(false)
    expect(viewAction()).toMatchObject({ icon: 'data.list-tree' })
    const album = wrapper.getComponent(OcAlbum)
    expect(album.props('data').rootKeys).toEqual(['theme'])
    expect(album.props('data').items.get('theme')?.label).toBe('theme@1.0.0')

    await wrapper.vm.runWorkspaceAction('project-package-manager.toggle-view')
    await nextTick()
    expect(wrapper.findComponent(OcTree).exists()).toBe(true)

    wrapper.unmount()
  })

  it('disables the view action while the project declares no packages', async () => {
    const wrapper = mount(PackageManagerEditor, {
      props: { filePath: 'D:/project/.opencard/packages/packages.json' },
    })
    await nextTick()

    expect(wrapper.findComponent(OcEmpty).exists()).toBe(true)
    expect(wrapper.vm.workspaceActions.find(action => (
      typeof action !== 'string' && action.key === 'project-package-manager.toggle-view'
    ))).toMatchObject({ disabled: true })

    wrapper.unmount()
  })
})
