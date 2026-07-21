import type {
  CardBlock,
  CardDocument,
  FlowContainerBlock,
  ImageBlock,
  QRCodeBlock,
  ShapeBlock,
  SimpleContainerBlock,
  TextBlock,
} from '../../../entities/card/model'
import { computed } from 'vue'
import { cardEditorContextKey } from './cardEditorContext'
import { parseRenderDocument } from '../renderParser'
import type {
  RenderReadyCardBlock,
  RenderReadyFlowContainerBlock,
  RenderReadyImageBlock,
  RenderReadyQRCodeBlock,
  RenderReadyShapeBlock,
  RenderReadySimpleContainerBlock,
  RenderReadyTextBlock,
} from '../render.types'

export const rendererTestGlobal = {
  provide: {
    [cardEditorContextKey as symbol]: {
      transformDisabledBlockIds: computed(() => new Set<string>()),
      handleBlockClick: () => undefined,
    },
  },
}

export function parseRenderReadyBlockForTest(block: TextBlock): RenderReadyTextBlock
export function parseRenderReadyBlockForTest(block: ImageBlock): RenderReadyImageBlock
export function parseRenderReadyBlockForTest(block: QRCodeBlock): RenderReadyQRCodeBlock
export function parseRenderReadyBlockForTest(block: ShapeBlock): RenderReadyShapeBlock
export function parseRenderReadyBlockForTest(block: SimpleContainerBlock): RenderReadySimpleContainerBlock
export function parseRenderReadyBlockForTest(block: FlowContainerBlock): RenderReadyFlowContainerBlock
export function parseRenderReadyBlockForTest(block: CardBlock): RenderReadyCardBlock {
  const document: CardDocument = {
    type: 'card-document',
    id: 'render-test-document',
    name: 'Render test',
    version: '1.0.0',
    width: '540',
    height: '850',
    background: '#ffffff',
    instances: [],
    children: [{
      block,
      location: {
        id: `location-${block.id}`,
        type: 'simple-container-location',
        anchor: 'lt',
        x: '0px',
        y: '0px',
      },
    }],
  }

  const parsed = parseRenderDocument(document).document.children[0]!.block
  if (parsed.type !== block.type) throw new Error(`Unexpected parsed block type: ${parsed.type}`)
  return parsed
}
