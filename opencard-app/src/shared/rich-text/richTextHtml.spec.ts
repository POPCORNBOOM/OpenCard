import { describe, expect, it, vi } from 'vitest'
import { formatRichTextHtmlSource, normalizeRichTextHtml, sanitizeRichTextHtml, transformRichTextHtml } from './richTextHtml'

describe('transformRichTextHtml', () => {
  it('transforms binding elements and text nodes without touching attributes', () => {
    const resolveBindingNode = vi.fn(() => ({ ok: true as const, value: '<Node & value>' }))
    const resolveTextNode = vi.fn((value: string) => ({
      ok: true as const,
      value: value.replace('{{legacy}}', '<Legacy & value>'),
    }))

    const result = transformRichTextHtml(
      '<p title="{{attribute}}">Before {{legacy}} <strong><span data-oc-binding="self:name">{{wrong}}</span></strong></p>',
      { resolveBindingNode, resolveTextNode },
    )

    expect(result).toEqual({
      ok: true,
      value: '<p title="{{attribute}}">Before &lt;Legacy &amp; value&gt; <strong><span data-oc-binding="self:name">&lt;Node &amp; value&gt;</span></strong></p>',
    })
    expect(resolveBindingNode).toHaveBeenCalledWith('self:name')
    expect(resolveTextNode).not.toHaveBeenCalledWith('{{wrong}}')
  })

  it('returns no partial document when a callback fails', () => {
    const source = '<p>{{first}} <span data-oc-binding="self:name">{{self:name}}</span></p>'
    const result = transformRichTextHtml(source, {
      resolveTextNode: value => ({ ok: true, value: value.replace('{{first}}', 'resolved') }),
      resolveBindingNode: () => ({ ok: false }),
    })

    expect(result).toEqual({ ok: false })
  })
})

describe('sanitizeRichTextHtml', () => {
  it('preserves consecutive spaces inside rich-text content', () => {
    expect(normalizeRichTextHtml('<p>Left   right</p>')).toBe('<p>Left   right</p>')
  })

  it('preserves supported inline font size', () => {
    expect(sanitizeRichTextHtml('<p><span style="font-size: 18px; position: fixed">Text</span></p>'))
      .toBe('<p><span style="font-size: 18px;">Text</span></p>')
  })

  it('normalizes project font references to the stable CSS alias', () => {
    expect(normalizeRichTextHtml('<p><span style="font-family: &quot;font:brand-sans&quot;">Text</span></p>'))
      .toBe('<p><span style="font-family: &quot;OpenCardProjectFont-brand-sans&quot;;">Text</span></p>')
  })

  it('preserves underline and strikethrough marks', () => {
    expect(sanitizeRichTextHtml('<p><u>Underline</u> <s>Strike</s></p>'))
      .toBe('<p><u>Underline</u> <s>Strike</s></p>')
  })

  it('preserves only valid project icon keys and canonical fallback text', () => {
    expect(sanitizeRichTextHtml('<span data-oc-icon-series="status" data-oc-icon-key="wide" style="background:url(bad)">bad</span>'))
      .toBe('<span data-oc-icon-series="status" data-oc-icon-key="wide">[[icon:status/wide]]</span>')
    expect(sanitizeRichTextHtml('<span data-oc-icon-series="Bad Key" data-oc-icon-key="wide">bad</span>'))
      .toBe('<span>bad</span>')
  })
})

describe('formatRichTextHtmlSource', () => {
  it('puts top-level rich-text blocks on separate lines without changing inline content', () => {
    expect(formatRichTextHtmlSource('<p>Hello <strong>world</strong></p><p>Next</p>'))
      .toBe('<p>Hello <strong>world</strong></p>\n<p>Next</p>')
  })

  it('does not persist source formatting whitespace between blocks', () => {
    expect(normalizeRichTextHtml('<p>First</p>\n  <p>Second</p>'))
      .toBe('<p>First</p><p>Second</p>')
  })
})
