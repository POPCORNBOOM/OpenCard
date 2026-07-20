import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import BindingPropertyField from './BindingPropertyField.vue'

const provider = ({ value }: { value: string }) => value === '{{}}'
  ? {
      replaceStart: 2,
      replaceEnd: 2,
      items: [{ key: 'scope:s', label: 'Current block', insertText: 's:', keepOpen: true }],
    }
  : {
      replaceStart: 2,
      replaceEnd: 4,
      items: [{ key: 'field:s:score', label: 'Score', insertText: 's:score', value: '{{s:score}}' }],
    }

describe('BindingPropertyField', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('navigates a generic provider and emits its leaf value', async () => {
    const wrapper = mount(BindingPropertyField, {
      attachTo: document.body,
      props: { value: 0, provider, bindTitle: 'Bind', clearTitle: 'Clear' },
    })

    await wrapper.get('button[aria-label="Bind"]').trigger('click')
    await Promise.resolve()
    let menu = document.body.querySelector<HTMLElement>('[role="menu"]')!
    ;(menu.querySelector('[role="menuitem"]') as HTMLButtonElement).click()
    await Promise.resolve()
    await wrapper.vm.$nextTick()
    menu = document.body.querySelector<HTMLElement>('[role="menu"]')!
    ;(menu.querySelector('[role="menuitem"]') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:value')).toEqual([['{{s:score}}']])
  })

  it('shows a bound value and emits clear intent', async () => {
    const wrapper = mount(BindingPropertyField, {
      props: { value: '{{s:score}}', provider, bindTitle: 'Change', clearTitle: 'Clear' },
    })

    expect(wrapper.text()).toContain('score')
    await wrapper.get('button[aria-label="Clear"]').trigger('click')
    expect(wrapper.emitted('clear')).toEqual([[]])
  })
})
