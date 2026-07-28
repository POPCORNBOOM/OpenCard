<template>
  <div class="oc-rich-text-editor">
    <div v-if="editor" class="oc-rich-text-editor__toolbar" role="toolbar" aria-label="Text formatting">
      <div class="oc-rich-text-editor__tool-group" role="group" aria-label="历史">
        <OcButton size="md" icon-only icon="action.undo" data-tooltip="撤销" aria-label="撤销"
          :disabled="!editor.can().chain().focus().undo().run()" @mousedown.prevent @click="editor.chain().focus().undo().run()" />
        <OcButton size="md" icon-only icon="action.redo" data-tooltip="重做" aria-label="重做"
          :disabled="!editor.can().chain().focus().redo().run()" @mousedown.prevent @click="editor.chain().focus().redo().run()" />
      </div>

      <div class="oc-rich-text-editor__tool-group" role="group" aria-label="字体">
        <OcSelect class="oc-rich-text-editor__font" data-tooltip="字体" aria-label="字体"
          :model-value="activeFontFamily" :options="fontOptions" :z-index="2500"
          @update:model-value="setFontFamily" />
        <OcButton size="md" icon-only icon="format.font-size-decrease" data-tooltip="减小字号" aria-label="减小字号"
          @mousedown.prevent @click="adjustFontSize(-1)" />
        <OcButton size="md" icon-only icon="format.font-size-increase" data-tooltip="增大字号" aria-label="增大字号"
          @mousedown.prevent @click="adjustFontSize(1)" />
        <OcButton size="md" icon-only icon="format.bold"
          :active="editor.isActive('bold')" data-tooltip="粗体" aria-label="粗体" @mousedown.prevent
          @click="editor.chain().focus().toggleBold().run()" />
        <OcButton size="md" icon-only icon="format.italic"
          :active="editor.isActive('italic')" data-tooltip="斜体" aria-label="斜体" @mousedown.prevent
          @click="editor.chain().focus().toggleItalic().run()" />
        <OcButton size="md" icon-only icon="format.underline"
          :active="editor.isActive('underline')" data-tooltip="下划线" aria-label="下划线" @mousedown.prevent
          @click="editor.chain().focus().toggleUnderline().run()" />
        <OcButton size="md" icon-only icon="format.strikethrough"
          :active="editor.isActive('strike')" data-tooltip="删除线" aria-label="删除线" @mousedown.prevent
          @click="editor.chain().focus().toggleStrike().run()" />
        <OcButton v-if="bindingCompletion" size="md" icon-only icon="format.code-braces"
          data-tooltip="插入 binding" aria-label="插入 binding" @mousedown.prevent @click="insertBinding" />
      </div>

      <div class="oc-rich-text-editor__tool-group" role="group" aria-label="颜色与描边">
        <OcColorPicker label="前景色" :model-value="foregroundColor" :z-index="2500"
          @open-change="captureColorSnapshot('foreground', $event)"
          @preview="setForegroundColor" @cancel="restoreColorSnapshot('foreground')">
          <template #trigger="{ color }">
            <span class="oc-rich-text-editor__color-command">
              <OcIcon name="format.color-fill" size="md" />
              <span :style="{ backgroundColor: color }" />
            </span>
          </template>
        </OcColorPicker>
        <OcColorPicker label="文字背景色" :model-value="backgroundColor" :z-index="2500"
          @open-change="captureColorSnapshot('background', $event)"
          @preview="setBackgroundColor" @cancel="restoreColorSnapshot('background')">
          <template #trigger="{ color }">
            <span class="oc-rich-text-editor__color-command">
              <OcIcon name="format.color-highlight" size="md" />
              <span :style="{ backgroundColor: color }" />
            </span>
          </template>
        </OcColorPicker>
        <OcColorPicker label="描边颜色" :model-value="strokeColor" :z-index="2500"
          @open-change="captureColorSnapshot('stroke', $event)"
          @preview="setStrokeColor" @cancel="restoreColorSnapshot('stroke')">
          <template #trigger="{ color }">
            <span class="oc-rich-text-editor__color-command oc-rich-text-editor__color-command--stroke"
              :style="{ WebkitTextStrokeColor: color }">A</span>
          </template>
        </OcColorPicker>
        <OcSelect class="oc-rich-text-editor__stroke-width" data-tooltip="描边宽度" aria-label="描边宽度"
          :model-value="strokeWidth" :options="strokeWidthOptions" :z-index="2500"
          @update:model-value="setStrokeWidth" />
      </div>

      <div class="oc-rich-text-editor__tool-group" role="group" aria-label="段落对齐">
        <OcButton v-for="alignment in alignments" :key="alignment.value" size="md" icon-only
          :icon="alignment.icon" :data-tooltip="alignment.title" :aria-label="alignment.title"
          :active="editor.isActive({ textAlign: alignment.value })"
          @mousedown.prevent @click="editor.chain().focus().setTextAlign(alignment.value).run()" />
      </div>
      <div class="oc-rich-text-editor__tool-group oc-rich-text-editor__tool-group--tail" role="group" aria-label="清除格式">
        <OcButton size="md" icon-only icon="format.clear" data-tooltip="清除字符格式" aria-label="清除字符格式" @mousedown.prevent
          @click="editor.chain().focus().unsetAllMarks().run()" />
      </div>
    </div>

    <EditorContent :editor="editor" class="oc-rich-text-editor__surface" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Extension, type JSONContent } from '@tiptap/core'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import OcButton from '../../../components/base/OcButton.vue'
import OcIcon from '../../../components/base/OcIcon.vue'
import OcColorPicker from '../../../components/standard/OcColorPicker.vue'
import OcSelect from '../../../components/standard/OcSelect.vue'
import { normalizeRichTextHtml } from '../../rich-text/richTextHtml'
import type { IconToken } from '../icon/iconRegistry'
import { BindingNode } from './BindingNode'
import type { RichTextBindingCompletionProvider } from './bindingNode.types'

type RichTextFontOption = {
  label: string
  value: string
  cssFamily?: string
}

const props = defineProps<{
  modelValue: string
  bindingCompletion?: RichTextBindingCompletionProvider
  fontOptions?: readonly RichTextFontOption[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const lastEmittedValue = ref<string | null>(null)
const toolbarRevision = ref(0)
type ColorCommand = 'foreground' | 'background' | 'stroke'
type ColorSnapshot = {
  content: JSONContent
  selection: { from: number, to: number }
}
const colorSnapshots = new Map<ColorCommand, ColorSnapshot>()

const TextStyleAttributes = Extension.create({
  name: 'textStyleAttributes',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: element => element.style.fontSize || null,
          renderHTML: attributes => attributes.fontSize
            ? { style: `font-size: ${attributes.fontSize}` }
            : {},
        },
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

const fallbackFontFamilies: readonly RichTextFontOption[] = [
  { label: 'Arial', value: 'Arial' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Impact', value: 'Impact' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: '微软雅黑', value: 'Microsoft YaHei' },
  { label: '宋体', value: 'SimSun' },
] as const
const fontOptions = computed(() => [
  { label: '默认字体', value: '' },
  ...(props.fontOptions ?? fallbackFontFamilies),
])
const strokeWidthOptions = [
  { label: '无描边', value: '0px' },
  { label: '0.5 px', value: '0.5px' },
  { label: '1 px', value: '1px' },
  { label: '1.5 px', value: '1.5px' },
  { label: '2 px', value: '2px' },
  { label: '3 px', value: '3px' },
] as const
const fontSizeSteps = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80, 96] as const
const defaultFontSize = 16
const richTextParseOptions = { preserveWhitespace: 'full' as const }

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
const activeFontFamily = computed(() => {
  toolbarRevision.value
  const activeValue = editor.value?.getAttributes('textStyle').fontFamily || ''
  return fontOptions.value.find(option => (option.cssFamily ?? option.value) === activeValue)?.value
    ?? activeValue
})

const editor = useEditor({
  content: normalizeRichTextHtml(props.modelValue),
  parseOptions: richTextParseOptions,
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
    Underline,
    Color,
    FontFamily,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['paragraph'] }),
    TextStyleAttributes,
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
  onTransaction: () => {
    toolbarRevision.value += 1
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
  currentEditor.commands.setContent(normalizedValue, false, richTextParseOptions)
})

function setFontFamily(value: string): void {
  const chain = editor.value?.chain().focus()
  if (!chain) return
  const cssFamily = fontOptions.value.find(option => option.value === value)?.cssFamily ?? value
  if (cssFamily) chain.setFontFamily(cssFamily).run()
  else chain.unsetFontFamily().run()
}

function adjustFontSize(direction: -1 | 1): void {
  const currentEditor = editor.value
  if (!currentEditor) return
  const currentValue = Number.parseFloat(currentEditor.getAttributes('textStyle').fontSize)
  const currentSize = Number.isFinite(currentValue) ? currentValue : defaultFontSize
  const nextSize = direction > 0
    ? fontSizeSteps.find(size => size > currentSize) ?? fontSizeSteps[fontSizeSteps.length - 1]
    : [...fontSizeSteps].reverse().find(size => size < currentSize) ?? fontSizeSteps[0]
  currentEditor.chain().focus().setMark('textStyle', { fontSize: `${nextSize}px` }).run()
}

function setForegroundColor(value: string): void {
  editor.value?.chain().focus().setColor(value).run()
}

function setBackgroundColor(value: string): void {
  editor.value?.chain().focus().setHighlight({ color: value }).run()
}

function setStrokeColor(value: string): void {
  editor.value?.chain().focus().setMark('textStyle', {
    textStrokeColor: value,
    textStrokeWidth: strokeWidth.value,
  }).run()
}

function setStrokeWidth(value: string): void {
  editor.value?.chain().focus().setMark('textStyle', {
    textStrokeColor: value === '0px' ? null : strokeColor.value,
    textStrokeWidth: value === '0px' ? null : value,
  }).run()
}

function captureColorSnapshot(command: ColorCommand, open: boolean): void {
  const currentEditor = editor.value
  if (!currentEditor) return
  if (!open) {
    colorSnapshots.delete(command)
    return
  }
  colorSnapshots.set(command, {
    content: currentEditor.getJSON(),
    selection: {
      from: currentEditor.state.selection.from,
      to: currentEditor.state.selection.to,
    },
  })
}

function restoreColorSnapshot(command: ColorCommand): void {
  const currentEditor = editor.value
  const snapshot = colorSnapshots.get(command)
  if (!currentEditor || !snapshot) return
  currentEditor.commands.setContent(snapshot.content)
  currentEditor.commands.setTextSelection(snapshot.selection)
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
  gap: 0;
  padding: var(--oc-space-1);
  overflow-x: auto;
  border-bottom: 1px solid var(--oc-border-default);
  background: var(--oc-bg-raised);
}

.oc-rich-text-editor__tool-group {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
  padding-inline: var(--oc-space-2);
  border-inline-start: 1px solid var(--oc-border-muted);
}

.oc-rich-text-editor__tool-group:first-child {
  padding-inline-start: 0;
  border-inline-start: 0;
}

.oc-rich-text-editor__tool-group--tail {
  margin-inline-start: auto;
}

.oc-rich-text-editor__font {
  width: 124px;
}

.oc-rich-text-editor__stroke-width {
  width: 84px;
}

.oc-rich-text-editor__color-command {
  position: relative;
  display: grid;
  width: 16px;
  height: 18px;
  place-items: center;
  font-weight: 700;
  line-height: 1;
}

.oc-rich-text-editor__color-command > span {
  position: absolute;
  right: 1px;
  bottom: 0;
  left: 1px;
  height: 3px;
  border-radius: 1px;
}

.oc-rich-text-editor__color-command--stroke {
  color: var(--oc-bg-input);
  -webkit-text-stroke-width: 1px;
}

.oc-rich-text-editor__surface {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
}

.oc-rich-text-editor__surface :deep(.oc-rich-text-editor__content) {
  min-height: 100%;
  padding: var(--oc-space-4);
  outline: none;
  color: var(--oc-fg-default);
  overflow-wrap: anywhere;
  white-space: break-spaces;
}

.oc-rich-text-editor__surface :deep(p) {
  margin: 0;
}

.oc-rich-text-editor__surface :deep(p + p) {
  margin-top: 0.35em;
}
</style>
