/**
 * 模块说明：
 * - 管理卡牌实例树 选择 重命名 增删复制与拖拽排序
 * 职责边界：
 * - 只操作内存文档与上抛变更意图 不处理保存落盘
 */
import { computed, toRaw, watch, type Ref } from 'vue'
import type {
  CardDocument,
  CardInstanceRecord,
} from '../entities/card/model'
import type { CdeDocumentChangeMode } from './useCdeDocumentState'
import type {
  ITreeNode,
  NodeTreeActionCalledPayload,
  NodeTreeCanDropPayload,
  NodeTreeDropPayload,
  NodeTreeDropPosition,
  NodeTreeRenamePayload,
} from '../shared/ui/tree/tree.types'

type UseCdeInstanceOpsOptions = {
  cardDoc: Ref<CardDocument | null>
  documentRevision: Readonly<Ref<number>>
  blueprintCardId: string
  selectedCardId: Ref<string | null>
  selectedCardKeys: Ref<string[]>
  refreshDocumentState: () => void
  markDocumentChanged: (mode?: CdeDocumentChangeMode) => void
}

export function useCdeInstanceOps(options: UseCdeInstanceOpsOptions) {
  const selectedCard = computed<CardInstanceRecord | null>(() => {
    options.documentRevision.value
    if (!options.selectedCardId.value) {
      return null
    }

    return options.cardDoc.value?.instances?.find((instance) => instance.id === options.selectedCardId.value) ?? null
  })

  const instanceTree = computed<ITreeNode[]>(() => {
    options.documentRevision.value
    if (!options.cardDoc.value) {
      return []
    }

    const instances = options.cardDoc.value.instances
    const blueprintNode: ITreeNode = {
      key: options.blueprintCardId,
      name: '蓝图',
      path: [options.blueprintCardId],
      parent: null,
      renamable: false,
      isExpandable: false,
      icon: 'data.symbol-class',
      metadata: {
        instanceId: options.blueprintCardId,
        kind: 'blueprint',
      },
    }

    if (!instances || instances.length === 0) {
      return [blueprintNode]
    }

    return [
      blueprintNode,
      ...instances.map((instance: CardInstanceRecord, index) => {
        const instanceId = instance.id?.trim() || `instance-${index + 1}`
        const displayName = instance.name?.trim() || instanceId

        return {
          key: instanceId,
          name: displayName,
          path: [instanceId],
          parent: null,
          icon: 'entity.account',
          actionKeys: ['duplicate-instance', 'delete-instance'],
          metadata: {
            instance,
            instanceId,
          },
        } satisfies ITreeNode
      }),
    ]
  })

  function onInstanceTreeSelect(nextSelectedKeys: string[]) {
    options.selectedCardKeys.value = nextSelectedKeys
    options.selectedCardId.value = nextSelectedKeys[0] ?? null
  }

  function handleInstanceTreeAction({ actionKey, caller, node }: NodeTreeActionCalledPayload) {
    if (caller === 'node' && node) {
      options.selectedCardKeys.value = [node.key]
      options.selectedCardId.value = node.key
    }

    switch (actionKey) {
      case 'add-instance':
        createInstance()
        return
      case 'duplicate-instance':
        if (node) {
          duplicateInstance(node.key)
        }
        return
      case 'delete-instance':
        if (node) {
          deleteInstance(node.key)
        }
        return
    }
  }

  function handleInstanceTreeRename({ node, name }: NodeTreeRenamePayload) {
    if (!options.cardDoc.value?.instances || node.key === options.blueprintCardId) {
      return
    }

    const nextName = name.trim()
    if (!nextName) {
      return
    }

    const instance = options.cardDoc.value.instances.find((item) => item.id === node.key)
    if (!instance || instance.name === nextName) {
      return
    }

    instance.name = nextName
    options.refreshDocumentState()
    options.markDocumentChanged('action')
  }

  function getInstanceTreeAllowedDropPositions(target: ITreeNode | null) {
    if (!target) {
      return ['inside'] as NodeTreeDropPosition[]
    }

    if (target.key === options.blueprintCardId) {
      return ['after'] as NodeTreeDropPosition[]
    }

    return ['before', 'after'] as NodeTreeDropPosition[]
  }

  function canDropInstanceTreeNode({ dragged, target, position }: NodeTreeCanDropPayload) {
    if (dragged.key === options.blueprintCardId) {
      return false
    }

    if (target && target.key === dragged.key) {
      return false
    }

    if (target && target.key === options.blueprintCardId) {
      return position === 'after'
    }

    if (target === null) {
      return position === 'inside'
    }

    return position === 'before' || position === 'after'
  }

  function handleInstanceTreeDrop({ dragged, target, position }: NodeTreeDropPayload) {
    if (!options.cardDoc.value?.instances || !canDropInstanceTreeNode({ dragged, target, position })) {
      return
    }

    const instances = [...options.cardDoc.value.instances]
    const sourceIndex = instances.findIndex((instance) => instance.id === dragged.key)
    if (sourceIndex === -1) {
      return
    }

    const [draggedInstance] = instances.splice(sourceIndex, 1)
    let insertionIndex = instances.length

    if (target && target.key !== options.blueprintCardId) {
      const targetIndex = instances.findIndex((instance) => instance.id === target.key)
      if (targetIndex === -1) {
        return
      }
      insertionIndex = position === 'before' ? targetIndex : targetIndex + 1
    } else if (target?.key === options.blueprintCardId) {
      insertionIndex = 0
    }

    instances.splice(insertionIndex, 0, draggedInstance)
    options.cardDoc.value.instances = instances
    options.refreshDocumentState()
    options.markDocumentChanged('action')
  }

  function createInstance() {
    if (!options.cardDoc.value) {
      return
    }

    const nextIndex = (options.cardDoc.value.instances?.length ?? 0) + 1
    const nextInstance: CardInstanceRecord = {
      id: `instance-${crypto.randomUUID()}`,
      amount: 1,
      name: `新实例 ${nextIndex}`,
      data: {},
    }

    options.cardDoc.value.instances = [...(options.cardDoc.value.instances ?? []), nextInstance]
    options.selectedCardId.value = nextInstance.id
    options.refreshDocumentState()
    options.markDocumentChanged('action')
  }

  function duplicateInstance(instanceId: string) {
    if (!options.cardDoc.value?.instances || instanceId === options.blueprintCardId) {
      return
    }

    const sourceInstance = options.cardDoc.value.instances.find((item) => item.id === instanceId)
    if (!sourceInstance) {
      return
    }

    const rawInstance = toRaw(sourceInstance)
    const duplicatedInstance: CardInstanceRecord = {
      ...structuredClone(rawInstance),
      id: `instance-${crypto.randomUUID()}`,
      name: `${sourceInstance.name} 副本`
    }

    const sourceIndex = options.cardDoc.value.instances.findIndex((item) => item.id === instanceId)
    const nextInstances = [...options.cardDoc.value.instances]
    nextInstances.splice(sourceIndex + 1, 0, duplicatedInstance)
    options.cardDoc.value.instances = nextInstances
    options.selectedCardId.value = duplicatedInstance.id
    options.refreshDocumentState()
    options.markDocumentChanged('action')
  }

  function deleteInstance(instanceId: string) {
    if (!options.cardDoc.value?.instances || instanceId === options.blueprintCardId) {
      return
    }

    const instance = options.cardDoc.value.instances.find((item) => item.id === instanceId)
    if (!instance) {
      return
    }

    options.cardDoc.value.instances = options.cardDoc.value.instances.filter((item) => item.id !== instanceId)
    if (options.selectedCardId.value === instanceId) {
      options.selectedCardId.value = options.blueprintCardId
    }
    options.refreshDocumentState()
    options.markDocumentChanged('action')
  }

  watch(
    [instanceTree, options.selectedCardId],
    ([nodes, instanceId]) => {
      if (!instanceId) {
        if (options.selectedCardKeys.value.length > 0) {
          options.selectedCardKeys.value = []
        }
        return
      }

      const matchedNode = nodes.find((node) => node.key === instanceId) ?? null
      const nextSelectedKeys = matchedNode ? [matchedNode.key] : []

      const currentKey = options.selectedCardKeys.value[0] ?? null
      const nextKey = nextSelectedKeys[0] ?? null
      if (currentKey === nextKey && options.selectedCardKeys.value.length === nextSelectedKeys.length) {
        return
      }

      options.selectedCardKeys.value = nextSelectedKeys
    },
    { immediate: true },
  )

  return {
    selectedCard,
    instanceTree,
    onInstanceTreeSelect,
    handleInstanceTreeAction,
    handleInstanceTreeRename,
    getInstanceTreeAllowedDropPositions,
    canDropInstanceTreeNode,
    handleInstanceTreeDrop,
  }
}

