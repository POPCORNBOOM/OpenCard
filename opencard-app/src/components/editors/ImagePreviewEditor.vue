<template>
  <div class="image-preview-editor">
    <div v-if="imageSrc" class="image-preview-stage">
      <img class="image-preview" :src="imageSrc" :alt="fileName" @load="handleLoad" @error="handleError" />
    </div>
    <div v-if="loadError" class="image-preview-empty">
      <div class="empty-title">无法预览图片</div>
      <div class="empty-subtitle">{{ fileName }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { EditorEmits, EditorProps } from '../../core/Editor'
import { useProjectStore } from '../../stores/projectStore'

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
  width: 100%;
  height: 100%;
  display: flex;
  background: #1e1e1e;
}

.image-preview-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: auto;
  background-image:
    linear-gradient(45deg, rgba(255, 255, 255, 0.04) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255, 255, 255, 0.04) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.04) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.04) 75%);
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #b3b3b3;
}

.empty-title {
  font-size: 14px;
  color: #d4d4d4;
}

.empty-subtitle {
  font-size: 12px;
  color: #8c8c8c;
}
</style>
