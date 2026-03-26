<template>
  <div class="card-design-editor">
    <div class="canvas-area">
      <CardViewport v-if="cardDoc" :document="cardDoc" :selected-block-ids="selectedBlockIds" />
      <div v-else class="empty-hint">无法解析 .opencard 文件</div>
    </div>

    <div class="right-panel">
      <div class="block-list-panel">
        <div class="panel-header">信息树</div>
        <div class="block-list">
          <NodeTree title="元素块" :nodes="blockTree" :selected="selectedBlocks" :actions="treeActions"
            :action-keys="treeActionKeys" @update:selected="onTreeSelect" @action-called="handleTreeAction" />
        </div>
      </div>

      <div class="property-panel">
        <div class="panel-header">属性</div>
        <div class="panel-header-actions">
          <button class="panel-icon-button" :class="{ active: propertySortMode === 'category' }" type="button"
            title="Category" @click="propertySortMode = 'category'">
            <span class="codicon codicon-list-tree" />
          </button>
          <button class="panel-icon-button" :class="{ active: propertySortMode === 'alphabetical' }" type="button"
            title="A-Z" @click="propertySortMode = 'alphabetical'">
            <span class="codicon codicon-symbol-string" />
          </button>
        </div>
        <PropertyEditor :sources="propertySources" :sort-mode="propertySortMode"
          @update-property="updateBlockProp" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { EditorEmits, EditorProps } from '../../core/Editor'
import {
  block2ITreeNode,
  blockPropertyDefinitions,
  flowContainerChildLocationDefinitions,
  rootChildLocationDefinitions,
  simpleContainerChildLocationDefinitions,
  type CardBlock,
  type CardDocument,
  type CardTreeNodeMetadata,
  type EditorPropertyDefinition,
  type PropertyEditorSource,
} from '../../core/Card'
import { fileSystemService } from '../../services/fileSystemService'
import CardViewport from '../card/CardViewport.vue'
import NodeTree, { type ActionDefinition, type NodeTreeActionCalledPayload } from '../ui/NodeTree.vue'
import type { ITreeNode } from '../ui/TreeNode.vue'
import PropertyEditor from './PropertyEditor.vue'

type PropertySortMode = 'category' | 'alphabetical'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()

const rawContent = ref('')
const cardDoc = ref<CardDocument | null>(null)
const isModified = ref(false)
const propertySortMode = ref<PropertySortMode>('category')
const treeActions = new Map<string, ActionDefinition>([
  ['add-root', { key: 'add-root', icon: 'codicon-add', title: '添加' }],
  ['delete-root', { key: 'delete-root', icon: 'codicon-trash', title: '删除' }],
  ['add', { key: 'add', icon: 'codicon-add', title: '添加' }],
])
const treeActionKeys = ['add-root', 'delete-root']

const selectedBlocks = ref<Map<string, ITreeNode>>(new Map())
const selectedNode = computed<ITreeNode | null>(() => {
  if (selectedBlocks.value.size === 0) return null
  return selectedBlocks.value.values().next().value ?? null
})

const selectedBlock = computed<CardBlock | null>(() => {
  const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
  return metadata?.block ?? null
})

const selectedLayout = computed<Record<string, unknown> | null>(() => {
  const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
  return metadata?.location ? (metadata.location as Record<string, unknown>) : null
})

const selectedBlockIds = computed(() => {
  if (!selectedBlock.value) return []
  return [selectedBlock.value.id]
})

const propertySources = computed<PropertyEditorSource[]>(() => {
  const sources: PropertyEditorSource[] = []

  if (selectedBlock.value) {
    sources.push({
      title: 'Block',
      target: selectedBlock.value as Record<string, unknown> & { type?: string },
      typeDefinitions: blockPropertyDefinitions,
    })
  }

  const parentBlock = (selectedNode.value?.parent?.metadata as CardTreeNodeMetadata | undefined)?.block
  if (selectedLayout.value) {
    sources.push({
      title: 'Layout',
      target: selectedLayout.value as Record<string, unknown> & { type?: string },
      definitions: parentBlock ? getLocationDefinitions(parentBlock.type) : rootChildLocationDefinitions,
    })
  }

  return sources
})

const blockTree = computed(() => {
  if (!cardDoc.value) return []
  return cardDoc.value.children.map((child) =>
    withNodeActionKeys(block2ITreeNode(child.block, null, child.location), ['add'])
  )
})

function updateBlockProp({
  target,
  key,
  value,
}: {
  target: Record<string, unknown>
  key: string
  value: unknown
}) {
  target[key] = value
  isModified.value = true
}

function onTreeSelect(newSelected: Map<string, ITreeNode>) {
  selectedBlocks.value = newSelected
}

function handleTreeAction({ actionKey, caller, node }: NodeTreeActionCalledPayload) {
  console.info('Tree Action Called:', actionKey, caller, node)
  if (caller === 'node' && node) {
    selectedBlocks.value = new Map([[node.key, node]])
  }

  if (actionKey === 'add-root' || actionKey === 'add') {
    addBlock()
    return
  }

  if (actionKey === 'delete-root') {
    deleteBlock()
  }
}

async function loadFile() {
  try {
    const content = await fileSystemService.readFile(props.filePath)
    rawContent.value = content
    cardDoc.value = JSON.parse(content)
    isModified.value = false
  } catch (e) {
    console.error('读取 .opencard 文件失败:', e)
    cardDoc.value = null
  }
}

const addBlock = () => {
  // todo
  console.info('添加块 - 待实现')
}

const deleteBlock = () => {
  // todo
  console.info('删除块 - 待实现')
}

async function saveFile() {
  if (!cardDoc.value) return
  try {
    const content = JSON.stringify(cardDoc.value, null, 2)
    await fileSystemService.writeFile(props.filePath, content)
    rawContent.value = content
    isModified.value = false
    emit('save')
  } catch (e) {
    console.error('保存失败:', e)
  }
}

onMounted(loadFile)
watch(() => props.filePath, loadFile)
defineExpose({ save: saveFile })

function getLocationDefinitions(
  type: CardBlock['type']
): Record<string, EditorPropertyDefinition> {
  if (type === 'simple-container') {
    return simpleContainerChildLocationDefinitions
  }
  if (type === 'flow-container') {
    return flowContainerChildLocationDefinitions
  }
  return {}
}

function withNodeActionKeys(node: ITreeNode, actionKeys: string[]): ITreeNode {
  return {
    ...node,
    actionKeys,
    children: node.children?.map((child) => withNodeActionKeys(child, actionKeys)),
  }
}
</script>

<style scoped>
.card-design-editor {
  display: flex;
  height: 100%;
  background: #1e1e1e;
  color: #ccc;
}

.canvas-area {
  flex: 1;
  display: flex;
  background: #2d2d2d;
}

.right-panel {
  width: 280px;
  border-left: 1px solid #000;
  display: flex;
  flex-direction: column;
}

.block-list-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #000;
  overflow: hidden;
}

.property-panel {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  height: 30px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  text-transform: uppercase;
  font-weight: bold;
  background: #252526;
  border-bottom: 1px solid #000;
}

.panel-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  position: absolute;
  top: 5px;
  right: 10px;
  z-index: 1;
}

.panel-icon-button {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  background: transparent;
  color: #8f8f8f;
  cursor: pointer;
  padding: 0;
}

.panel-icon-button:hover {
  color: #d4d4d4;
  border-color: #3f3f46;
  background: #2a2d2e;
}

.panel-icon-button.active {
  color: #ffffff;
  border-color: #0e639c;
  background: #094771;
}

.block-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.block-item {
  padding: 4px 10px;
  cursor: pointer;
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.block-item:hover {
  background: #2a2d2e;
}

.block-item.selected {
  background: #094771;
}

.block-type {
  color: #569cd6;
}

.block-id {
  color: #888;
}

.empty-hint {
  color: #666;
  font-size: 12px;
  text-align: center;
  padding: 20px;
}
</style>
