import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcShortcut from './OcShortcut.vue'
import type { OcShortcutPart } from './OcShortcut.vue'

describe('probe', () => {
  it('reports the mixed string part DOM', () => {
    const mixed: readonly OcShortcutPart[] = ['Ctrl', { separator: '+' }, 'S']
    const wrapper = mount(OcShortcut, { props: { parts: mixed } })
    expect(Array.from(wrapper.element.children).map(child => `${child.className}|${child.textContent}`)).toEqual([])
  })
})
