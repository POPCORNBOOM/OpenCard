<!--
  使用说明：
  - 输入 `filePath` 指向当前图片资源路径
  - 由外层通过编辑器协议触发 `save` 与会话状态同步

  职责边界：
  - 负责图片预览展示与加载结果反馈
  - 只上抛保存与修改状态 不处理文件读写

  主要输出事件：
  - `modified`（同步预览状态）
  - `save`（转发保存意图）
-->
<template>
  <div class="image-preview-editor oc-panel-body">
    <div v-if="imageSrc" class="image-preview-stage oc-stage-surface oc-checkerboard-stage">
      <img class="image-preview" :src="imageSrc" :alt="fileName" @load="handleLoad" @error="handleError" />
    </div>
    <div v-if="loadError" class="image-preview-empty oc-empty-state">
      <div class="empty-title">无法预览图片</div>
      <div class="empty-subtitle">{{ fileName }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import { useProjectStore } from '../../features/workspace/store/projectStore'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()

const { resolveAssetSrc } = useProjectStore()

const imageSrc = computed(() => resolveAssetSrc(props.filePath))
const fileName = computed(() => props.filePath.split(/[/\\]/).pop() || props.filePath)
const loadError = computed(() => !imageSrc.value)

function handleLoad() {
  emit('modified', false)
}

function handleError() {
  emit('modified', false)
}

function save() {
  emit('save')
}

onMounted(() => {
  emit('modified', false)
})

defineExpose({ save })
</script>

<style scoped>
.image-preview-editor {
  background: var(--oc-bg-base);
}

.image-preview-stage {
  flex: 1;
  padding: 24px;
  background-size: 24px 24px;
  background-position: 0 0, 0 12px, 12px -12px, -12px 0;
}

.image-preview {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
}

.image-preview-empty {
  flex: 1;
  gap: 8px;
  color: #b3b3b3;
}

.empty-title {
  font-size: 14px;
  color: var(--oc-text-highlight);
}

.empty-subtitle {
  font-size: 12px;
  color: var(--oc-text-secondary);
}
</style>
