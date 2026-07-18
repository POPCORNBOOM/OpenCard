<template>
  <div class="monaco-editor-shell">
    <div ref="editorContainer" class="monaco-editor-host"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import * as monaco from 'monaco-editor'
import type { OcThemeId } from '../../shared/ui/foundation'
import { registerOcMonacoTheme } from '../../features/editor-runtime/services/monacoTheme'

const props = withDefaults(defineProps<{
  modelValue: string
  language?: string
  themeId?: OcThemeId
}>(), {
  language: 'plaintext',
  themeId: 'dark',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'save': []
}>()

const editorContainer = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

onMounted(() => {
  if (!editorContainer.value) return

  const appearance = registerOcMonacoTheme(monaco, props.themeId)
  editor = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: props.language,
    theme: appearance.themeName,
    automaticLayout: true,
    fontFamily: appearance.fontFamily,
    fontSize: 13,
    lineHeight: 20,
    padding: { top: 8, bottom: 8 },
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    overviewRulerBorder: false,
    renderLineHighlight: 'all',
    roundedSelection: false,
    smoothScrolling: true,
    cursorSmoothCaretAnimation: 'on',
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
  })

  // 监听内容变化
  editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor?.getValue() || '')
  })

  // 监听保存快捷键 (Ctrl+S / Cmd+S)
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    emit('save')
  })
})

// 监听语言变化
watch(() => props.language, (newLang) => {
  if (editor && newLang) {
    const model = editor.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, newLang)
    }
  }
})

watch(() => props.themeId, (themeId) => {
  const appearance = registerOcMonacoTheme(monaco, themeId)
  monaco.editor.setTheme(appearance.themeName)
  editor?.updateOptions({ fontFamily: appearance.fontFamily })
})

// 监听外部内容变化
watch(() => props.modelValue, (newValue) => {
  if (editor && newValue !== editor.getValue()) {
    editor.setValue(newValue)
  }
})

onUnmounted(() => {
  const model = editor?.getModel()
  editor?.dispose()
  model?.dispose()
})
</script>

<style scoped>
.monaco-editor-shell {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--oc-bg-raised);
}

.monaco-editor-host {
  width: 100%;
  height: 100%;
}
</style>
