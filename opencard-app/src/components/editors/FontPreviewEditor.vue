<template>
  <section class="font-preview-editor" :aria-label="t('fontPreview.title', { name: displayName })">
    <header class="font-preview-editor__header">
      <OcIcon name="file.font" tone="primary" size="lg" />
      <div class="font-preview-editor__identity">
        <h1>{{ displayName }}</h1>
        <OcText tone="muted">{{ t('fontPreview.subtitle') }}</OcText>
      </div>
    </header>

    <div v-if="loading" class="font-preview-editor__status">
      <OcText tone="muted">{{ t('fontPreview.loading') }}</OcText>
    </div>
    <div v-else-if="loadFailed" class="font-preview-editor__status">
      <OcText tone="danger" role="alert">{{ t('fontPreview.loadFailed') }}</OcText>
    </div>
    <main v-else class="font-preview-editor__workspace">
      <label for="font-preview-input">{{ t('fontPreview.tryLabel') }}</label>
      <OcFieldInput
        id="font-preview-input"
        class="font-preview-editor__input"
        as="textarea"
        full-width
        :value="previewText"
        :placeholder="t('fontPreview.tryPlaceholder')"
        :style="specimenStyle"
        @input="previewText = ($event.target as HTMLTextAreaElement).value"
      />
    </main>
    <footer v-if="!loading && !loadFailed" class="font-preview-editor__reference">
      <OcText tone="muted">{{ t('fontPreview.characterSet') }}</OcText>
      <p :style="specimenStyle">Aa Bb Cc　0123456789　，。！？　天地玄黄</p>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, type CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'

defineOptions({ name: 'FontPreviewEditor' })

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const previewFamily = `OpenCardFontPreview-${crypto.randomUUID()}`
const loading = ref(true)
const loadFailed = ref(false)
const previewText = ref(t('fontPreview.sample'))
let loadedFace: FontFace | null = null
let fontObjectUrl: string | null = null
let loadVersion = 0

const displayName = computed(() => props.fileName || props.filePath.split(/[/\\]/).pop() || props.filePath)
const specimenStyle = computed<CSSProperties>(() => ({ fontFamily: previewFamily }))
const absolutePath = computed(() => {
  if (/^[a-z]:[/\\]/i.test(props.filePath) || props.filePath.startsWith('/')) return props.filePath
  const root = props.resourceRootPath?.replace(/[/\\]+$/, '')
  return root ? `${root}/${props.filePath}` : props.filePath
})

function removeLoadedFace(): void {
  if (loadedFace) {
    document.fonts.delete(loadedFace)
    loadedFace = null
  }
  if (fontObjectUrl) {
    URL.revokeObjectURL(fontObjectUrl)
    fontObjectUrl = null
  }
}

async function loadFont(): Promise<void> {
  const version = ++loadVersion
  removeLoadedFace()
  loading.value = true
  loadFailed.value = false

  try {
    const bytes = await fileSystemService.readBinaryFile(absolutePath.value)
    const blob = new Blob([new Uint8Array(bytes)], { type: resolveFontMimeType(props.filePath) })
    const source = URL.createObjectURL(blob)
    if (version !== loadVersion) {
      URL.revokeObjectURL(source)
      return
    }
    fontObjectUrl = source
    const face = await new FontFace(previewFamily, `url(${JSON.stringify(source)})`).load()
    if (version !== loadVersion) return
    loadedFace = face
    document.fonts.add(face)
  } catch {
    if (version === loadVersion) {
      removeLoadedFace()
      loadFailed.value = true
    }
  } finally {
    if (version === loadVersion) {
      loading.value = false
      emit('modified', false)
    }
  }
}

function resolveFontMimeType(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase()
  if (extension === 'woff2') return 'font/woff2'
  if (extension === 'woff') return 'font/woff'
  if (extension === 'otf') return 'font/otf'
  return 'font/ttf'
}

watch(() => props.filePath, () => void loadFont(), { immediate: true })

onBeforeUnmount(() => {
  loadVersion += 1
  removeLoadedFace()
})
</script>

<style scoped>
.font-preview-editor {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  background: var(--oc-bg-base);
  color: var(--oc-fg-default);
}

.font-preview-editor__header {
  display: flex;
  align-items: center;
  gap: var(--oc-space-3);
  padding: var(--oc-space-3) var(--oc-space-4);
  border-bottom: var(--oc-border-width) solid var(--oc-border-muted);
  background: var(--oc-bg-raised);
}

.font-preview-editor__identity {
  min-width: 0;
}

.font-preview-editor__identity h1 {
  margin: 0 0 var(--oc-space-1);
  overflow: hidden;
  font-size: var(--oc-text-lg);
  font-weight: var(--font-weight-ui-title);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-preview-editor__status {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: var(--oc-space-5);
}

.font-preview-editor__workspace {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--oc-space-2);
  min-height: 0;
  padding: var(--oc-space-5);
}

.font-preview-editor__workspace label {
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
}

.font-preview-editor__input {
  height: 100%;
  min-height: 0;
  padding: var(--oc-space-5);
  font-size: var(--oc-font-preview-size);
  line-height: normal;
}

.font-preview-editor__reference {
  display: grid;
  gap: var(--oc-space-2);
  padding: var(--oc-space-3) var(--oc-space-5);
  overflow: hidden;
  border-top: var(--oc-border-width) solid var(--oc-border-muted);
  background: var(--oc-bg-raised);
}

.font-preview-editor__reference p {
  margin: 0;
  overflow-x: auto;
  color: var(--oc-fg-default);
  font-size: var(--oc-text-xl);
  white-space: nowrap;
}
</style>
