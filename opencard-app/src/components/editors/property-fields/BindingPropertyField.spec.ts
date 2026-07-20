import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import BindingPropertyField from './BindingPropertyField.vue'

const context = {
  targetKind: 'number' as const,
  scopes: [{
    token: 's',
    label: 'Current block',
    fields: [
      { key: 'score', label: 'Score', valueKind: 'number' as const },
      { key: 'title', label: 'Title', valueKind: 'string' as const },
    ],
  }],
}

describe('BindingPropertyField', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('filters candidates and emits a complete binding expression', async () => {
    const wrapper = mount(BindingPropertyField, {
      attachTo: document.body,
      props: { value: 0, context, bindTitle: 'Bind', clearTitle: 'Clear' },
    })

    await wrapper.get('button[aria-label="Bind"]').trigger('click')
    const menu = document.body.querySelector<HTMLElement>('[role="menu"]')!
    expect(menu.textContent).toContain('Score')
    expect(menu.textContent).not.toContain('Title')
    ;(menu.querySelector('[role="menuitem"]') as HTMLButtonElement).click()

    expect(wrapper.emitted('update:value')).toEqual([['{{s:score}}']])
  })

  it('shows a bound value and emits clear intent', async () => {
    const wrapper = mount(BindingPropertyField, {
      props: { value: '{{s:score}}', context, bindTitle: 'Change', clearTitle: 'Clear' },
    })

    expect(wrapper.text()).toContain('Score')
    await wrapper.get('button[aria-label="Clear"]').trigger('click')
    expect(wrapper.emitted('clear')).toEqual([[]])
  })
})
