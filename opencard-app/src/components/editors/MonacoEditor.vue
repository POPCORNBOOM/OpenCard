<template>
  <div class="monaco-editor-shell">
    <div ref="editorContainer" class="monaco-editor-host"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import * as monaco from 'monaco-editor'
import type { OcThemeColorOverrides, OcThemeId } from '../../shared/ui/foundation'
import { registerOcMonacoTheme } from '../../features/editor-runtime/services/monacoTheme'
import { editorHistoryManager } from '../../features/editor-runtime/history/editorHistoryManager'
import type { HistoryOperationMeta } from '../../features/editor-runtime/history/structuredHistory'

const props = withDefaults(defineProps<{
  modelValue: string
  sessionId?: string
  language?: string
  themeId?: OcThemeId
  themeOverrides?: OcThemeColorOverrides
  readOnly?: boolean
}>(), {
  language: 'plaintext',
  themeId: 'dark',
})

const emit = defineEmits<{
  'update:modelValue': [value: string, history?: HistoryOperationMeta]
  'save': []
}>()

const editorContainer = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

onMounted(() => {
  if (!editorContainer.value) return

  const appearance = registerOcMonacoTheme(monaco, props.themeId, props.themeOverrides)
  const sessionModel = props.sessionId ? editorHistoryManager.getMonacoModel(props.sessionId) : null
  const managedModel = sessionModel ?? (props.sessionId
    ? monaco.editor.createModel(
        props.modelValue,
        props.language,
        monaco.Uri.parse(`inmemory://opencard/${props.sessionId}`),
      )
    : null)
  if (props.sessionId && managedModel && !sessionModel) {
    editorHistoryManager.attachMonacoModel(props.sessionId, managedModel)
  }
  editor = monaco.editor.create(editorContainer.value, {
    ...(managedModel ? { model: managedModel } : { value: props.modelValue }),
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
    readOnly: props.readOnly,
    cursorSmoothCaretAnimation: 'on',
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
  })

  // 监听内容变化
  if (!managedModel) {
    editor.onDidChangeModelContent(() => {
      emit('update:modelValue', editor?.getValue() || '', {
        mode: 'debounced',
        merge: { family: 'source-edit', target: 'document-source' },
      })
    })
  }

  if (props.sessionId) {
    const viewState = editorHistoryManager.getMonacoViewState(props.sessionId)
    if (viewState) editor.restoreViewState(viewState)
  }

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

watch(() => props.readOnly, (readOnly) => {
  editor?.updateOptions({ readOnly })
})

watch(() => [props.themeId, props.themeOverrides] as const, ([themeId, themeOverrides]) => {
  const appearance = registerOcMonacoTheme(monaco, themeId, themeOverrides)
  monaco.editor.setTheme(appearance.themeName)
  editor?.updateOptions({ fontFamily: appearance.fontFamily })
})

// 监听外部内容变化
watch(() => props.modelValue, (newValue) => {
  if (props.sessionId && editorHistoryManager.getMonacoModel(props.sessionId) === editor?.getModel()) return
  if (editor && newValue !== editor.getValue()) {
    editor.setValue(newValue)
  }
})

onUnmounted(() => {
  const model = editor?.getModel()
  if (props.sessionId) editorHistoryManager.setMonacoViewState(props.sessionId, editor?.saveViewState() ?? null)
  editor?.dispose()
  if (!props.sessionId) model?.dispose()
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
