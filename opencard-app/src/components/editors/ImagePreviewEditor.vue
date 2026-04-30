<!-- 图片预览编辑器：将外部资源按 contain 规则缩放到可视区域内。 -->
<template>
  <OcPanel
    fill
    padding="none"
    border="none"
    background="checker"
    overflow-x="clip"
    overflow-y="clip"
    horizontal-alignment="center"
    vertical-alignment="center"
  >
    <img
      v-if="imageSrc && !loadError"
      class="image-preview"
      :src="imageSrc"
      :alt="fileName"
      @load="handleLoad"
      @error="handleError"
    />
    <template v-else>
      <OcText tone="secondary" size="title">无法预览图片</OcText>
      <OcText tone="secondary">{{ fileName }}</OcText>
    </template>
  </OcPanel>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import OcPanel from '../base/OcPanel.vue';
import OcText from '../base/OcText.vue';

/** 输入协议：filePath 指向当前待预览的图片资源。 */
const props = defineProps<EditorProps>()
/** 输出协议：save 转发保存意图，modified 同步当前预览状态。 */
const emit = defineEmits<EditorEmits>()

const { resolveAssetSrc } = useProjectStore()

const imageSrc = computed(() => resolveAssetSrc(props.filePath))
const fileName = computed(() => props.filePath.split(/[/\\]/).pop() || props.filePath)
const loadFailed = ref(false)
const loadError = computed(() => !imageSrc.value || loadFailed.value)

watch(imageSrc, () => {
  loadFailed.value = false
})

function handleLoad() {
  loadFailed.value = false
  emit('modified', false)
}

function handleError() {
  loadFailed.value = true
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
.image-preview {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
</style>
