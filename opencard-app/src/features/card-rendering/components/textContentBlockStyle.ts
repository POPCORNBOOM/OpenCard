import { toCssFontFamily } from '../../workspace/model/projectFonts'
import type { RenderReadyMarkdownTextBlock, RenderReadyTextBlock } from '../render.types'
import { getBlockRenderPlacementStyles, type BlockRenderPlacement } from './blockRenderPlacement'

type RenderReadyTextContentBlock = RenderReadyTextBlock | RenderReadyMarkdownTextBlock

const verticalJustifyMap: Record<RenderReadyTextContentBlock['verticalAlign'], string> = {
  top: 'flex-start',
  center: 'center',
  bottom: 'flex-end',
}
const fontWeightMap: Record<string, number> = { light: 300, normal: 400, bold: 700 }

export function getTextContentBlockStyle(
  block: RenderReadyTextContentBlock,
  placement: BlockRenderPlacement,
  disableTransform: boolean,
  resolveFontFamily: (value: string) => string = toCssFontFamily,
): string {
  let style = getBlockRenderPlacementStyles(block, placement, disableTransform)
  style += '; display: flex; flex-direction: column'
  style += `; justify-content: ${verticalJustifyMap[block.verticalAlign]}`
  style += `; font-size: ${block.fontSize}`
  style += `; font-family: ${resolveFontFamily(block.fontFamily)}`
  style += `; font-weight: ${fontWeightMap[block.fontWeight] ?? 400}`
  style += `; color: ${block.color}`
  style += `; text-align: ${block.textAlign}`
  style += `; line-height: ${block.lineHeight}`
  style += `; writing-mode: ${block.writingMode}`
  return style
}
