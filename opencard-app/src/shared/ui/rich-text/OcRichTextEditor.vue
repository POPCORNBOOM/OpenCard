<template>
  <div class="oc-rich-text-editor">
    <div v-if="editor" class="oc-rich-text-editor__toolbar" role="toolbar" aria-label="Text formatting">
      <OcButton size="sm" icon-only icon="action.undo" title="撤销"
        :disabled="!editor.can().chain().focus().undo().run()" @mousedown.prevent @click="editor.chain().focus().undo().run()" />
      <OcButton size="sm" icon-only icon="action.redo" title="重做"
        :disabled="!editor.can().chain().focus().redo().run()" @mousedown.prevent @click="editor.chain().focus().redo().run()" />

      <select class="oc-rich-text-editor__font" title="字体" :value="activeFontFamily" @change="setFontFamily">
        <option value="">默认字体</option>
        <option v-for="font in fontFamilies" :key="font.value" :value="font.value">
          {{ font.label }}
        </option>
      </select>

      <OcButton size="sm" :active="editor.isActive('bold')" title="粗体" @mousedown.prevent
        @click="editor.chain().focus().toggleBold().run()"><strong>B</strong></OcButton>
      <OcButton size="sm" :active="editor.isActive('italic')" title="斜体" @mousedown.prevent
        @click="editor.chain().focus().toggleItalic().run()"><em>I</em></OcButton>
      <OcButton v-if="bindingCompletion" size="sm" title="插入 binding" @mousedown.prevent
        @click="insertBinding">&#123;&#123; &#125;&#125;</OcButton>

      <label class="oc-rich-text-editor__swatch" title="前景色">
        <span class="oc-rich-text-editor__swatch-label">A</span>
        <input type="color" :value="foregroundColor" @input="setForegroundColor">
      </label>
      <label class="oc-rich-text-editor__swatch" title="文字背景色">
        <span class="oc-rich-text-editor__swatch-label oc-rich-text-editor__swatch-label--background">A</span>
        <input type="color" :value="backgroundColor" @input="setBackgroundColor">
      </label>
      <label class="oc-rich-text-editor__swatch" title="描边颜色">
        <span class="oc-rich-text-editor__swatch-label oc-rich-text-editor__swatch-label--stroke">A</span>
        <input type="color" :value="strokeColor" @input="setStrokeColor">
      </label>
      <select class="oc-rich-text-editor__stroke-width" title="描边宽度" :value="strokeWidth" @change="setStrokeWidth">
        <option value="0px">无描边</option>
        <option value="0.5px">0.5 px</option>
        <option value="1px">1 px</option>
        <option value="1.5px">1.5 px</option>
        <option value="2px">2 px</option>
        <option value="3px">3 px</option>
      </select>

      <OcButton v-for="alignment in alignments" :key="alignment.value" size="sm" icon-only
        :icon="alignment.icon" :title="alignment.title" :active="editor.isActive({ textAlign: alignment.value })"
        @mousedown.prevent @click="editor.chain().focus().setTextAlign(alignment.value).run()" />
      <OcButton size="sm" icon-only icon="action.discard" title="清除字符格式" @mousedown.prevent
        @click="editor.chain().focus().unsetAllMarks().run()" />
    </div>

    <EditorContent :editor="editor" class="oc-rich-text-editor__surface" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Extension } from '@tiptap/core'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import OcButton from '../../../components/base/OcButton.vue'
import type { IconToken } from '../icon/iconRegistry'
import { BindingNode } from './BindingNode'
import type { RichTextBindingCompletionProvider } from './bindingNode.types'
import { normalizeRichTextHtml } from './sanitizeRichTextHtml'

const props = defineProps<{
  modelValue: string
  bindingCompletion?: RichTextBindingCompletionProvider
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const lastEmittedValue = ref<string | null>(null)

const TextStroke = Extension.create({
  name: 'textStroke',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        textStrokeColor: {
          default: null,
          parseHTML: element => element.style.webkitTextStrokeColor || null,
          renderHTML: attributes => attributes.textStrokeColor
            ? { style: `-webkit-text-stroke-color: ${attributes.textStrokeColor}` }
            : {},
        },
        textStrokeWidth: {
          default: null,
          parseHTML: element => element.style.webkitTextStrokeWidth || null,
          renderHTML: attributes => attributes.textStrokeWidth && attributes.textStrokeWidth !== '0px'
            ? { style: `-webkit-text-stroke-width: ${attributes.textStrokeWidth}` }
            : {},
        },
      },
    }]
  },
})

const fontFamilies = [
  { label: 'Arial', value: 'Arial' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Impact', value: 'Impact' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: '宋体', value: 'SimSun' },
] as const

const alignments: ReadonlyArray<{
  value: 'left' | 'center' | 'right' | 'justify'
  icon: IconToken
  title: string
}> = [
  { value: 'left', icon: 'format.align-start', title: '左对齐' },
  { value: 'center', icon: 'format.align-center', title: '居中' },
  { value: 'right', icon: 'format.align-end', title: '右对齐' },
  { value: 'justify', icon: 'format.align-justify', title: '两端对齐' },
]

const foregroundColor = computed(() => editor.value?.getAttributes('textStyle').color || '#24292f')
const backgroundColor = computed(() => editor.value?.getAttributes('highlight').color || '#fff59d')
const strokeColor = computed(() => editor.value?.getAttributes('textStyle').textStrokeColor || '#000000')
const strokeWidth = computed(() => editor.value?.getAttributes('textStyle').textStrokeWidth || '0px')
const activeFontFamily = computed(() => editor.value?.getAttributes('textStyle').fontFamily || '')

const editor = useEditor({
  content: normalizeRichTextHtml(props.modelValue),
  extensions: [
    StarterKit.configure({
      blockquote: false,
      bulletList: false,
      codeBlock: false,
      heading: false,
      horizontalRule: false,
      orderedList: false,
    }),
    TextStyle,
    Color,
    FontFamily,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['paragraph'] }),
    TextStroke,
    BindingNode.configure({
      completion: request => props.bindingCompletion?.(request) ?? null,
    }),
  ],
  editorProps: {
    attributes: {
      class: 'oc-rich-text-editor__content',
      spellcheck: 'true',
    },
  },
  onUpdate: ({ editor: currentEditor }) => {
    const value = currentEditor.getHTML()
    lastEmittedValue.value = value
    emit('update:modelValue', value)
  },
})

watch(() => props.modelValue, (value) => {
  if (value === lastEmittedValue.value) {
    lastEmittedValue.value = null
    return
  }
  lastEmittedValue.value = null
  const currentEditor = editor.value
  if (!currentEditor) return
  const normalizedValue = normalizeRichTextHtml(value)
  if (currentEditor.getHTML() === normalizedValue) return
  currentEditor.commands.setContent(normalizedValue, false)
})

function eventValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement).value
}

function setFontFamily(event: Event): void {
  const value = eventValue(event)
  const chain = editor.value?.chain().focus()
  if (!chain) return
  if (value) chain.setFontFamily(value).run()
  else chain.unsetFontFamily().run()
}

function setForegroundColor(event: Event): void {
  editor.value?.chain().focus().setColor(eventValue(event)).run()
}

function setBackgroundColor(event: Event): void {
  editor.value?.chain().focus().setHighlight({ color: eventValue(event) }).run()
}

function setStrokeColor(event: Event): void {
  editor.value?.chain().focus().setMark('textStyle', {
    textStrokeColor: eventValue(event),
    textStrokeWidth: strokeWidth.value,
  }).run()
}

function setStrokeWidth(event: Event): void {
  const value = eventValue(event)
  editor.value?.chain().focus().setMark('textStyle', {
    textStrokeColor: value === '0px' ? null : strokeColor.value,
    textStrokeWidth: value === '0px' ? null : value,
  }).run()
}

function insertBinding(): void {
  editor.value?.chain().focus().insertContent({
    type: 'binding',
    attrs: { expression: '' },
  }).run()
}

function focus(): void {
  editor.value?.commands.focus('end', { scrollIntoView: false })
}

defineExpose({ editor, focus })
</script>

<style scoped>
.oc-rich-text-editor {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  flex-direction: column;
  background: var(--oc-bg-input);
}

.oc-rich-text-editor__toolbar {
  display: flex;
  min-height: var(--oc-size-md);
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
  padding: 2px;
  overflow-x: auto;
  border-bottom: 1px solid var(--oc-border-default);
}

.oc-rich-text-editor__font,
.oc-rich-text-editor__stroke-width {
  height: var(--oc-size-sm);
  flex: 0 0 auto;
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-sm);
  background: var(--oc-bg-input);
  color: var(--oc-fg-default);
  font-size: var(--oc-text-sm);
}

.oc-rich-text-editor__font {
  width: 108px;
}

.oc-rich-text-editor__stroke-width {
  width: 70px;
}

.oc-rich-text-editor__swatch {
  position: relative;
  display: grid;
  width: var(--oc-size-sm);
  height: var(--oc-size-sm);
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-sm);
  cursor: pointer;
  overflow: hidden;
}

.oc-rich-text-editor__swatch input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.oc-rich-text-editor__swatch-label {
  font-weight: 700;
  line-height: 1;
  text-decoration: underline;
  text-decoration-color: v-bind(foregroundColor);
  text-decoration-thickness: 3px;
}

.oc-rich-text-editor__swatch-label--background {
  padding: 1px 2px;
  background: v-bind(backgroundColor);
  text-decoration: none;
}

.oc-rich-text-editor__swatch-label--stroke {
  color: var(--oc-bg-input);
  text-decoration: none;
  -webkit-text-stroke: 1px v-bind(strokeColor);
}

.oc-rich-text-editor__surface {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
}

.oc-rich-text-editor__surface :deep(.oc-rich-text-editor__content) {
  min-height: 100%;
  padding: var(--oc-space-2);
  outline: none;
  color: var(--oc-fg-default);
  overflow-wrap: anywhere;
}

.oc-rich-text-editor__surface :deep(p) {
  margin: 0;
}

.oc-rich-text-editor__surface :deep(p + p) {
  margin-top: 0.35em;
}
</style>
