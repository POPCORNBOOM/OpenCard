import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcShortcut from './OcShortcut.vue'
import type { OcShortcutPart } from './OcShortcut.vue'

function mountParts(parts: readonly OcShortcutPart[], decorative?: boolean) {
  return mount(OcShortcut, { props: { parts, decorative } })
}

function childElements(wrapper: ReturnType<typeof mountParts>): HTMLElement[] {
  return Array.from(wrapper.element.children) as HTMLElement[]
}

describe('OcShortcut', () => {
  it('renders the shortcut root as a plain visible span by default', () => {
    const wrapper = mountParts([])

    expect(wrapper.element.tagName).toBe('SPAN')
    expect(wrapper.classes()).toContain('oc-shortcut')
    expect(wrapper.attributes('aria-hidden')).toBeUndefined()
  })

  it('hides the shortcut from assistive technology when decorative', () => {
    const wrapper = mountParts([{ icon: 'tool.zoom-in' }], true)

    expect(wrapper.attributes('aria-hidden')).toBe('true')
  })

  it('renders each key and separator part in order', () => {
    const wrapper = mountParts(['Ctrl', { separator: '+' }, { icon: 'tool.zoom-in' }])

    const children = childElements(wrapper)
    expect(children.map(child => child.className)).toEqual([
      'oc-key',
      'oc-shortcut__separator',
      'oc-key',
    ])
    expect(wrapper.get('.oc-key').text()).toBe('Ctrl')
    expect(wrapper.get('.oc-shortcut__separator').text()).toBe('+')
  })

  it('renders an icon part as a small glyph wrapped in its own key', () => {
    const wrapper = mountParts([{ icon: 'tool.zoom-in' }])

    const key = wrapper.get('.oc-key')
    const glyph = key.get('svg.oc-icon')
    expect(glyph.classes()).toContain('oc-icon--sm')
    expect(glyph.attributes('viewBox')).toBe('0 0 24 24')
  })

  it('renders a mixed string, separator and string shortcut as keys', () => {
    const mixed: readonly OcShortcutPart[] = ['Ctrl', { separator: '+' }, 'S']
    const wrapper = mount(OcShortcut, { props: { parts: mixed } })

    const children = childElements(wrapper)
    expect(children.map(child => child.className)).toEqual([
      'oc-key',
      'oc-shortcut__separator',
      'oc-key',
    ])
    expect(children.map(child => child.textContent)).toEqual(['Ctrl', '+', 'S'])
  })
})
