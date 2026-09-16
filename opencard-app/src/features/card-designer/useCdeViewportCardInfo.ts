/**
 * 模块说明：
 * - 将卡片文档、渲染投影与当前选择投影为视口信息行和面尺寸，并独立拥有信息值高亮生命周期。
 * 职责边界：
 * - 只维护信息行、尺寸与 900ms 高亮计时器，不读写文档、不判断渲染问题、不参与选择命令。
 */
import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import type {
  CardBlock,
  CardDocument,
  CardFaceKey,
  CardInstanceRecord,
} from '../../entities/card/model'
import { isBlockContainer } from '../../entities/card/tree'
import type {
  RenderReadyCardDocument,
  RenderReadyCardFace,
} from '../card-rendering/render.types'
import { getEditorResourceRelativePath } from '../editor-runtime/services/editorResource'

type ViewportCardInfoItem = {
  key: string
  value: string
  separated?: boolean
  multiline?: boolean
}

type UseCdeViewportCardInfoOptions = {
  cardDoc: Readonly<Ref<CardDocument | null>>
  activeFaceKey: Readonly<Ref<CardFaceKey>>
  selectedCardId: Readonly<Ref<string | null>>
  selectedCard: Readonly<Ref<CardInstanceRecord | null>>
  viewDocument: Readonly<Ref<RenderReadyCardDocument | null>>
  viewFace: Readonly<Ref<RenderReadyCardFace | null>>
  resourceRootPath: Readonly<Ref<string | null | undefined>>
  filePath: Readonly<Ref<string>>
  fileName: Readonly<Ref<string | undefined>>
  blueprintCardId: string
  translate: (messageKey: string, parameters?: Record<string, unknown>) => string
}

export function useCdeViewportCardInfo(options: UseCdeViewportCardInfoOptions) {
  const highlightedInfoKeys = ref<ReadonlySet<string>>(new Set())
  const previousInfoValues = new Map<string, string>()
  const infoHighlightTimers = new Map<string, number>()

  const viewportCardInfo = computed<ViewportCardInfoItem[]>(() => {
    const document = options.cardDoc.value
    const face = document?.faces[options.activeFaceKey.value] ?? null
    const filePath = getEditorResourceRelativePath(options.resourceRootPath.value ?? null, options.filePath.value)
      || options.fileName.value?.trim()
      || options.filePath.value.split(/[\\/]/).filter(Boolean).pop()
      || options.filePath.value
    const blockCount = face ? countBlocks(face.children.map((child) => child.block)) : 0
    const isBlueprint = options.selectedCardId.value === options.blueprintCardId
    const documentName = options.viewDocument.value?.name || '—'
    const documentVersion = options.viewDocument.value?.version || '—'
    const description = options.viewDocument.value?.description.trim()
    const notes = options.viewDocument.value?.notes.trim()
    const items: ViewportCardInfoItem[] = [
      { key: 'fileName', value: filePath },
      { key: 'document', value: `${documentName} @ ${documentVersion}` },
    ]

    if (description) {
      items.push({
        key: 'description',
        value: options.translate('cardDesigner.info.descriptionValue', { description }),
        multiline: true,
      })
    }

    items.push({
      key: 'instanceCount',
      value: options.translate('cardDesigner.info.instanceTotal', { count: document?.instances.length ?? 0 }),
    })

    if (!isBlueprint && options.selectedCard.value) {
      const instanceIndex = Math.max(0, document?.instances.findIndex(
        (instance) => instance.id === options.selectedCard.value?.id,
      ) ?? -1) + 1
      items.push({
        key: 'instance',
        value: options.translate('cardDesigner.info.instancePosition', {
          name: options.selectedCard.value.name || options.selectedCard.value.id,
          index: instanceIndex,
          total: document?.instances.length ?? 0,
        }),
        separated: true,
      })
    }

    items.push({
      key: 'face',
      value: options.activeFaceKey.value === 'front'
        ? options.translate('cardDesigner.info.front')
        : options.translate('cardDesigner.info.back'),
      separated: true,
    })
    items.push({
      key: 'blockCount',
      value: options.translate('cardDesigner.info.blockTotal', { count: blockCount }),
    })
    if (notes) {
      items.push({ key: 'notes', value: notes, separated: true, multiline: true })
    }
    return items
  })

  const viewportCardDimensions = computed(() => ({
    width: options.translate('cardDesigner.info.widthValue', { value: options.viewFace.value?.width ?? '—' }),
    height: options.translate('cardDesigner.info.heightValue', { value: options.viewFace.value?.height ?? '—' }),
  }))

  function highlightInfoValue(key: string): void {
    const nextKeys = new Set(highlightedInfoKeys.value)
    nextKeys.add(key)
    highlightedInfoKeys.value = nextKeys

    const previousTimer = infoHighlightTimers.get(key)
    if (previousTimer !== undefined) window.clearTimeout(previousTimer)
    infoHighlightTimers.set(key, window.setTimeout(() => {
      const remainingKeys = new Set(highlightedInfoKeys.value)
      remainingKeys.delete(key)
      highlightedInfoKeys.value = remainingKeys
      infoHighlightTimers.delete(key)
    }, 900))
  }

  watch(viewportCardInfo, (items) => {
    for (const item of items) {
      const previousValue = previousInfoValues.get(item.key)
      previousInfoValues.set(item.key, item.value)
      if (previousValue === undefined || previousValue === item.value) continue
      highlightInfoValue(item.key)
    }
  }, { immediate: true })
  watch(viewportCardDimensions, (dimensions) => {
    for (const key of ['width', 'height'] as const) {
      const value = dimensions[key]
      const previousValue = previousInfoValues.get(key)
      previousInfoValues.set(key, value)
      if (previousValue === undefined || previousValue === value) continue
      highlightInfoValue(key)
    }
  }, { immediate: true })

  onUnmounted(() => {
    for (const timer of infoHighlightTimers.values()) window.clearTimeout(timer)
    infoHighlightTimers.clear()
  })

  return {
    highlightInfoValue,
    highlightedInfoKeys,
    viewportCardDimensions,
    viewportCardInfo,
  }
}

function countBlocks(blocks: readonly CardBlock[]): number {
  return blocks.reduce((count, block) => (
    count + 1 + (isBlockContainer(block)
      ? countBlocks(block.children.map((child) => child.block))
      : 0)
  ), 0)
}
