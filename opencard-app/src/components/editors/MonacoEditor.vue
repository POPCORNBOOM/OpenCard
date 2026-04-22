<template>
  <div class="monaco-editor-shell">
    <header class="monaco-editor-shell__header">
      <div class="monaco-editor-shell__eyebrow">{{ t('panels.codeEditor') }}</div>
      <div class="monaco-editor-shell__language">{{ normalizedLanguage }}</div>
    </header>
    <div class="monaco-editor-shell__surface">
      <div ref="editorContainer" class="monaco-editor-host"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import * as monaco from 'monaco-editor'

const props = defineProps<{
  modelValue: string
  language?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'save': []
}>()

const { t } = useI18n()
const editorContainer = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null
const normalizedLanguage = computed(() => (props.language || 'txt').toUpperCase())

onMounted(() => {
  if (!editorContainer.value) return

  editor = monaco.editor.create(editorContainer.value, {
    value: props.modelValue,
    language: props.language || 'txt',
    theme: 'vs-dark',
    automaticLayout: true,
    fontSize: 14,
    minimap: { enabled: true },
    scrollBeyondLastLine: false
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

// 监听外部内容变化
watch(() => props.modelValue, (newValue) => {
  if (editor && newValue !== editor.getValue()) {
    editor.setValue(newValue)
  }
})

onUnmounted(() => {
  editor?.dispose()
})
</script>

<style scoped>
.monaco-editor-shell {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 10px;
  border: 1px solid var(--oc-border-strong);
  border-radius: 16px;
  background: linear-gradient(180deg, var(--oc-bg-panel) 0%, var(--oc-bg-subtle) 100%);
  box-shadow: var(--oc-shadow-md);
  overflow: hidden;
}

.monaco-editor-shell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oc-space-2);
  padding: 4px 4px 10px;
}

.monaco-editor-shell__eyebrow {
  font-size: var(--oc-label-size);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--oc-text-info);
}

.monaco-editor-shell__language {
  font-size: var(--oc-label-size);
  color: var(--oc-text-secondary);
  padding: 4px 8px;
  border-radius: var(--oc-radius-pill);
  background: var(--oc-bg-panel);
  border: 1px solid var(--oc-border-subtle);
}

.monaco-editor-shell__surface {
  flex: 1;
  min-width: 0;
  min-height: 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--oc-border-default);
  background: var(--oc-bg-elevated);
}

.monaco-editor-host {
  width: 100%;
  height: 100%;
}
</style>
