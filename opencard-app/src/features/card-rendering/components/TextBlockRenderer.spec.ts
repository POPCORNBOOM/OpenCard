import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { TextBlock as TextBlockModel } from '../../../entities/card/model'
import TextBlockRenderer from './TextBlockRenderer.vue'
import { setProjectFonts } from '../../workspace/model/projectFonts'
import { parseRenderReadyBlockForTest, rendererTestGlobal, richTextRendererTestGlobal } from './renderTestUtils'
import CardBlockRenderer from './CardBlockRenderer.vue'
import type { PreparedRichTextCatalog } from '../prepareRichText'
import { cardEditorContextKey } from './cardEditorContext'
import { computed } from 'vue'
import { parseRichTextHtml } from '../../../shared/rich-text/richTextHtml'

describe('TextBlockRenderer', () => {
  it('promotes plain-text line breaks to rich-text paragraphs', () => {
    const block = parseRenderReadyBlockForTest({
      id: 'multiline-text-block',
      type: 'text-block',
      content: 'first line\nsecond line',
    })

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: richTextRendererTestGlobal(block),
    })

    expect(wrapper.findAll('.text-block-content--richtext p').map(paragraph => paragraph.text()))
      .toEqual(['first line', 'second line'])
  })

  it('renders content through the rich-text contract', () => {
    const source: TextBlockModel = {
      id: 'rich-text-block',
      type: 'text-block',
      content: '<p style="text-align: center">first <strong>second</strong></p>',
    }
    const block = parseRenderReadyBlockForTest(source)

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: richTextRendererTestGlobal(block),
    })
    const content = wrapper.get('.text-block-content--richtext')

    expect(content.get('p').attributes('style')).toContain('text-align: center')
    expect(content.get('strong').text()).toBe('second')
  })

  it('renders underline and strikethrough marks', () => {
    const block = parseRenderReadyBlockForTest({
      id: 'decorated-rich-text-block',
      type: 'text-block',
      content: '<p><u>Underline</u> <s>Strike</s></p>',
    })

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: richTextRendererTestGlobal(block),
    })
    const content = wrapper.get('.text-block-content--richtext')

    expect(content.get('u').text()).toBe('Underline')
    expect(content.get('s').text()).toBe('Strike')
  })

  it('keeps horizontal text alignment independent from vertical content alignment', () => {
    const source: TextBlockModel = {
      id: 'text-block-test',
      type: 'text-block',
      content: 'A paragraph long enough to exercise text layout.',
      textAlign: 'justify',
      verticalAlign: 'bottom',
    }
    const block = parseRenderReadyBlockForTest(source)

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })
    const style = wrapper.element.style

    expect(style.display).toBe('flex')
    expect(style.flexDirection).toBe('column')
    expect(style.justifyContent).toBe('flex-end')
    expect(style.textAlign).toBe('justify')
  })

  it('renders semicolon-separated project and system font fallbacks', () => {
    setProjectFonts([{ key: 'brand-sans', name: 'Brand Sans', source: 'BrandSans.woff2' }])
    const block = parseRenderReadyBlockForTest({
      id: 'project-font-block',
      type: 'text-block',
      content: 'Brand text',
      fontFamily: 'font:brand-sans; Microsoft YaHei; sans-serif',
    })

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })

    expect(wrapper.element.style.fontFamily)
      .toBe('"OpenCardProjectFont-brand-sans", "Microsoft YaHei", sans-serif')
  })

  it('does not render HTML that has no prepared safe document', () => {
    const block = parseRenderReadyBlockForTest({
      id: 'safe-rich-text-block',
      type: 'text-block',
      content: '<script>alert(1)</script><p onclick="alert(1)" style="color: red; position: fixed">Safe <span style="font-family: Impact; background-image: url(x)">text</span></p>',
    })

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: rendererTestGlobal,
    })
    const content = wrapper.get('.text-block-content--richtext')

    expect(content.find('script').exists()).toBe(false)
    expect(content.find('p').exists()).toBe(false)
  })

  it('preserves only the controlled binding attribute on rich-text spans', () => {
    const block = parseRenderReadyBlockForTest({
      id: 'binding-rich-text-block',
      type: 'text-block',
      content: '<p><span data-oc-binding="self:name">OpenCard</span></p>',
    })

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: richTextRendererTestGlobal(block),
    })
    const binding = wrapper.get('[data-oc-binding]')

    expect(binding.attributes('data-oc-binding')).toBe('self:name')
  })

  it('renders saved project-icon nodes with their atlas CSS variables', () => {
    const block = parseRenderReadyBlockForTest({
      id: 'project-icon-rich-text-block',
      type: 'text-block',
      content: '<p><span data-oc-icon-path="mc-wu-pin/r3-c16"></span></p>',
    })
    const catalog = {
      series: [{ name: 'MC items', key: 'mc-wu-pin', source: 'items.png', src: 'asset://items.png', imageWidth: 400, imageHeight: 400 }],
      entries: [{
        seriesKey: 'mc-wu-pin', source: 'items.png', src: 'asset://items.png', imageWidth: 400, imageHeight: 400,
        iconKey: 'r3-c16', name: 'Carrot on a Stick', x: 240, y: 32, width: 16, height: 16,
        pixelated: true, rotation: 180,
      }],
      errors: [],
    } as const

    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: richTextRendererTestGlobal(block, catalog),
    })
    const icon = wrapper.get<HTMLElement>('.project-inline-icon').element

    expect(icon.style.getPropertyValue('--oc-project-icon-background-image')).toBe('url("asset://items.png")')
    expect(icon.style.getPropertyValue('--oc-project-icon-background-position')).toBe('-15em -2em')
    expect(icon.style.getPropertyValue('--oc-project-icon-transform')).toBe('rotate(180deg)')
  })

  it('passes prepared embeds to the existing card block renderer without runtime preparation', () => {
    const block = parseRenderReadyBlockForTest({
      id: 'host', type: 'text-block',
      content: '<p><oc-custom-block data-oc-id="badge" data-oc-key="badge" data-oc-layout="inline"></oc-custom-block></p>',
    })
    const embedded = {
      ...parseRenderReadyBlockForTest({ id: 'host::embed:badge', type: 'text-block', content: 'Ready' }),
      type: 'custom-block' as const,
      customBlockKey: 'badge',
      content: parseRenderReadyBlockForTest({ id: 'host::embed:badge', type: 'text-block', content: 'Ready' }),
    }
    const parsed = parseRichTextHtml(block.content)
    const richText: PreparedRichTextCatalog = new Map([['host', {
      document: parsed.document,
      embeddedBlocks: new Map([['badge', embedded]]),
      diagnostics: [],
      valid: true,
    }]])
    const wrapper = mount(TextBlockRenderer, {
      props: { block, layoutMode: 'static' },
      global: {
        stubs: { CardBlockRenderer: true },
        provide: { [cardEditorContextKey as symbol]: {
          transformDisabledBlockIds: computed(() => new Set<string>()),
          handleBlockClick: () => undefined,
          resolveAssetSrc: (path: string) => path,
          richText: computed(() => richText),
        } },
      },
    })

    expect(wrapper.getComponent(CardBlockRenderer).props('block')).toBe(embedded)
    expect(wrapper.getComponent(CardBlockRenderer).props('layoutMode')).toBe('static')
  })
})
