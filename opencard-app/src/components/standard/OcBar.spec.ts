import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcBar from './OcBar.vue'

describe('OcBar', () => {
  it('renders an empty bar without errors when nothing is provided', () => {
    const wrapper = mount(OcBar)

    expect(wrapper.get('.oc-bar').exists()).toBe(true)
    expect(wrapper.find('.oc-bar__icon').exists()).toBe(false)
    expect(wrapper.find('.oc-bar__title').exists()).toBe(false)
    expect(wrapper.find('.oc-bar__append').exists()).toBe(false)
  })

  it('renders the icon prop as an OcIcon glyph', () => {
    const wrapper = mount(OcBar, { props: { icon: 'action.play' } })

    const glyph = wrapper.get('.oc-bar__icon svg')
    expect(glyph.classes()).toContain('oc-icon')
    expect(glyph.classes()).toContain('oc-icon--md')
    expect(glyph.get('path').attributes('d')).toBeTruthy()
  })

  it('renders the icon slot instead of the icon prop', () => {
    const wrapper = mount(OcBar, {
      props: { icon: 'action.play' },
      slots: { icon: '<span class="custom-icon" />' },
    })

    expect(wrapper.get('.oc-bar__icon').find('svg').exists()).toBe(false)
    expect(wrapper.get('.oc-bar__icon').find('.custom-icon').exists()).toBe(true)
  })

  it('renders the icon slot alone when no icon prop is given', () => {
    const wrapper = mount(OcBar, { slots: { icon: '<span class="custom-icon" />' } })

    expect(wrapper.find('.oc-bar__icon .custom-icon').exists()).toBe(true)
  })

  it('renders the title prop as a truncating OcText and forwards truncate=false', () => {
    const wrapper = mount(OcBar, { props: { title: 'Layer 1' } })

    const text = wrapper.get('.oc-bar__title .oc-text')
    expect(text.text()).toBe('Layer 1')
    expect(text.classes()).toContain('oc-text--truncate')

    const loose = mount(OcBar, { props: { title: 'Layer 1', truncate: false } })
    expect(loose.get('.oc-bar__title .oc-text').classes()).not.toContain('oc-text--truncate')
  })

  it('renders the title slot instead of the title prop', () => {
    const wrapper = mount(OcBar, {
      props: { title: 'Layer 1' },
      slots: { title: '<strong class="custom-title">Custom</strong>' },
    })

    expect(wrapper.get('.oc-bar__title .custom-title').text()).toBe('Custom')
    expect(wrapper.find('.oc-bar__title .oc-text').exists()).toBe(false)
  })

  it('renders the append slot alone without the hover variant', () => {
    const wrapper = mount(OcBar, {
      props: { title: 'Layer 1' },
      slots: { append: '<button class="append-action" />' },
    })

    expect(wrapper.get('.oc-bar__append .append-action').exists()).toBe(true)
    expect(wrapper.get('.oc-bar__append .oc-bar__append-default').exists()).toBe(true)
    expect(wrapper.find('.oc-bar__append-hover').exists()).toBe(false)
    expect(wrapper.classes()).not.toContain('oc-bar--has-hover-append')
  })

  it('renders both append variants and flags the bar when append-hover is given', () => {
    const wrapper = mount(OcBar, {
      slots: {
        append: '<button class="append-action" />',
        'append-hover': '<button class="hover-action" />',
      },
    })

    expect(wrapper.classes()).toContain('oc-bar--has-hover-append')
    expect(wrapper.get('.oc-bar__append-default .append-action').exists()).toBe(true)
    expect(wrapper.get('.oc-bar__append-hover .hover-action').exists()).toBe(true)
  })

  it('renders the append-hover slot on its own', () => {
    const wrapper = mount(OcBar, { slots: { 'append-hover': '<button class="hover-action" />' } })

    expect(wrapper.get('.oc-bar__append-hover .hover-action').exists()).toBe(true)
    expect(wrapper.find('.oc-bar__append-default').exists()).toBe(false)
  })

  it('forwards extra attributes to the root element', () => {
    const wrapper = mount(OcBar, {
      props: { title: 'Layer 1' },
      attrs: { 'data-layer': 'a', role: 'option' },
    })

    expect(wrapper.get('.oc-bar').attributes('data-layer')).toBe('a')
    expect(wrapper.get('.oc-bar').attributes('role')).toBe('option')
  })

  it('keeps parent classes on the root alongside the internal modifier class', () => {
    const wrapper = mount(OcBar, {
      attrs: { class: 'is-selected' },
      slots: { 'append-hover': '<button class="hover-action" />' },
    })

    expect(wrapper.classes()).toContain('oc-bar')
    expect(wrapper.classes()).toContain('is-selected')
    expect(wrapper.classes()).toContain('oc-bar--has-hover-append')
  })
})
