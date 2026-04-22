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
  <div class="image-preview-editor">
    <header class="image-preview-header">
      <div class="image-preview-header__eyebrow">{{ t('fileTypes.image') }}</div>
      <div class="image-preview-header__name">{{ fileName }}</div>
    </header>
    <div class="image-preview-body">
      <div v-if="imageSrc" class="image-preview-stage image-preview-stage--checkerboard">
        <img class="image-preview" :src="imageSrc" :alt="fileName" @load="handleLoad" @error="handleError" />
      </div>
      <div v-if="loadError" class="image-preview-empty">
        <div class="empty-title">无法预览图片</div>
        <div class="empty-subtitle">{{ fileName }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import { useProjectStore } from '../../features/workspace/store/projectStore'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()

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
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--oc-border-strong);
  border-radius: 16px;
  background: var(--oc-bg-panel);
  box-shadow: var(--oc-shadow-md);
}

.image-preview-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--oc-border-subtle);
  background: linear-gradient(180deg, var(--oc-bg-panel) 0%, var(--oc-bg-subtle) 100%);
}

.image-preview-header__eyebrow {
  font-size: var(--oc-label-size);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--oc-text-info);
}

.image-preview-header__name {
  font-size: var(--oc-title-size);
  color: var(--oc-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-preview-body {
  flex: 1;
  min-height: 0;
  display: flex;
  background: linear-gradient(180deg, var(--oc-bg-subtle) 0%, var(--oc-bg-base) 100%);
}

.image-preview-stage {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--oc-space-6);
}

.image-preview-stage--checkerboard {
  background-size: 24px 24px;
  background-position: 0 0, 0 12px, 12px -12px, -12px 0;
  background-image:
    linear-gradient(45deg, var(--oc-bg-checker-soft) 25%, transparent 25%),
    linear-gradient(-45deg, var(--oc-bg-checker-soft) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--oc-bg-checker-soft) 75%),
    linear-gradient(-45deg, transparent 75%, var(--oc-bg-checker-soft) 75%);
}

.image-preview {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: var(--oc-shadow-overlay);
}

.image-preview-empty {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--oc-space-2);
  color: var(--oc-text-secondary);
}

.empty-title {
  font-size: var(--oc-title-size);
  color: var(--oc-text-highlight);
}

.empty-subtitle {
  font-size: var(--oc-body-size);
  color: var(--oc-text-secondary);
  text-align: center;
}
</style>
