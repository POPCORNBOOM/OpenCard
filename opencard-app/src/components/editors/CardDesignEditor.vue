<template>
  <div class="card-design-editor">
    <!-- 左侧：可视化画布 -->
    <div class="canvas-area">
      <div class="canvas-scroll">
        <!-- 可视化画布 -->
        <CardRenderer v-if="cardDoc" :document="cardDoc" />
        <div class="empty-hint">无法解析 .opencard 文件</div>
      </div>
    </div>

    <!-- 右侧面板 -->
    <div class="right-panel">
      <!-- 上方：CardDocument 属性树 -->
      <div class="block-list-panel">
        <div class="panel-header">信息树</div>
        <div class="block-list">
          <NodeTree title="元素块" :nodes="blockTree" :selected="selectedBlocks" @update:selected="onTreeSelect" :actions="[
            { icon: 'codicon-add', title: '添加', handler: () => addBlock() },
            { icon: 'codicon-trash', title: '删除', handler: () => deleteBlock() },
          ]" />
        </div>
      </div>

      <!-- 下方：属性编辑器 -->
      <div class="property-panel">
        <div class="panel-header">属性</div>
        <div class="property-editor">

          <div v-if="!selectedBlocks" class="empty-hint">选择一个 Block 查看属性</div>
          <template v-else>
            <div v-for="(value, key) in selectedObjectProps" :key="key" class="prop-row">
              <label class="prop-label">{{ key }}</label>
              <input class="prop-input" :value="value"
                @input="updateBlockProp(key as string, ($event.target as HTMLInputElement).value)" />
            </div>
          </template><!---->
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { EditorProps, EditorEmits } from '../../core/Editor'
import { type CardDocument, type CardBlock, block2ITreeNode } from '../../core/Card'
import { fileSystemService } from '../../services/fileSystemService'
import CardRenderer from '../card/CardRenderer.vue'
import NodeTree from '../ui/NodeTree.vue'
import type { ITreeNode } from '../ui/TreeNode.vue'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()

const rawContent = ref('')
const cardDoc = ref<CardDocument | null>(null)
const isModified = ref(false)

const selectedBlocks = ref<Map<string, ITreeNode>>(new Map())

const selectedObjectProps = computed(() => {
  if (selectedBlocks.value.size === 0) return null
  // 这里只展示第一个选中块的属性
  const firstBlockNode = selectedBlocks.value.values().next().value
  return firstBlockNode?.metadata
})

function updateBlockProp(key: string, value: any) {
  if (selectedBlocks.value.size === 0) return
  const firstBlockNode = selectedBlocks.value.values().next().value
  if (!firstBlockNode) return
  const block = firstBlockNode.metadata as CardBlock
  // @ts-ignore
  block[key] = value
  isModified.value = true
}


function onTreeSelect(newSelected: Map<string, ITreeNode>) {
  console.log('选中块:', Array.from(newSelected.values()).map(n => n.key))
  selectedBlocks.value = newSelected
}


// BlockTree 相关
const blockTree = computed(() => {
  if (!cardDoc.value) return []
  return cardDoc.value.blocks.map(block2ITreeNode)
})

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
  //todo
}
const deleteBlock = () => {
  //todo
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
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
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
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  height: 30px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  font-size: 11px;
  text-transform: uppercase;
  font-weight: bold;
  background: #252526;
  border-bottom: 1px solid #000;
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

.property-editor {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-hint {
  color: #666;
  font-size: 12px;
  text-align: center;
  padding: 20px;
}

.prop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}

.prop-label {
  font-size: 11px;
  color: #9cdcfe;
  min-width: 80px;
  flex-shrink: 0;
}

.prop-input {
  flex: 1;
  background: #3c3c3c;
  border: 1px solid #555;
  color: #ccc;
  padding: 2px 6px;
  font-size: 12px;
  min-width: 0;
}

.prop-input:focus {
  border-color: #007acc;
  outline: none;
}
</style>