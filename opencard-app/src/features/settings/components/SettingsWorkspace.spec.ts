import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OcSwitch from '../../../components/base/OcSwitch.vue'
import OcSlider from '../../../components/standard/OcSlider.vue'
import OcColorPicker from '../../../components/standard/OcColorPicker.vue'
import OcPhaseImage from '../../../components/standard/OcPhaseImage.vue'
import OcSelect from '../../../components/standard/OcSelect.vue'
import FontFamilyAutocomplete from './FontFamilyAutocomplete.vue'
import SettingsWorkspace from './SettingsWorkspace.vue'

describe('SettingsWorkspace', () => {
  it('emits a setting change from a Switch field', async () => {
    const wrapper = mount(SettingsWorkspace, {
      props: {
        viewModel: {
          key: 'general',
          title: 'General',
          fields: [{
            type: 'switch',
            key: 'updates.suppressReleaseNotesAfterUpdate',
            label: 'Do not show release notes after an update',
            checked: false,
          }],
        },
      },
    })

    await wrapper.getComponent(OcSwitch).get('input').setValue(true)

    expect(wrapper.emitted('intent')).toEqual([[
      {
        type: 'setting.change',
        key: 'updates.suppressReleaseNotesAfterUpdate',
        value: true,
      },
    ]])
  })

  it('returns semantic setting intent without mutating its view model', async () => {
    const viewModel = {
      key: 'appearance' as const,
      title: 'Appearance',
      fields: [{
        type: 'options' as const,
        key: 'appearance.theme' as const,
        label: 'Theme',
        value: 'dark',
        options: [
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
        ],
      }],
    }
    const wrapper = mount(SettingsWorkspace, { props: { viewModel } })

    await wrapper.findAll('[role="radio"]')[1].trigger('click')

    expect(wrapper.emitted('intent')).toEqual([[
      { type: 'setting.change', key: 'appearance.theme', value: 'light' },
    ]])
    expect(viewModel.fields[0].value).toBe('dark')
  })

  it('does not emit a disabled project reset action', async () => {
    const wrapper = mount(SettingsWorkspace, {
      props: {
        viewModel: {
          key: 'workspace',
          title: 'Workspace',
          fields: [{
            type: 'action',
            key: 'project-workspace.reset',
            label: 'Project workspace state',
            actionLabel: 'Reset',
            icon: 'action.restart',
            disabled: true,
          }],
        },
      },
    })

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('intent')).toBeUndefined()
  })

  it('separates range preview from its committed setting change', async () => {
    const wrapper = mount(SettingsWorkspace, {
      props: {
        viewModel: {
          key: 'appearance',
          title: 'Appearance',
          fields: [{
            type: 'range',
            key: 'appearance.glassIntensity',
            label: 'Glass intensity',
            value: 60,
            min: 0,
            max: 100,
            step: 1,
            suffix: '%',
          }],
        },
      },
    })

    wrapper.getComponent(OcSlider).vm.$emit('preview', 42)
    wrapper.getComponent(OcSlider).vm.$emit('commit', 42)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('intent')).toEqual([
      [{ type: 'setting.preview', key: 'appearance.glassIntensity', value: 42 }],
      [{ type: 'setting.change', key: 'appearance.glassIntensity', value: 42 }],
    ])
  })

  it('renders a flat theme color panel and emits semantic color intents', async () => {
    const wrapper = mount(SettingsWorkspace, {
      props: {
        viewModel: {
          key: 'appearance',
          title: 'Appearance',
          fields: [{
            type: 'theme-color-panel',
            key: 'appearance.darkThemeColors',
            label: 'Dark theme',
            themeId: 'dark',
            preset: {
              label: 'Preset',
              value: 'user:Forest',
              placeholder: 'Select preset',
              options: [
                { value: 'default', label: 'OpenCard' },
                { value: 'user:Forest', label: 'Forest · Imported' },
              ],
              importLabel: 'Import theme',
              exportLabel: 'Export theme',
              deleteLabel: 'Delete imported theme',
              canDelete: true,
            },
            accentNeighborAngle: {
              label: 'Secondary color phase angle',
              value: -72,
              min: -180,
              max: 180,
              step: 1,
              suffix: '°',
            },
            fontFamily: {
              label: 'UI font',
              value: 'system',
              fontFamilies: ['Inter', 'Microsoft YaHei UI'],
              placeholder: 'System default',
            },
            colors: [
              { key: 'accentColor', label: 'Accent', token: '--oc-accent', value: '#111111', overrideValue: null },
              { key: 'baseBackgroundColor', label: 'Application background', token: '--oc-bg-base', value: '#222222', overrideValue: '#222222' },
            ],
          }],
        },
      },
    })

    const pickers = wrapper.findAllComponents(OcColorPicker)
    expect(pickers).toHaveLength(2)
    expect(pickers.every(picker => picker.props('variant') === 'field')).toBe(true)
    expect(wrapper.get('.settings-workspace__color-panel-header').text()).toBe('Dark theme')
    expect(wrapper.findAll('.settings-workspace__color-row')).toHaveLength(5)
    const selects = wrapper.findAllComponents(OcSelect)
    expect(selects[0]!.props('modelValue')).toBe('user:Forest')
    expect(wrapper.getComponent(FontFamilyAutocomplete).props('modelValue')).toBe('system')
    expect(wrapper.getComponent(OcSlider).props('modelValue')).toBe(-72)

    pickers[0]!.vm.$emit('open-change', true)
    pickers[0]!.vm.$emit('preview', '#223344')
    pickers[0]!.vm.$emit('cancel')
    pickers[0]!.vm.$emit('commit', '#334455')
    wrapper.getComponent(OcSlider).vm.$emit('preview', -80)
    wrapper.getComponent(OcSlider).vm.$emit('commit', -80)
    selects[0]!.vm.$emit('update:modelValue', 'default')
    wrapper.getComponent(FontFamilyAutocomplete).vm.$emit('commit', 'Inter; Microsoft YaHei UI')
    await wrapper.get('button[aria-label="Import theme"]').trigger('click')
    await wrapper.get('button[aria-label="Export theme"]').trigger('click')
    await wrapper.get('button[aria-label="Delete imported theme"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('intent')).toEqual([
      [{ type: 'theme-color.preview', themeId: 'dark', token: '--oc-accent', value: '#223344' }],
      [{ type: 'theme-color.cancel', themeId: 'dark', token: '--oc-accent', value: null }],
      [{ type: 'theme-color.change', themeId: 'dark', token: '--oc-accent', value: '#334455' }],
      [{ type: 'theme-angle.preview', themeId: 'dark', value: -80 }],
      [{ type: 'theme-angle.change', themeId: 'dark', value: -80 }],
      [{ type: 'theme-preset.change', themeId: 'dark', presetId: 'default' }],
      [{ type: 'theme-font.change', themeId: 'dark', value: 'Inter; Microsoft YaHei UI' }],
      [{ type: 'theme.import', themeId: 'dark' }],
      [{ type: 'theme.export', themeId: 'dark' }],
      [{ type: 'theme-preset.delete', themeId: 'dark', presetId: 'user:Forest' }],
    ])
  })

  it('renders the appearance preview and shrinks it between semantic height tiers', async () => {
    const observe = vi.fn()
    let resizeCallback: ResizeObserverCallback = () => undefined
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resizeCallback = callback }
      observe = observe
      disconnect = vi.fn()
    })
    const wrapper = mount(SettingsWorkspace, {
      props: {
        viewModel: {
          key: 'appearance',
          title: 'Appearance',
          preview: { glassIntensity: 72 },
          fields: [],
        },
      },
    })

    expect(wrapper.find('.settings-workspace__preview-glass').exists()).toBe(true)
    expect(wrapper.findAll('.settings-workspace__preview-editor > .settings-workspace__preview-panel')).toHaveLength(2)
    expect(wrapper.findAll('.settings-workspace__preview-window-dots i')).toHaveLength(3)
    const sidebarLogo = wrapper.getComponent(OcPhaseImage)
    expect(sidebarLogo.classes()).toContain('settings-workspace__preview-sidebar-logo')
    expect(sidebarLogo.props('src')).toContain('opencard-logo-phase-map')
    expect(sidebarLogo.props('durationMs')).toBe(12_000)
    expect(sidebarLogo.props('direction')).toBe('reverse')
    expect(sidebarLogo.element.closest('.settings-workspace__preview-sidebar')).not.toBeNull()
    expect(wrapper.findAll('.settings-workspace__preview-card-corner')).toHaveLength(2)
    expect(wrapper.findAll('.settings-workspace__preview-card-pips i')).toHaveLength(7)
    expect(wrapper.find('.settings-workspace__preview-document').text()).toContain('7')
    expect(wrapper.find('.settings-workspace__preview-document').text()).toContain('♣')
    expect(wrapper.find('.settings-workspace__preview-titlebar .appearance-shader').exists()).toBe(true)
    expect(wrapper.find('.settings-workspace__preview-editor .appearance-shader--dot-noise').exists()).toBe(true)
    expect(wrapper.find('.settings-workspace__preview-canvas .appearance-shader').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('sample.ocdocument')
    expect(wrapper.text()).not.toContain('属性')

    const workspace = wrapper.get<HTMLElement>('.settings-workspace')
    expect(observe).toHaveBeenCalledWith(workspace.element)
    workspace.element.style.setProperty('--oc-settings-preview-height-lg', '360px')
    workspace.element.style.setProperty('--oc-settings-preview-height-md', '240px')
    workspace.element.style.setProperty('--oc-settings-preview-shrink-distance', '240px')
    workspace.element.style.setProperty('--oc-settings-preview-glass-opacity-min', '0')
    workspace.element.style.setProperty('--oc-settings-preview-glass-opacity-max', '1')
    const preview = wrapper.get<HTMLElement>('.settings-workspace__preview')
    const previewGlass = wrapper.get<HTMLElement>('.settings-workspace__preview-glass')
    const previewSurface = wrapper.get<HTMLElement>('.settings-workspace__preview-surface')
    const previewStage = wrapper.get<HTMLElement>('.settings-workspace__preview-stage')
    const previewSpacer = wrapper.get<HTMLElement>('.settings-workspace__preview-spacer')
    Object.defineProperty(preview.element, 'offsetHeight', { configurable: true, value: 360 })
    resizeCallback([], {} as ResizeObserver)
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

    workspace.element.scrollTop = 0
    await workspace.trigger('scroll')
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    expect(Number.parseFloat(preview.element.style.maxWidth)).toBeCloseTo(640)
    expect(previewGlass.element.style.height).toBe('360px')
    expect(previewSurface.element.style.height).toBe('360px')
    expect(previewSpacer.element.style.height).toBe('360px')
    expect(previewStage.element.style.height).toBe('')
    expect(previewStage.element.style.getPropertyValue('--settings-preview-scale')).toBe('1')
    expect(previewStage.element.style.getPropertyValue('--settings-preview-glass-opacity')).toBe('0')

    workspace.element.scrollTop = 120
    await workspace.trigger('scroll')
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    expect(previewSurface.element.style.height).toBe('360px')
    expect(previewGlass.element.style.height).toBe('360px')
    expect(previewSpacer.element.style.height).toBe('360px')
    expect(Number.parseFloat(previewStage.element.style.getPropertyValue('--settings-preview-scale')))
      .toBeCloseTo(5 / 6)
    expect(previewStage.element.style.getPropertyValue('--settings-preview-glass-opacity')).toBe('0.5')

    workspace.element.scrollTop = 480
    await workspace.trigger('scroll')
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    expect(previewSurface.element.style.height).toBe('360px')
    expect(previewGlass.element.style.height).toBe('360px')
    expect(previewSpacer.element.style.height).toBe('360px')
    expect(Number.parseFloat(preview.element.style.maxWidth)).toBeCloseTo(640)
    expect(previewStage.element.style.getPropertyValue('--settings-preview-glass-opacity')).toBe('1')
    wrapper.unmount()
    vi.unstubAllGlobals()
  })
})
