/** Card instance operations and their key-only tree view projection. */
import { computed, toRaw, watch, type Ref } from 'vue'
import type { CardDocument, CardInstanceRecord } from '../../entities/card/model'
import type { OcTreeData, OcTreeIntent, OcTreeItem } from '../../shared/ui/tree/tree.types'
import type { CdeDocumentChangeMode } from './useCdeDocumentState'

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
    if (!options.selectedCardId.value) return null
    return options.cardDoc.value?.instances?.find((instance) => instance.id === options.selectedCardId.value) ?? null
  })

  const instanceTreeData = computed<OcTreeData>(() => {
    options.documentRevision.value
    const rootKeys = [options.blueprintCardId]
    const items = new Map<string, OcTreeItem>()

    items.set(options.blueprintCardId, {
      label: '蓝图',
      icon: 'entity.card-blueprint',
    })

    for (const [index, instance] of (options.cardDoc.value?.instances ?? []).entries()) {
      const key = instance.id?.trim() || `instance-${index + 1}`
      rootKeys.push(key)
      items.set(key, {
        label: instance.name?.trim() || key,
        icon: 'entity.card-instance',
        renamable: true,
        draggable: true,
        actions: ['instance-more'],
      })
    }

    return {
      rootKeys,
      items,
      children: new Map(),
    }
  })

  function selectInstance(keys: readonly string[]): void {
    const key = keys[0] ?? null
    options.selectedCardKeys.value = key ? [key] : []
    options.selectedCardId.value = key
  }

  function handleInstanceTreeIntent(intent: OcTreeIntent): void {
    switch (intent.type) {
      case 'selection.change':
        selectInstance(intent.selectedKeys)
        return
      case 'action.invoke':
        selectInstance([intent.key])
        if (intent.actionKey === 'duplicate-instance') duplicateInstance(intent.key)
        else if (intent.actionKey === 'delete-instance') deleteInstance(intent.key)
        return
      case 'rename.commit':
        renameInstance(intent.key, intent.name)
        return
      case 'move.request':
        moveInstance(intent.key, intent.targetKey, intent.position)
        return
      default:
        return
    }
  }

  function renameInstance(instanceId: string, name: string): void {
    if (!options.cardDoc.value?.instances || instanceId === options.blueprintCardId) return
    const nextName = name.trim()
    if (!nextName) return
    const instance = options.cardDoc.value.instances.find((item) => item.id === instanceId)
    if (!instance || instance.name === nextName) return
    instance.name = nextName
    options.refreshDocumentState()
    options.markDocumentChanged('action')
  }

  function moveInstance(
    draggedKey: string,
    targetKey: string | null,
    position: 'before' | 'inside' | 'after',
  ): void {
    if (!options.cardDoc.value?.instances || draggedKey === options.blueprintCardId) return
    if (targetKey === draggedKey || position === 'inside' && targetKey !== null) return
    if (targetKey === options.blueprintCardId && position !== 'after') return
    if (targetKey !== null && targetKey !== options.blueprintCardId && position === 'inside') return

    const instances = [...options.cardDoc.value.instances]
    const sourceIndex = instances.findIndex((instance) => instance.id === draggedKey)
    if (sourceIndex < 0) return
    const [draggedInstance] = instances.splice(sourceIndex, 1)
    let insertionIndex = instances.length

    if (targetKey === options.blueprintCardId) {
      insertionIndex = 0
    } else if (targetKey !== null) {
      const targetIndex = instances.findIndex((instance) => instance.id === targetKey)
      if (targetIndex < 0) return
      insertionIndex = position === 'before' ? targetIndex : targetIndex + 1
    }

    instances.splice(insertionIndex, 0, draggedInstance)
    options.cardDoc.value.instances = instances
    options.refreshDocumentState()
    options.selectedCardKeys.value = [draggedKey]
    options.selectedCardId.value = draggedKey
    options.markDocumentChanged('action')
  }

  function createInstance(): void {
    if (!options.cardDoc.value) return
    const nextIndex = (options.cardDoc.value.instances?.length ?? 0) + 1
    const nextInstance: CardInstanceRecord = {
      type: 'card-instance',
      id: `instance-${crypto.randomUUID()}`,
      amount: '1',
      name: `新实例 ${nextIndex}`,
      data: {},
    }
    options.cardDoc.value.instances = [...(options.cardDoc.value.instances ?? []), nextInstance]
    options.selectedCardId.value = nextInstance.id
    options.selectedCardKeys.value = [nextInstance.id]
    options.refreshDocumentState()
    options.markDocumentChanged('action')
  }

  function duplicateInstance(instanceId: string): void {
    if (!options.cardDoc.value?.instances || instanceId === options.blueprintCardId) return
    const source = options.cardDoc.value.instances.find((item) => item.id === instanceId)
    if (!source) return
    const duplicated: CardInstanceRecord = {
      ...structuredClone(toRaw(source)),
      type: 'card-instance',
      id: `instance-${crypto.randomUUID()}`,
      name: `${source.name} 副本`,
    }
    const sourceIndex = options.cardDoc.value.instances.findIndex((item) => item.id === instanceId)
    const nextInstances = [...options.cardDoc.value.instances]
    nextInstances.splice(sourceIndex + 1, 0, duplicated)
    options.cardDoc.value.instances = nextInstances
    options.selectedCardId.value = duplicated.id
    options.selectedCardKeys.value = [duplicated.id]
    options.refreshDocumentState()
    options.markDocumentChanged('action')
  }

  function deleteInstance(instanceId: string): void {
    if (!options.cardDoc.value?.instances || instanceId === options.blueprintCardId) return
    if (!options.cardDoc.value.instances.some((item) => item.id === instanceId)) return
    options.cardDoc.value.instances = options.cardDoc.value.instances.filter((item) => item.id !== instanceId)
    if (options.selectedCardId.value === instanceId) {
      options.selectedCardId.value = options.blueprintCardId
      options.selectedCardKeys.value = [options.blueprintCardId]
    }
    options.refreshDocumentState()
    options.markDocumentChanged('action')
  }

  watch(
    [instanceTreeData, options.selectedCardId],
    ([treeData, selectedId]) => {
      const nextKey = selectedId && treeData.items.has(selectedId) ? selectedId : null
      const currentKey = options.selectedCardKeys.value[0] ?? null
      if (currentKey === nextKey && options.selectedCardKeys.value.length === (nextKey ? 1 : 0)) return
      options.selectedCardKeys.value = nextKey ? [nextKey] : []
    },
    { immediate: true },
  )

  return {
    selectedCard,
    instanceTreeData,
    handleInstanceTreeIntent,
    createInstance,
    duplicateInstance,
    deleteInstance,
  }
}
