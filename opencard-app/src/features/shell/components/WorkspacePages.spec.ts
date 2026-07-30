import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import enUS from '../../../locales/en-US'
import OcPhaseImage from '../../../components/standard/OcPhaseImage.vue'
import WorkbenchWorkspace from './WorkbenchWorkspace.vue'
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
    const phaseImages = wrapper.findAllComponents(OcPhaseImage)
    expect(phaseImages).toHaveLength(2)
    expect(phaseImages[1]!.classes()).toContain('workspace-empty-state__wordmark')
    expect(phaseImages[1]!.props('alt')).toBe('OpenCard')
    expect(phaseImages[1]!.props('direction')).toBe('reverse')
    expect(phaseImages.every(image => image.props('fit') === 'contain')).toBe(true)
    expect(phaseImages[1]!.props('src')).toContain('opencard-wordmark-phase-map')
    expect(phaseImages[1]!.props('brightnessSrc')).toContain('opencard-wordmark-brightness-map')
    expect(wrapper.find('img').exists()).toBe(false)
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

  it('shows the editor placeholder when the workbench has no active document', () => {
    const wrapper = mount(WorkbenchWorkspace, {
      props: { hasActiveEditor: false },
      ...mountOptions(),
    })

    expect(wrapper.text()).toContain('No editors open')
  })

  it('renders editor content only for an active document', () => {
    const wrapper = mount(WorkbenchWorkspace, {
      props: { hasActiveEditor: true },
      slots: { default: '<div data-testid="editor">Editor</div>' },
      ...mountOptions(),
    })

    expect(wrapper.get('[data-testid="editor"]').text()).toBe('Editor')
    expect(wrapper.text()).not.toContain('No editors open')
  })
})
