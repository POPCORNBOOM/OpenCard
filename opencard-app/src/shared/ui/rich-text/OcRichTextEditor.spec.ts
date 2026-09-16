import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { i18n, setAppLocale } from '../../../i18n'
import OcRichTextEditor from './OcRichTextEditor.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

function mountEditor(): VueWrapper {
  return mount(OcRichTextEditor, {
    props: { modelValue: '<p>Hello</p>' },
    global: { plugins: [i18n] },
  })
}

function selectedLabels(wrapper: VueWrapper): { font: string, strokeWidth: string } {
  return {
    font: wrapper.get('.oc-rich-text-editor__font .oc-select__value').text(),
    strokeWidth: wrapper.get('.oc-rich-text-editor__stroke-width .oc-select__value').text(),
  }
}

function alignmentLabels(wrapper: VueWrapper): string[] {
  return wrapper.findAll('.oc-rich-text-editor__toolbar button')
    .map(button => button.attributes('aria-label') ?? '')
    .filter(label => /^(Align left|Center|Align right|Justify|左对齐|居中|右对齐|两端对齐)$/.test(label))
}

describe('OcRichTextEditor locale reactivity', () => {
  it('re-labels the font, stroke width and alignment controls when the language changes', async () => {
    setAppLocale('en-US')
    const wrapper = mountEditor()
    await nextTick()

    expect(selectedLabels(wrapper)).toEqual({ font: 'Default font', strokeWidth: 'No stroke' })
    expect(alignmentLabels(wrapper)).toEqual(['Align left', 'Center', 'Align right', 'Justify'])

    setAppLocale('zh-CN')
    await nextTick()

    expect(selectedLabels(wrapper)).toEqual({ font: '默认字体', strokeWidth: '无描边' })
    expect(alignmentLabels(wrapper)).toEqual(['左对齐', '居中', '右对齐', '两端对齐'])

    wrapper.unmount()
  })
})
