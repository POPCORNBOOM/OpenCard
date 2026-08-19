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
  refreshDocumentState: (structural?: boolean) => void
  markDocumentChanged: (mode?: CdeDocumentChangeMode, target?: string, structural?: boolean) => void
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
        contextActions: ['rename', 'duplicate-instance', 'delete-instance'],
      })
    }

    return {
      rootKeys,
      items,
      children: new Map(),
    }
  })

  function selectInstance(keys: readonly string[]): void {
    const selectedKeys = keys.filter(key => key !== options.blueprintCardId && instanceTreeData.value.items.has(key))
    options.selectedCardKeys.value = selectedKeys.length > 0
      ? selectedKeys
      : keys.includes(options.blueprintCardId) ? [options.blueprintCardId] : []
    options.selectedCardId.value = options.selectedCardKeys.value[0] ?? null
  }

  function handleInstanceTreeIntent(intent: OcTreeIntent): void {
    switch (intent.type) {
      case 'selection.change':
        selectInstance(intent.selectedKeys)
        return
      case 'action.invoke':
        if (intent.source !== 'context' || !options.selectedCardKeys.value.includes(intent.key)) {
          selectInstance([intent.key])
        }
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
    options.refreshDocumentState(true)
    options.markDocumentChanged('action', 'instances', true)
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
    options.refreshDocumentState(true)
    options.selectedCardKeys.value = [draggedKey]
    options.selectedCardId.value = draggedKey
    options.markDocumentChanged('action', 'instances', true)
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
    includeNewInstanceInDataTableExport(options.cardDoc.value, nextInstance.id)
    options.selectedCardId.value = nextInstance.id
    options.selectedCardKeys.value = [nextInstance.id]
    options.refreshDocumentState(true)
    options.markDocumentChanged('action', 'instances', true)
  }

  function duplicateInstance(instanceId: string): void {
    if (!options.cardDoc.value?.instances || instanceId === options.blueprintCardId) return
    const sourceIds = options.selectedCardKeys.value.length > 1
      ? options.selectedCardKeys.value
      : [instanceId]
    const sources = sourceIds
      .map(id => options.cardDoc.value?.instances.find(instance => instance.id === id))
      .filter((instance): instance is CardInstanceRecord => Boolean(instance))
    if (sources.length === 0) return

    const duplicated = sources.map(source => ({
      ...structuredClone(toRaw(source)),
      type: 'card-instance' as const,
      id: `instance-${crypto.randomUUID()}`,
      name: `${source.name} 副本`,
    }))
    const sourceIndexes = sources
      .map(source => options.cardDoc.value!.instances.findIndex(instance => instance.id === source.id))
      .sort((a, b) => a - b)
    const insertionIndex = sourceIndexes[sourceIndexes.length - 1] + 1
    const nextInstances = [...options.cardDoc.value.instances]
    nextInstances.splice(insertionIndex, 0, ...duplicated)
    options.cardDoc.value.instances = nextInstances
    for (const instance of duplicated) includeNewInstanceInDataTableExport(options.cardDoc.value, instance.id)
    selectInstance(duplicated.map(instance => instance.id))
    options.refreshDocumentState(true)
    options.markDocumentChanged('action', 'instances', true)
  }

  function deleteInstance(instanceId: string): void {
    if (!options.cardDoc.value?.instances || instanceId === options.blueprintCardId) return
    const selectedIds = options.selectedCardKeys.value.length > 1
      ? options.selectedCardKeys.value
      : [instanceId]
    const deleteIds = new Set(selectedIds.filter(id => id !== options.blueprintCardId))
    if (deleteIds.size === 0) return
    const existingIds = new Set(options.cardDoc.value.instances.map(instance => instance.id))
    for (const id of deleteIds) {
      if (!existingIds.has(id)) deleteIds.delete(id)
    }
    if (deleteIds.size === 0) return
    options.cardDoc.value.instances = options.cardDoc.value.instances.filter(instance => !deleteIds.has(instance.id))
    if (options.cardDoc.value.dataTable?.exportInstanceIds) {
      options.cardDoc.value.dataTable.exportInstanceIds = options.cardDoc.value.dataTable.exportInstanceIds
        .filter(candidate => !deleteIds.has(candidate))
    }
    selectInstance([options.blueprintCardId])
    options.refreshDocumentState(true)
    options.markDocumentChanged('action', 'instances', true)
  }

  watch(
    [instanceTreeData, options.selectedCardId, options.selectedCardKeys],
    ([treeData, selectedId, selectedKeys]) => {
      const validKeys = selectedKeys.filter(key => treeData.items.has(key) && key !== options.blueprintCardId)
      if (validKeys.length > 0) {
        if (selectedId !== validKeys[0]) options.selectedCardId.value = validKeys[0]
        if (validKeys.length !== selectedKeys.length) options.selectedCardKeys.value = validKeys
        return
      }
      const nextKey = selectedId && treeData.items.has(selectedId) ? selectedId : null
      const nextKeys = nextKey ? [nextKey] : []
      if (selectedKeys.length === nextKeys.length && selectedKeys.every((key, index) => key === nextKeys[index])) return
      options.selectedCardKeys.value = nextKeys
    },
    { immediate: true },
  )

  return {
    selectedCard,
    instanceTreeData,
    handleInstanceTreeIntent,
    createInstance,
    renameInstance,
    duplicateInstance,
    deleteInstance,
  }
}

function includeNewInstanceInDataTableExport(document: CardDocument, instanceId: string): void {
  const configured = document.dataTable?.exportInstanceIds
  if (!configured || configured.includes(instanceId)) return
  configured.push(instanceId)
}
