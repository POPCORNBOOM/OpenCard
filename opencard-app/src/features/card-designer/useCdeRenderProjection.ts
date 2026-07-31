/**
 * Projects the current raw Card document through the single render pipeline.
 * Diagnostics, selection, UI information, and viewport geometry stay with the caller.
 */
import { computed, type Ref } from 'vue'
import type {
  CardDocument,
  CardFaceKey,
  CardInstanceRecord,
} from '../../entities/card/model'
import type {
  RenderReadyCardBlock,
  RenderReadyCardDocument,
  RenderReadyCardFace,
} from '../card-rendering/render.types'
import {
  runRenderPipeline,
  type RenderPipelineContext,
  type RenderPipelineResult,
} from '../card-rendering/renderPipeline'

type UseCdeRenderProjectionOptions = {
  cardDoc: Readonly<Ref<CardDocument | null>>
  documentRevision: Readonly<Ref<number>>
  instance: Readonly<Ref<CardInstanceRecord | null>>
  activeFaceKey: Readonly<Ref<CardFaceKey>>
  renderContext: Readonly<Ref<RenderPipelineContext>>
}

export function useCdeRenderProjection(options: UseCdeRenderProjectionOptions) {
  const renderPipelineResult = computed<RenderPipelineResult | null>(() => {
    options.documentRevision.value
    const document = options.cardDoc.value
    if (!document) return null
    return runRenderPipeline(
      document,
      options.instance.value,
      options.renderContext.value,
    )
  })
  const viewDocument = computed<RenderReadyCardDocument | null>(() => (
    renderPipelineResult.value?.document ?? null
  ))
  const viewFace = computed<RenderReadyCardFace | null>(() => (
    viewDocument.value?.faces[options.activeFaceKey.value] ?? null
  ))

  function findViewBlock(blockId: string): RenderReadyCardBlock | null {
    const face = viewFace.value
    return face ? findBlock(face.children.map(child => child.block), blockId) : null
  }

  return {
    findViewBlock,
    renderPipelineResult,
    viewDocument,
    viewFace,
  }
}

function findBlock(
  blocks: readonly RenderReadyCardBlock[],
  blockId: string,
): RenderReadyCardBlock | null {
  for (const block of blocks) {
    if (block.id === blockId) return block
    if (block.type === 'simple-container-block' || block.type === 'flow-container-block') {
      const descendant = findBlock(block.children.map(child => child.block), blockId)
      if (descendant) return descendant
    }
  }
  return null
}
