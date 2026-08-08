<template>
  <div class="monaco-editor-shell" :class="{ 'is-comparison': Boolean(comparison) }">
    <div ref="editorContainer" class="monaco-editor-host"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import * as monaco from 'monaco-editor'
import type { OcThemeColorOverrides, OcThemeId } from '../../shared/ui/foundation'
import { registerOcMonacoTheme } from '../../features/editor-runtime/services/monacoTheme'
import type { TextEditorComparison } from '../../features/editor-runtime/model/editorComparison'

const props = withDefaults(defineProps<{
  modelValue: string
  language?: string
  themeId?: OcThemeId
  themeOverrides?: OcThemeColorOverrides
  readOnly?: boolean
  comparison?: TextEditorComparison
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
let diffEditor: monaco.editor.IStandaloneDiffEditor | null = null
let historicalModel: monaco.editor.ITextModel | null = null
let currentModel: monaco.editor.ITextModel | null = null

function editorOptions(appearance: ReturnType<typeof registerOcMonacoTheme>) {
  return {
    theme: appearance.themeName,
    automaticLayout: true,
    fontFamily: appearance.fontFamily,
    fontSize: 13,
    lineHeight: 20,
    padding: { top: 8, bottom: 8 },
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    overviewRulerBorder: false,
    renderLineHighlight: 'all' as const,
    roundedSelection: false,
    smoothScrolling: true,
    cursorSmoothCaretAnimation: 'on' as const,
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
  }
}

onMounted(() => {
  if (!editorContainer.value) return

  const appearance = registerOcMonacoTheme(monaco, props.themeId, props.themeOverrides)
  const options = editorOptions(appearance)
  if (props.comparison) {
    historicalModel = monaco.editor.createModel(props.comparison.historicalContent, props.language)
    currentModel = monaco.editor.createModel(props.comparison.currentContent, props.language)
    diffEditor = monaco.editor.createDiffEditor(editorContainer.value, {
      ...options,
      readOnly: true,
      originalEditable: false,
      renderSideBySide: true,
      hideUnchangedRegions: { enabled: false },
    })
    diffEditor.setModel({ original: historicalModel, modified: currentModel })
    return
  }
  editor = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: props.language,
    ...options,
    readOnly: props.readOnly,
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
  if (!newLang) return
  const model = editor?.getModel()
  if (model) monaco.editor.setModelLanguage(model, newLang)
  if (historicalModel) monaco.editor.setModelLanguage(historicalModel, newLang)
  if (currentModel) monaco.editor.setModelLanguage(currentModel, newLang)
})

watch(() => props.readOnly, (readOnly) => {
  editor?.updateOptions({ readOnly })
})

watch(() => [props.themeId, props.themeOverrides] as const, ([themeId, themeOverrides]) => {
  const appearance = registerOcMonacoTheme(monaco, themeId, themeOverrides)
  monaco.editor.setTheme(appearance.themeName)
  editor?.updateOptions({ fontFamily: appearance.fontFamily })
  diffEditor?.updateOptions({ fontFamily: appearance.fontFamily })
})

watch(() => props.comparison, (comparison) => {
  if (!comparison) return
  if (historicalModel?.getValue() !== comparison.historicalContent) {
    historicalModel?.setValue(comparison.historicalContent)
  }
  if (currentModel?.getValue() !== comparison.currentContent) {
    currentModel?.setValue(comparison.currentContent)
  }
}, { deep: true })

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
  diffEditor?.dispose()
  historicalModel?.dispose()
  currentModel?.dispose()
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
