<template>
  <div class="oc-rich-text-editor">
    <div v-if="editor" class="oc-rich-text-editor__toolbar" role="toolbar" aria-label="Text formatting">
      <div class="oc-rich-text-editor__toolbar-row">
        <div class="oc-rich-text-editor__tool-group" role="group" aria-label="历史">
          <OcButton size="md" icon-only icon="action.undo" data-tooltip="撤销" aria-label="撤销"
            :disabled="!editor.can().chain().focus().undo().run()" @mousedown.prevent @click="editor.chain().focus().undo().run()" />
          <OcButton size="md" icon-only icon="action.redo" data-tooltip="重做" aria-label="重做"
            :disabled="!editor.can().chain().focus().redo().run()" @mousedown.prevent @click="editor.chain().focus().redo().run()" />
        </div>
        <div class="oc-rich-text-editor__tool-group" role="group" aria-label="字体">
          <OcSelect class="oc-rich-text-editor__font" data-tooltip="字体" aria-label="字体"
            :model-value="activeFontFamily" :options="fontOptions" :z-index="2500" @update:model-value="setFontFamily" />
          <OcSelect class="oc-rich-text-editor__font-size" data-tooltip="字号" aria-label="字号"
            :model-value="activeFontSize" :options="fontSizeOptions" :z-index="2500" @update:model-value="setFontSize" />
          <OcButton size="md" icon-only icon="format.font-size-decrease" data-tooltip="减小字号" aria-label="减小字号"
            @mousedown.prevent @click="adjustFontSize(-1)" />
          <OcButton size="md" icon-only icon="format.font-size-increase" data-tooltip="增大字号" aria-label="增大字号"
            @mousedown.prevent @click="adjustFontSize(1)" />
          <OcButton size="md" icon-only icon="format.bold" :active="editor.isActive('bold')"
            data-tooltip="粗体" aria-label="粗体" @mousedown.prevent @click="editor.chain().focus().toggleBold().run()" />
          <OcButton size="md" icon-only icon="format.italic" :active="editor.isActive('italic')"
            data-tooltip="斜体" aria-label="斜体" @mousedown.prevent @click="editor.chain().focus().toggleItalic().run()" />
          <OcButton size="md" icon-only icon="format.underline" :active="editor.isActive('underline')"
            data-tooltip="下划线" aria-label="下划线" @mousedown.prevent @click="editor.chain().focus().toggleUnderline().run()" />
          <OcButton size="md" icon-only icon="format.strikethrough" :active="editor.isActive('strike')"
            data-tooltip="删除线" aria-label="删除线" @mousedown.prevent @click="editor.chain().focus().toggleStrike().run()" />
        </div>
      </div>

      <div class="oc-rich-text-editor__toolbar-row">
        <div v-if="bindingCompletion" class="oc-rich-text-editor__tool-group" role="group" aria-label="数据引用">
          <OcButton size="md" icon-only icon="format.code-braces" data-tooltip="插入 binding"
            aria-label="插入 binding" @mousedown.prevent @click="insertBinding" />
        </div>
        <div v-if="projectIconCatalog" class="oc-rich-text-editor__tool-group" role="group" aria-label="项目图标">
          <OcActionButton :action="projectIconAction" size="md" variant="ghost"
            @mousedown.prevent @select="handleProjectIconAction" />
          <OcButton v-for="entry in recentProjectIconEntries" :key="projectIconActionKey(entry)" size="md" icon-only
            class="oc-rich-text-editor__recent-icon" :data-tooltip="`${entry.name} · ${entry.seriesKey}`"
            :aria-label="`插入最近图标：${entry.name}`" @mousedown.prevent @click="insertRecentProjectIcon(entry)">
            <template #icon>
              <span class="oc-rich-text-editor__recent-icon-image oc-project-icon"
                :style="createProjectIconPreviewStyle(entry)" aria-hidden="true" />
            </template>
          </OcButton>
        </div>
        <div class="oc-rich-text-editor__tool-group" role="group" aria-label="颜色与描边">
          <OcColorPicker label="前景色" :model-value="foregroundColor" :z-index="2500"
            @open-change="captureColorSnapshot('foreground', $event)"
            @preview="setForegroundColor" @cancel="restoreColorSnapshot('foreground')">
            <template #trigger="{ color }"><span class="oc-rich-text-editor__color-command">
              <OcIcon name="format.color-fill" size="md" /><span :style="{ backgroundColor: color }" />
            </span></template>
          </OcColorPicker>
          <OcColorPicker label="文字背景色" :model-value="backgroundColor" :z-index="2500"
            @open-change="captureColorSnapshot('background', $event)"
            @preview="setBackgroundColor" @cancel="restoreColorSnapshot('background')">
            <template #trigger="{ color }"><span class="oc-rich-text-editor__color-command">
              <OcIcon name="format.color-highlight" size="md" /><span :style="{ backgroundColor: color }" />
            </span></template>
          </OcColorPicker>
          <OcColorPicker label="描边颜色" :model-value="strokeColor" :z-index="2500"
            @open-change="captureColorSnapshot('stroke', $event)"
            @preview="setStrokeColor" @cancel="restoreColorSnapshot('stroke')">
            <template #trigger="{ color }"><span class="oc-rich-text-editor__color-command oc-rich-text-editor__color-command--stroke"
              :style="{ WebkitTextStrokeColor: color }">A</span></template>
          </OcColorPicker>
          <OcSelect class="oc-rich-text-editor__stroke-width" data-tooltip="描边宽度" aria-label="描边宽度"
            :model-value="strokeWidth" :options="strokeWidthOptions" :z-index="2500" @update:model-value="setStrokeWidth" />
        </div>
        <div class="oc-rich-text-editor__tool-group" role="group" aria-label="段落对齐">
          <OcButton v-for="alignment in alignments" :key="alignment.value" size="md" icon-only
            :icon="alignment.icon" :data-tooltip="alignment.title" :aria-label="alignment.title"
            :active="editor.isActive({ textAlign: alignment.value })"
            @mousedown.prevent @click="editor.chain().focus().setTextAlign(alignment.value).run()" />
        </div>
        <div class="oc-rich-text-editor__tool-group oc-rich-text-editor__tool-group--tail" role="group" aria-label="清除格式">
          <OcButton size="md" icon-only icon="format.clear" data-tooltip="清除字符格式" aria-label="清除字符格式"
            @mousedown.prevent @click="editor.chain().focus().unsetAllMarks().run()" />
        </div>
      </div>
    </div>

    <OcAutocompletePopover :id="projectIconAutocompleteId" :open="projectIconCompletionOpen"
      :anchor="projectIconCompletionAnchor" :items="projectIconSuggestions" :active-key="activeProjectIconSuggestionKey"
      :match-anchor-width="false" :z-index="2500" @select="acceptProjectIconSuggestionByKey" />

    <EditorContent :editor="editor" class="oc-rich-text-editor__surface" :style="baseStyle" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { Extension, type Editor, type JSONContent } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
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
import OcAutocompletePopover from '../../../components/standard/OcAutocompletePopover.vue'
import OcSelect from '../../../components/standard/OcSelect.vue'
import OcActionButton, {
  type OcActionButtonAction,
  type OcActionButtonSelectPayload,
} from '../../../components/standard/OcActionButton.vue'
import { normalizeRichTextHtml } from '../../rich-text/richTextHtml'
import type { IconToken } from '../icon/iconRegistry'
import { BindingNode } from './bindingNode'
import type { RichTextBindingCompletionProvider } from './bindingNode.types'
import { ProjectIconNode } from './projectIconNode'
import type {
  PropertyCompletionItem,
  PropertyCompletionProvider,
  PropertyCompletionResult,
} from '../property-editor/propertyEditor.types'
import {
  createProjectIconStyle,
  createProjectIconPreviewStyle,
  type ProjectIconCatalog,
  type ProjectIconCatalogEntry,
} from '../../../features/workspace/services/projectIconCatalog'
import {
  projectIconRecentIdentity,
  recentProjectIconIdentities,
  rememberRecentProjectIcon,
} from './recentProjectIcons'

type RichTextFontOption = {
  label: string
  value: string
  cssFamily?: string
}

type RichTextFontSelectOption = RichTextFontOption & {
  labelStyle?: Readonly<Record<string, string>>
}

const props = defineProps<{
  modelValue: string
  bindingCompletion?: RichTextBindingCompletionProvider
  projectIconCompletion?: PropertyCompletionProvider
  projectIconCatalog?: ProjectIconCatalog
  fontOptions?: readonly RichTextFontOption[]
  baseStyle?: {
    fontFamily?: string
    fontSize?: string
  }
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const lastEmittedValue = ref<string | null>(null)
const toolbarRevision = ref(0)
type ProjectIconCompletionState = PropertyCompletionResult & {
  documentFrom: number
  documentTo: number
}
const projectIconCompletionState = ref<ProjectIconCompletionState | null>(null)
const projectIconCompletionOpen = ref(false)
const projectIconCompletionAnchor = ref<DOMRect | null>(null)
const activeProjectIconSuggestionKey = ref<string | null>(null)
const projectIconAutocompleteId = useId()
let projectIconCompletionRequestId = 0
let lastProjectIconCompletionSignature: string | null = null
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
const fontOptions = computed<readonly RichTextFontSelectOption[]>(() => [
  { label: '默认字体', value: '' },
  ...(props.fontOptions ?? fallbackFontFamilies).map(option => ({
    ...option,
    labelStyle: { fontFamily: option.cssFamily ?? option.value },
  })),
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
const activeFontSize = computed(() => {
  toolbarRevision.value
  return String(resolveActiveFontSize())
})
const fontSizeOptions = computed(() => {
  toolbarRevision.value
  const activeSize = resolveActiveFontSize()
  const sizes = [...new Set<number>([...fontSizeSteps, activeSize])].sort((left, right) => left - right)
  return sizes.map(size => ({ label: `${size} px`, value: String(size) }))
})
const projectIconEntriesByActionKey = computed(() => new Map(
  (props.projectIconCatalog?.entries ?? []).map(entry => [projectIconActionKey(entry), entry]),
))
const projectIconSuggestions = computed(() => projectIconCompletionState.value?.items ?? [])
const recentProjectIconEntries = computed(() => recentProjectIconIdentities.value.flatMap(identity => {
  const entry = props.projectIconCatalog?.entries.find(candidate => (
    projectIconRecentIdentity(candidate.seriesKey, candidate.iconKey) === identity
  ))
  return entry ? [entry] : []
}))
const projectIconActionChildren = computed(() => (props.projectIconCatalog?.series ?? []).map(series => ({
  key: `project-icon-series:${series.key}`,
  title: series.name,
  icon: 'file.package-variant' as const,
  children: props.projectIconCatalog?.entries
    .filter(entry => entry.seriesKey.toLocaleLowerCase() === series.key.toLocaleLowerCase())
    .map(entry => ({
      key: projectIconActionKey(entry),
      title: entry.name,
      thumbnailStyle: createProjectIconStyle(entry),
      thumbnailLabel: entry.name,
    })) ?? [],
})).filter(series => series.children.length > 0))
const projectIconAction = computed<OcActionButtonAction>(() => {
  toolbarRevision.value
  const selected = selectedProjectIconEntry()
  const catalog = props.projectIconCatalog
  return {
    key: 'project-icon',
    icon: 'action.image-plus',
    title: selected ? '替换项目图标' : '插入项目图标',
    disabled: !catalog?.entries.length,
    children: projectIconActionChildren.value,
  }
})

watch(projectIconSuggestions, suggestions => {
  if (suggestions.some(suggestion => suggestion.key === activeProjectIconSuggestionKey.value)) return
  activeProjectIconSuggestionKey.value = suggestions[0]?.key ?? null
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
    ProjectIconNode.configure({
      catalog: () => props.projectIconCatalog,
    }),
  ],
  editorProps: {
    attributes: {
      class: 'oc-rich-text-editor__content',
      spellcheck: 'true',
    },
    handleKeyDown: (_view, event) => handleProjectIconCompletionKeydown(event),
    handleDOMEvents: {
      blur: () => {
        closeProjectIconCompletion()
        return false
      },
    },
  },
  onUpdate: ({ editor: currentEditor }) => {
    const value = currentEditor.getHTML()
    lastEmittedValue.value = value
    emit('update:modelValue', value)
  },
  onTransaction: ({ transaction }) => {
    toolbarRevision.value += 1
    if (transaction.docChanged || transaction.selectionSet) {
      queueMicrotask(() => void refreshProjectIconCompletion())
    }
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

watch(() => props.projectIconCompletion, () => {
  lastProjectIconCompletionSignature = null
  void refreshProjectIconCompletion()
})

function setFontFamily(value: string): void {
  const chain = editor.value?.chain().focus()
  if (!chain) return
  const cssFamily = fontOptions.value.find(option => option.value === value)?.cssFamily ?? value
  if (cssFamily) chain.setFontFamily(cssFamily).run()
  else chain.unsetFontFamily().run()
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = Number.parseFloat(String(value ?? ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function resolveActiveFontSize(): number {
  const currentEditor = editor.value
  const inlineSize = parsePositiveNumber(currentEditor?.getAttributes('textStyle').fontSize)
  if (inlineSize !== null) return inlineSize

  const contentElement = currentEditor?.view.dom
  const computedSize = contentElement ? parsePositiveNumber(getComputedStyle(contentElement).fontSize) : null
  if (computedSize !== null) return computedSize

  return parsePositiveNumber(props.baseStyle?.fontSize) ?? defaultFontSize
}

function setFontSize(value: string): void {
  const size = parsePositiveNumber(value)
  if (size === null) return
  editor.value?.chain().focus().setMark('textStyle', { fontSize: `${size}px` }).run()
}

function adjustFontSize(direction: -1 | 1): void {
  const currentEditor = editor.value
  if (!currentEditor) return
  const currentSize = resolveActiveFontSize()
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

function projectIconActionKey(entry: Pick<ProjectIconCatalogEntry, 'seriesKey' | 'iconKey'>): string {
  return `project-icon:${entry.seriesKey}/${entry.iconKey}`
}

function closeProjectIconCompletion(): void {
  projectIconCompletionRequestId += 1
  projectIconCompletionState.value = null
  projectIconCompletionOpen.value = false
  projectIconCompletionAnchor.value = null
  activeProjectIconSuggestionKey.value = null
}

async function refreshProjectIconCompletion(): Promise<void> {
  const currentEditor = editor.value
  const provider = props.projectIconCompletion
  const selection = currentEditor?.state.selection
  if (!currentEditor || !provider || !selection?.empty || !selection.$from.parent.isTextblock) {
    closeProjectIconCompletion()
    return
  }

  const parent = selection.$from.parent
  const parentOffset = selection.$from.parentOffset
  const value = parent.textBetween(0, parent.content.size, '', '\ufffc')
  const cursor = parent.textBetween(0, parentOffset, '', '\ufffc').length
  const signature = `${selection.$from.start()}\u0000${cursor}\u0000${value}`
  if (signature === lastProjectIconCompletionSignature) return
  lastProjectIconCompletionSignature = signature
  const requestId = ++projectIconCompletionRequestId
  const result = await provider({ value, cursor })
  if (requestId !== projectIconCompletionRequestId) return
  if (!result?.items.length) {
    closeProjectIconCompletion()
    return
  }

  const parentStart = selection.$from.start()
  projectIconCompletionState.value = {
    ...result,
    documentFrom: parentStart + result.replaceStart,
    documentTo: parentStart + result.replaceEnd,
  }
  const editorBounds = currentEditor.view.dom.getBoundingClientRect()
  let anchorLeft = editorBounds.left
  let anchorTop = editorBounds.top
  try {
    const coordinates = currentEditor.view.coordsAtPos(selection.from)
    anchorLeft = coordinates.left
    anchorTop = coordinates.bottom
  } catch {
    // The editor can briefly lack a measurable DOM range while a dialog is opening.
  }
  projectIconCompletionAnchor.value = new DOMRect(anchorLeft, anchorTop, 0, 0)
  projectIconCompletionOpen.value = true
  activeProjectIconSuggestionKey.value = result.items[0]?.key ?? null
}

function acceptProjectIconSuggestionByKey(key: string): void {
  const suggestion = projectIconSuggestions.value.find(item => item.key === key)
  if (suggestion) acceptProjectIconSuggestion(suggestion)
}

function acceptProjectIconSuggestion(suggestion: PropertyCompletionItem): void {
  const currentEditor = editor.value
  const state = projectIconCompletionState.value
  if (!currentEditor || !state) return
  const entry = projectIconEntriesByActionKey.value.get(suggestion.key)
  if (entry) {
    const content = createProjectIconContent(currentEditor, entry, state.documentFrom)
    currentEditor.chain().focus()
      .insertContentAt({ from: state.documentFrom, to: state.documentTo }, content)
      .run()
    rememberRecentProjectIcon(entry.seriesKey, entry.iconKey)
    closeProjectIconCompletion()
    return
  }

  currentEditor.chain().focus()
    .insertContentAt({ from: state.documentFrom, to: state.documentTo }, suggestion.insertText)
    .run()
  if (!suggestion.keepOpen) closeProjectIconCompletion()
}

function handleProjectIconCompletionKeydown(event: KeyboardEvent): boolean {
  const suggestions = projectIconSuggestions.value
  if (!projectIconCompletionOpen.value || suggestions.length === 0) return false
  const activeIndex = Math.max(0, suggestions.findIndex(item => item.key === activeProjectIconSuggestionKey.value))
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const direction = event.key === 'ArrowDown' ? 1 : -1
    const nextIndex = (activeIndex + direction + suggestions.length) % suggestions.length
    activeProjectIconSuggestionKey.value = suggestions[nextIndex]?.key ?? null
    return true
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    if (activeProjectIconSuggestionKey.value) {
      acceptProjectIconSuggestionByKey(activeProjectIconSuggestionKey.value)
    }
    return true
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    closeProjectIconCompletion()
    return true
  }
  return false
}

function selectedProjectIconEntry(): ProjectIconCatalogEntry | null {
  const currentEditor = editor.value
  const selection = currentEditor?.state.selection
  if (!currentEditor || !(selection instanceof NodeSelection) || selection.node.type.name !== 'projectIcon') return null
  const seriesKey = String(selection.node.attrs.seriesKey ?? '')
  const iconKey = String(selection.node.attrs.iconKey ?? '')
  return props.projectIconCatalog?.entries.find(entry => (
    entry.seriesKey.toLocaleLowerCase() === seriesKey.toLocaleLowerCase()
    && entry.iconKey.toLocaleLowerCase() === iconKey.toLocaleLowerCase()
  )) ?? null
}

function handleProjectIconAction(payload: OcActionButtonSelectPayload): void {
  const entry = projectIconEntriesByActionKey.value.get(payload.key)
  if (entry) insertProjectIconEntry(entry)
}

function insertRecentProjectIcon(entry: ProjectIconCatalogEntry): void {
  insertProjectIconEntry(entry)
}

function insertProjectIconEntry(entry: ProjectIconCatalogEntry): void {
  const currentEditor = editor.value
  if (!currentEditor) return
  const attrs = { seriesKey: entry.seriesKey, iconKey: entry.iconKey }
  if (selectedProjectIconEntry()) {
    const position = currentEditor.state.selection.from
    currentEditor.chain().focus().updateAttributes('projectIcon', attrs).setNodeSelection(position).run()
  } else currentEditor.chain().focus().insertContent(createProjectIconContent(currentEditor, entry)).run()
  rememberRecentProjectIcon(entry.seriesKey, entry.iconKey)
}

function createProjectIconContent(
  currentEditor: Editor,
  entry: ProjectIconCatalogEntry,
  sourcePosition?: number,
): JSONContent {
  const marks = sourcePosition === undefined
    ? (currentEditor.state.storedMarks ?? currentEditor.state.selection.$from.marks())
    : (currentEditor.state.doc.nodeAt(sourcePosition)?.marks
      ?? currentEditor.state.doc.resolve(sourcePosition).marks())
  return {
    type: 'projectIcon',
    attrs: { seriesKey: entry.seriesKey, iconKey: entry.iconKey },
    ...(marks.length > 0 ? { marks: marks.map(mark => mark.toJSON()) } : {}),
  }
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
  flex: 0 0 auto;
  flex-direction: column;
  align-items: stretch;
  gap: var(--oc-space-1);
  padding: var(--oc-space-1);
  overflow: hidden;
  border-bottom: var(--oc-border-width) solid var(--oc-border-default);
  background: var(--oc-bg-raised);
}

.oc-rich-text-editor__toolbar-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
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

.oc-rich-text-editor__recent-icon {
  width: var(--oc-size-md);
  flex: 0 0 var(--oc-size-md);
}

.oc-rich-text-editor__recent-icon-image {
  display: inline-block;
  flex: none;
  font-size: var(--oc-icon-size-md);
  background-repeat: no-repeat;
  vertical-align: text-bottom;
}

.oc-rich-text-editor__font {
  width: 124px;
}

.oc-rich-text-editor__font-size {
  width: 82px;
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
  paint-order: stroke fill;
  white-space: break-spaces;
}

.oc-rich-text-editor__surface :deep(p) {
  margin: 0;
}

.oc-rich-text-editor__surface :deep(p + p) {
  margin-top: 0.35em;
}
</style>
