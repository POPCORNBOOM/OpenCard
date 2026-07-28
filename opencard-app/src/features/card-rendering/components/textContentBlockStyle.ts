import { getBlockBoxStyles, getPositionStyles } from '../../../utils/blockStyle'
import { toCssFontFamily } from '../../workspace/model/projectFonts'
import type { RenderReadyMarkdownTextBlock, RenderReadyTextBlock } from '../render.types'

type RenderReadyTextContentBlock = RenderReadyTextBlock | RenderReadyMarkdownTextBlock

const verticalJustifyMap: Record<RenderReadyTextContentBlock['verticalAlign'], string> = {
  top: 'flex-start',
  center: 'center',
  bottom: 'flex-end',
}

export function getTextContentBlockStyle(
  block: RenderReadyTextContentBlock,
  layoutMode: 'absolute' | 'static',
  disableTransform: boolean,
): string {
  let style = layoutMode === 'absolute'
    ? getPositionStyles(block, { disableTransform })
    : getBlockBoxStyles(block, { disableTransform })
  style += '; display: flex; flex-direction: column'
  style += `; justify-content: ${verticalJustifyMap[block.verticalAlign]}`
  style += `; font-size: ${block.fontSize}`
  style += `; font-family: ${toCssFontFamily(block.fontFamily)}`
  style += `; font-weight: ${block.fontWeight}`
  style += `; color: ${block.color}`
  style += `; text-align: ${block.textAlign}`
  style += `; line-height: ${block.lineHeight}`
  style += `; writing-mode: ${block.writingMode}`
  return style
}
