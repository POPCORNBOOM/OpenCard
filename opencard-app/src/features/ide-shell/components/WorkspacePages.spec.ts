import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import enUS from '../../../locales/en-US'
import ProjectEditorWorkspace from './ProjectEditorWorkspace.vue'
import WelcomeWorkspace from './WelcomeWorkspace.vue'

function mountOptions() {
  return {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
    },
  }
}

describe('workspace pages', () => {
  it('shows the OpenCard welcome page and exposes its project actions', async () => {
    const wrapper = mount(WelcomeWorkspace, mountOptions())

    expect(wrapper.text()).toContain('Welcome to')
    expect(wrapper.get('.workspace-empty-state__wordmark').attributes()).toMatchObject({
      src: '/OpenCard_Icon.png',
      alt: 'OpenCard',
    })
    expect(wrapper.text()).toContain('New Project')
    expect(wrapper.text()).toContain('Open Project Folder')
    expect(wrapper.text()).not.toContain('No editors open')

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(2)
    await buttons[0]?.trigger('click')
    await buttons[1]?.trigger('click')
    expect(wrapper.emitted('new-project')).toHaveLength(1)
    expect(wrapper.emitted('open-project')).toHaveLength(1)
  })

  it('shows the editor placeholder when a project has no active document', () => {
    const wrapper = mount(ProjectEditorWorkspace, {
      props: { hasActiveEditor: false },
      ...mountOptions(),
    })

    expect(wrapper.text()).toContain('No editors open')
  })

  it('renders editor content only for an active document', () => {
    const wrapper = mount(ProjectEditorWorkspace, {
      props: { hasActiveEditor: true },
      slots: { default: '<div data-testid="editor">Editor</div>' },
      ...mountOptions(),
    })

    expect(wrapper.get('[data-testid="editor"]').text()).toBe('Editor')
    expect(wrapper.text()).not.toContain('No editors open')
  })
})
