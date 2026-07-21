import type { CardBlock } from '../../entities/card/model'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'

export function getBlockTreeIcon(type: CardBlock['type']): IconToken {
  switch (type) {
    case 'text-block':
      return 'entity.block-text'
    case 'image-block':
      return 'entity.block-image'
    case 'qrcode-block':
      return 'entity.block-qrcode'
    case 'shape-block':
      return 'entity.block-shape'
    case 'simple-container-block':
      return 'entity.block-simple-container'
    case 'flow-container-block':
      return 'data.layers'
  }
}
