import { getBlockBoxStyles } from '../../../utils/blockStyle'
import type {
  RenderReadyBaseBlock,
  RenderReadyFlowContainerLocation,
  RenderReadySimpleContainerLocation,
} from '../render.types'

export type BlockRenderPlacement =
  | { kind: 'root' }
  | { kind: 'absolute'; location: RenderReadySimpleContainerLocation }
  | { kind: 'flow'; location: RenderReadyFlowContainerLocation }

const flowAlignMap: Record<RenderReadyFlowContainerLocation['align'], string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  justify: 'stretch',
}

function getAbsolutePlacementStyles(location: RenderReadySimpleContainerLocation): string[] {
  const styles = ['position: absolute']
  let translateX = '0px'
  let translateY = '0px'

  if (location.anchor[0] === 'l') styles.push(`left: ${location.x}`)
  else if (location.anchor[0] === 'c') {
    styles.push(`left: calc(50% + ${location.x})`)
    translateX = '-50%'
  } else styles.push(`right: ${location.x}`)

  if (location.anchor[1] === 't') styles.push(`top: ${location.y}`)
  else if (location.anchor[1] === 'c') {
    styles.push(`top: calc(50% + ${location.y})`)
    translateY = '-50%'
  } else styles.push(`bottom: ${location.y}`)

  if (translateX !== '0px' || translateY !== '0px') {
    styles.push(`translate: ${translateX} ${translateY}`)
  }
  return styles
}

export function getBlockRenderPlacementStyles(
  block: RenderReadyBaseBlock,
  placement: BlockRenderPlacement,
  disableTransform: boolean,
): string {
  const styles = [getBlockBoxStyles(block, { disableTransform })]
  if (placement.kind === 'root') styles.push('position: relative')
  else if (placement.kind === 'absolute') styles.push(...getAbsolutePlacementStyles(placement.location))
  else {
    styles.push(
      'position: relative',
      `order: ${placement.location.index}`,
      'flex-shrink: 0',
      `align-self: ${flowAlignMap[placement.location.align]}`,
    )
  }
  return styles.filter(Boolean).join('; ')
}
