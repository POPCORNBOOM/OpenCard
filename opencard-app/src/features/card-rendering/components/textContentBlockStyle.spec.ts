import { describe, expect, it } from 'vitest'
import { getTextContentBlockStyle } from './textContentBlockStyle'

describe('getTextContentBlockStyle', () => {
  it('resolves project font references against the supplied snapshot context', () => {
    const style = getTextContentBlockStyle({
      id: 'text', type: 'text-block', name: 'Text', notes: '', visible: true,
      width: '100px', height: '20px', translateX: '0px', translateY: '0px', scaleX: 1, scaleY: 1,
      transformAnchor: 'cc', zIndex: 0, rotation: 0, opacity: 1, customCss: '',
      borderColor: 'transparent', borderWidth: 0, borderStyle: 'solid', borderRadius: '0', background: 'transparent',
      content: 'Snapshot', fontFamily: 'font:body', fontSize: '16px', fontWeight: '400',
      color: '#000', textAlign: 'start', lineHeight: '1', writingMode: 'horizontal-tb', verticalAlign: 'top',
    }, 'absolute', false, {
      fonts: [{ key: 'body', name: 'Body', source: 'assets/body.ttf' }],
      fontSets: [],
      cssFamilyPrefix: 'OpenCardSnapshotFont-42',
    })

    expect(style).toContain('OpenCardSnapshotFont-42-body')
    expect(style).not.toContain('OpenCardProjectFont-body')
  })
})
