import { describe, expect, it } from 'vitest'
import { formatRichTextHtmlSource, normalizeRichTextHtml, parseRichTextHtml, sanitizeRichTextHtml } from './richTextHtml'

describe('sanitizeRichTextHtml', () => {
  it('preserves consecutive spaces inside rich-text content', () => {
    expect(normalizeRichTextHtml('<p>Left   right</p>')).toBe('<p>Left   right</p>')
  })

  it('preserves supported inline font size', () => {
    expect(sanitizeRichTextHtml('<p><span style="font-size: 18px; position: fixed">Text</span></p>'))
      .toBe('<p><span style="font-size: 18px;">Text</span></p>')
  })

  it('preserves the text stroke shorthand', () => {
    expect(sanitizeRichTextHtml('<p><span style="-webkit-text-stroke: 1px #000">Text</span></p>'))
      .toContain('-webkit-text-stroke: 1px #000')
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
    expect(sanitizeRichTextHtml('<span data-oc-icon-path="status/wide" style="background:url(bad)">bad</span>'))
      .toBe('<span data-oc-icon-path="status/wide"></span>')
    expect(sanitizeRichTextHtml('<span data-oc-icon-path="Bad Key/wide">bad</span>'))
      .toBe('<span>bad</span>')
  })
})

describe('formatRichTextHtmlSource', () => {
  it('keeps top-level blocks adjacent so source formatting does not become document whitespace', () => {
    expect(formatRichTextHtmlSource('<p>Hello <strong>world</strong></p><p>Next</p>'))
      .toBe('<p>Hello <strong>world</strong></p><p>Next</p>')
  })

  it('does not persist source formatting whitespace between blocks', () => {
    expect(normalizeRichTextHtml('<p>First</p>\n  <p>Second</p>'))
      .toBe('<p>First</p><p>Second</p>')
  })

  it('does not inject block whitespace when switching source to visual mode', () => {
    expect(formatRichTextHtmlSource('<p>First</p><p>Second</p>'))
      .toBe('<p>First</p><p>Second</p>')
  })
})

describe('parseRichTextHtml', () => {
  it('allows unresolved dynamic styles for the visual editor boundary', () => {
    const source = '<p><mark style="background-color: {{parent.color}}; color: inherit;">Text</mark></p>'
    const result = parseRichTextHtml(source)
    expect(result.diagnostics).toEqual([])
    expect(result.canEnterVisualMode).toBe(true)
  })
  it('does not block rich text for CSS declarations it does not render', () => {
    const result = parseRichTextHtml('<p><mark style="background-color: url(javascript:bad); color: red">Text</mark></p>')
    expect(result.canEnterVisualMode).toBe(true)
    expect(result.diagnostics).toEqual([])
    expect(result.document.html).toContain('javascript:bad')
  })
  it('accepts the text stroke shorthand', () => {
    const result = parseRichTextHtml('<p><span style="-webkit-text-stroke: 1px #000">Text</span></p>')
    expect(result.canEnterVisualMode).toBe(true)
    expect(result.diagnostics).toEqual([])
  })
  it('ignores event attributes but rejects unsupported merged table cells', () => {
    const source = '<table onclick="bad()"><tbody><tr><td rowspan="2" colspan="1">Cell</td></tr></tbody></table>'
    const result = parseRichTextHtml(source)
    expect(result.canEnterVisualMode).toBe(false)
    expect(result.diagnostics.map(item => item.code)).toEqual(['invalid-structure'])
    expect(result.document.html).toBe(source)
  })
  it('accepts lists, tables, icons, bindings, and public custom block fields', () => {
    const result = parseRichTextHtml(
      '<p><span data-oc-binding="parent:name">{{parent:name}}</span></p>'
        + '<ul><li>One</li></ul><table><tbody><tr><td>Cell</td></tr></tbody></table>'
        + '<p><span data-oc-icon-path="status/ok"></span></p>'
        + '<oc-custom-block data-oc-id="badge-1" data-oc-key="badge" data-oc-layout="inline">'
        + '<oc-prop data-oc-key="label">Ready</oc-prop></oc-custom-block>',
      { resolveCustomBlock: key => key === 'badge' ? { publicFieldKeys: ['label'] } : null },
    )
    expect(result.canEnterVisualMode).toBe(true)
    expect(result.diagnostics).toEqual([])
  })

  it('keeps unsupported source intact and only reports blocked tags', () => {
    const source = '<p><script>bad</script><mark style="color: {{parent:color}}">Text</mark></p>'
    const result = parseRichTextHtml(source)
    expect(result.canEnterVisualMode).toBe(false)
    expect(result.document.html).toBe(source)
    expect(result.diagnostics.map(item => item.code)).toEqual(['unsupported-tag'])
  })

  it('rejects private custom block fields and duplicate IDs', () => {
    const result = parseRichTextHtml(
      '<oc-custom-block data-oc-id="same" data-oc-key="badge" data-oc-layout="block">'
        + '<oc-prop data-oc-key="private">x</oc-prop></oc-custom-block>'
        + '<oc-custom-block data-oc-id="same" data-oc-key="badge" data-oc-layout="block" />',
      { resolveCustomBlock: () => ({ publicFieldKeys: ['label'] }) },
    )
    expect(result.canEnterVisualMode).toBe(false)
    expect(result.diagnostics.map(item => item.code)).toContain('invalid-custom-block')
    expect(result.diagnostics.map(item => item.code)).toContain('duplicate-embed-id')
  })
})
