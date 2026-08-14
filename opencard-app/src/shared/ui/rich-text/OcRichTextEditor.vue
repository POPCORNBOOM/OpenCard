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
        <div class="oc-rich-text-editor__tool-group" role="group" aria-label="文档结构">
          <OcButton size="md" icon-only icon="data.list-bulleted" data-tooltip="无序列表" aria-label="无序列表"
            :active="editor.isActive('bulletList')" @mousedown.prevent @click="editor.chain().focus().toggleBulletList().run()" />
          <OcButton size="md" icon-only icon="data.list-numbered" data-tooltip="有序列表" aria-label="有序列表"
            :active="editor.isActive('orderedList')" @mousedown.prevent @click="editor.chain().focus().toggleOrderedList().run()" />
          <OcButton v-if="!editor.isActive('table')" size="md" icon-only icon="data.table" data-tooltip="插入表格" aria-label="插入表格"
            @mousedown.prevent @click="insertTable" />
          <OcActionButton v-if="editor.isActive('table')" :action="tableAction" size="md" variant="ghost"
            @select="handleTableAction" />
        </div>
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
        <div v-if="customBlockCatalog" class="oc-rich-text-editor__tool-group" role="group" aria-label="自定义块">
          <OcActionButton :action="customBlockAction" size="md" variant="ghost" @select="insertCustomBlock" />
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

    <OcFloatingLayer v-if="selectedNodeAnchor && selectedNodeKind" :open="nodeEditOpen"
      :anchor="selectedNodeAnchor" placement="top-start" :z-index="2500">
      <div class="oc-rich-text-editor__node-edit-layer">
        <OcActionButton v-if="selectedNodeKind === 'projectIcon'" :action="projectIconAction"
          size="sm" variant="ghost" @mousedown.prevent @select="handleProjectIconAction" />
        <OcButton v-else size="sm" icon-only icon="action.edit" :data-tooltip="tr('propertyEditor.richText.editSelected', '编辑选中内容')"
          :aria-label="tr('propertyEditor.richText.editSelected', '编辑选中内容')" data-test="rich-text-node-edit"
          @mousedown.prevent @click="openSelectedNodeEditor" />
      </div>
    </OcFloatingLayer>

    <OcDialog :open="selectedNodeEditorOpen" :title="selectedNodeDialogTitle"
      size="md" close-on-backdrop @request-close="cancelSelectedNodeEditor">
      <div v-if="dialogNodeTarget?.kind === 'binding'" class="oc-rich-text-editor__node-dialog-content">
        <label class="oc-rich-text-editor__dialog-field oc-rich-text-editor__dialog-binding-field">
          <span>{{ tr('propertyEditor.richText.bindingExpression', 'Binding 表达式') }}</span>
          <OcFieldInput :value="dialogBindingExpression" variant="plain" full-width
            aria-label="Binding expression"
            @input="updateDialogBindingExpression" />
        </label>
      </div>
      <div v-else-if="dialogNodeTarget?.kind === 'projectIcon'" class="oc-rich-text-editor__node-dialog-content">
        <OcActionButton :action="dialogProjectIconAction" size="md" variant="ghost"
          @select="selectDialogProjectIcon" />
      </div>
      <div v-else-if="dialogNodeTarget?.kind === 'customBlock' && selectedCustomBlock"
        class="oc-rich-text-editor__node-dialog-content">
        <header class="oc-rich-text-editor__node-dialog-actions">
          <OcButton size="sm" icon-only icon="layout.rows" data-tooltip="切换行内/独占行"
            aria-label="切换行内/独占行" @click="toggleDialogCustomBlockLayout" />
        </header>
        <PropertyEditor :inputs="dialogCustomBlockInputs" sort-mode="category"
          :binding-interpreter="customBlockBindingInterpreter"
          @update-property="updateDialogCustomBlockProperty"
          @reset-property="resetDialogCustomBlockProperty" />
      </div>
      <template #footer>
        <OcButton type="button" @click="cancelSelectedNodeEditor">{{ tr('propertyEditor.richText.cancel', '取消') }}</OcButton>
        <OcButton type="button" variant="solid" @click="confirmSelectedNodeEditor">{{ tr('propertyEditor.richText.confirm', '确定') }}</OcButton>
      </template>
    </OcDialog>

    <EditorContent :editor="editor" class="oc-rich-text-editor__surface" :style="baseStyle" />
  </div>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, ref, watch } from 'vue'
import { Extension, Mark, type Editor, type JSONContent } from '@tiptap/core'
import type { ParseRule } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import TextStyle from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import OcButton from '../../../components/base/OcButton.vue'
import OcFieldInput from '../../../components/base/OcFieldInput.vue'
import OcIcon from '../../../components/base/OcIcon.vue'
import OcDialog from '../../../components/standard/OcDialog.vue'
import OcColorPicker from '../../../components/standard/OcColorPicker.vue'
import OcSelect from '../../../components/standard/OcSelect.vue'
import OcActionButton, {
  type OcActionButtonAction,
  type OcActionButtonSelectPayload,
} from '../../../components/standard/OcActionButton.vue'
import OcFloatingLayer from '../../../components/standard/OcFloatingLayer.vue'
import PropertyEditor from '../property-editor/PropertyEditor.vue'
import type {
  PropertyEditorBindingInterpreter,
  PropertyEditorFieldDefinition,
  PropertyEditorFieldIntent,
  PropertyEditorInput,
  PropertyEditorMutation,
} from '../property-editor/propertyEditor.types'
import type { DeepReadonly } from 'vue'
import type { ProjectCustomBlockCatalog, ProjectCustomBlockManifestCatalog } from '../../../features/workspace/model/projectCustomBlocks'
import { getProjectCustomBlockPublicFields } from '../../../features/workspace/services/projectCustomBlockPublicFields'
import { InlineCustomBlockNode, BlockCustomBlockNode, remapPastedEmbedIds } from './customBlockNode'
import { normalizeRichTextHtml, parseRichTextHtml } from '../../rich-text/richTextHtml'
import type { IconToken } from '../icon/iconRegistry'
import { BindingNode } from './bindingNode'
import type { RichTextBindingCompletionProvider } from './bindingNode.types'
import { ProjectIconNode } from './projectIconNode'
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
  projectIconCatalog?: ProjectIconCatalog
  customBlockCatalog?: {
    catalog: DeepReadonly<ProjectCustomBlockCatalog>
    manifests: DeepReadonly<ProjectCustomBlockManifestCatalog>
    ensureLoaded: (key: string) => Promise<unknown>
  }
  fontOptions?: readonly RichTextFontOption[]
  baseStyle?: {
    fontFamily?: string
    fontSize?: string
  }
  fieldModeLabels?: {
    useFieldEditor: string
    useRawStringEditor: string
  }
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
const translate = getCurrentInstance()?.appContext.config.globalProperties.$t as ((key: string) => string) | undefined
const tr = (key: string, fallback: string) => translate?.(key) ?? fallback

const lastEmittedValue = ref<string | null>(null)
const toolbarRevision = ref(0)
const loadingCustomBlockKey = ref<string | null>(null)
const failedCustomBlockKeys = ref(new Set<string>())
const selectedNodeEditorOpen = ref(false)
const dialogBindingExpression = ref('')
const dialogIconPath = ref<string | null>(null)
const dialogCustomBlockProperties = ref<Record<string, string>>({})
const dialogCustomBlockNodeType = ref<'inlineCustomBlock' | 'blockCustomBlock'>('inlineCustomBlock')
const dialogNodeTarget = ref<{ position: number, nodeType: string, kind: 'binding' | 'projectIcon' | 'customBlock' } | null>(null)
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

const DynamicStyle = Mark.create({
  name: 'dynamicStyle',
  priority: 1000,
  excludes: 'highlight textStyle',
  addAttributes() {
    return {
      tag: { default: 'span' },
      rawStyle: { default: '' },
    }
  },
  parseHTML() {
    const rule = (tag: 'mark' | 'span') => ({
      tag: `${tag}[data-oc-dynamic-style]`,
      getAttrs: (element: HTMLElement) => {
        const rawStyle = element.getAttribute('data-oc-dynamic-style') ?? ''
        return rawStyle ? { tag, rawStyle } : false
      },
    })
    return [rule('mark'), rule('span')]
  },
  renderHTML({ HTMLAttributes }) {
    return [HTMLAttributes.tag === 'mark' ? 'mark' : 'span', {
      'data-oc-dynamic-style': HTMLAttributes.rawStyle,
    }, 0]
  },
})

const StaticHighlight = Highlight.extend({
  parseHTML() {
    return (this.parent?.() ?? []).map((rule): ParseRule => ({
      ...rule,
      getAttrs: (element: HTMLElement | string) => {
        if (typeof element === 'string') return null
        return element.hasAttribute('data-oc-dynamic-style')
          ? false
          : typeof rule.getAttrs === 'function'
            ? ((rule.getAttrs as (element: HTMLElement) => ParseRule['attrs'])(element) ?? null)
            : rule.getAttrs ?? null
      },
    }))
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
function canonicalEditorHtml(value: string): string {
  return value.replace(/\bdata-oc-dynamic-style=("[^"]*"|'[^']*')/g, 'style=$1')
}
function visualEditorHtml(value: string): string {
  const parsed = parseRichTextHtml(value)
  if (!parsed.canEnterVisualMode || !/<[^>]+>/.test(value)) return normalizeRichTextHtml(value)
  const documentNode = new DOMParser().parseFromString(value, 'text/html')
  for (const element of Array.from(documentNode.body.querySelectorAll<HTMLElement>('[style]'))) {
    const rawStyle = element.getAttribute('style') ?? ''
    if (!rawStyle.includes('{{') && !rawStyle.includes('}}')) continue
    element.setAttribute('data-oc-dynamic-style', rawStyle)
    element.removeAttribute('style')
  }
  return documentNode.body.innerHTML
}

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
const recentProjectIconEntries = computed(() => recentProjectIconIdentities.value.flatMap(identity => {
  const entry = props.projectIconCatalog?.entries.find(candidate => (
    projectIconRecentIdentity(candidate.seriesKey, candidate.iconKey) === identity
  ))
  return entry ? [entry] : []
}))
const projectIconActionChildren = computed(() => (props.projectIconCatalog?.series ?? []).map(series => ({
  key: `project-icon-series:${series.key}`,
  title: series.name,
  icon: 'file.project-icon' as const,
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
    icon: 'action.project-icon-plus',
    title: selected ? '替换项目图标' : '插入项目图标',
    disabled: !catalog?.entries.length,
    children: projectIconActionChildren.value,
  }
})
const customBlockAction = computed<OcActionButtonAction>(() => ({
  key: 'custom-block', icon: 'action.custom-block-plus', title: '插入自定义块',
  children: [...(props.customBlockCatalog?.manifests.values() ?? [])].map(item => ({
    key: `custom-block:${item.manifest.customBlockKey}`,
    title: item.manifest.name,
    disabled: loadingCustomBlockKey.value === item.manifest.customBlockKey,
    icon: failedCustomBlockKeys.value.has(item.manifest.customBlockKey.toLowerCase())
      ? 'status.warning' as const : 'data.symbol-custom-block' as const,
  })),
}))
const tableAction = computed<OcActionButtonAction>(() => ({
  key: 'table-actions',
  icon: 'data.table',
  title: tr('propertyEditor.richText.tableActions', '表格操作'),
  children: [
    { key: 'table.add-row-before', icon: 'nav.arrow-up', title: tr('propertyEditor.richText.addRowBefore', '在上方插入行') },
    { key: 'table.add-row-after', icon: 'nav.arrow-down', title: tr('propertyEditor.richText.addRowAfter', '在下方插入行') },
    { key: 'table.add-column-before', icon: 'nav.arrow-left', title: tr('propertyEditor.richText.addColumnBefore', '在左侧插入列') },
    { key: 'table.add-column-after', icon: 'nav.arrow-right', title: tr('propertyEditor.richText.addColumnAfter', '在右侧插入列') },
    { key: 'table.toggle-header', icon: 'layout.rows', title: tr('propertyEditor.richText.toggleHeader', '切换表头行') },
    { key: 'table.delete-row', icon: 'action.delete', iconTone: 'danger', title: tr('propertyEditor.richText.deleteRow', '删除当前行') },
    { key: 'table.delete-column', icon: 'action.delete', iconTone: 'danger', title: tr('propertyEditor.richText.deleteColumn', '删除当前列') },
    { key: 'table.delete', icon: 'action.discard', iconTone: 'danger', title: tr('propertyEditor.richText.deleteTable', '删除整个表格') },
  ],
}))
function isCompleteBinding(value: unknown): boolean {
  return typeof value === 'string' && /^\s*\{\{\s*[^{}]+?\s*\}\}\s*$/.test(value)
}

const customBlockBindingInterpreter: PropertyEditorBindingInterpreter = {
  isExpression: isCompleteBinding,
}

const selectedCustomBlock = computed(() => {
  toolbarRevision.value
  const currentEditor = editor.value
  const selection = currentEditor?.state.selection
  if (!currentEditor || !(selection instanceof NodeSelection)
    || !['inlineCustomBlock', 'blockCustomBlock'].includes(selection.node.type.name)) return null
  const key = String(selection.node.attrs.customBlockKey ?? '')
  const entry = props.customBlockCatalog?.catalog.get(key.toLowerCase())
  const definitions = entry ? getProjectCustomBlockPublicFields(entry) : {}
  const properties = selection.node.attrs.properties as Record<string, string>
  return {
    key, entry, position: selection.from, nodeType: selection.node.type.name,
    fields: Object.fromEntries(Object.entries(definitions).map(([fieldKey, definition]) => {
      const value = properties[fieldKey] ?? (entry?.block as unknown as Record<string, unknown>)?.[fieldKey] ?? definition.defaultValue ?? ''
      const projectedDefinition: PropertyEditorFieldDefinition = {
        ...definition,
        title: fieldKey,
        resettable: Object.prototype.hasOwnProperty.call(properties, fieldKey),
        ...(props.bindingCompletion ? {
          binding: { provider: props.bindingCompletion },
          completion: { provider: props.bindingCompletion },
        } : {}),
      }
      return [fieldKey, { value, definition: projectedDefinition }] as const
    })),
  }
})

const selectedNodeKind = computed<'binding' | 'projectIcon' | 'customBlock' | null>(() => {
  const node = editor.value?.state.selection instanceof NodeSelection
    ? editor.value.state.selection.node
    : null
  if (!node) return null
  if (node.type.name === 'binding') return 'binding'
  if (node.type.name === 'projectIcon') return 'projectIcon'
  if (node.type.name === 'inlineCustomBlock' || node.type.name === 'blockCustomBlock') return 'customBlock'
  return null
})
const selectedNodeAnchor = computed<DOMRect | null>(() => {
  toolbarRevision.value
  const currentEditor = editor.value
  const selection = currentEditor?.state.selection
  if (!currentEditor || !(selection instanceof NodeSelection) || !selectedNodeKind.value) return null
  try {
    const nodeDom = currentEditor.view.nodeDOM(selection.from)
    if (nodeDom instanceof HTMLElement) return nodeDom.getBoundingClientRect()
    const coordinates = currentEditor.view.coordsAtPos(selection.from)
    return new DOMRect(coordinates.left, coordinates.top, Math.max(1, coordinates.right - coordinates.left), Math.max(1, coordinates.bottom - coordinates.top))
  } catch {
    return currentEditor.view.dom.getBoundingClientRect()
  }
})
const nodeEditOpen = computed(() => Boolean(selectedNodeAnchor.value))
const selectedNodeDialogTitle = computed(() => dialogNodeTarget.value?.kind === 'binding'
  ? tr('propertyEditor.richText.editBinding', '编辑 Binding')
  : dialogNodeTarget.value?.kind === 'projectIcon'
    ? tr('propertyEditor.richText.editProjectIcon', '编辑项目图标')
    : tr('propertyEditor.richText.editCustomBlock', '编辑自定义块'))
const dialogCustomBlockInputs = computed<readonly PropertyEditorInput[]>(() => {
  const selected = selectedCustomBlock.value
  if (!selected) return []
  const record: Record<string, unknown> = {}
  const fields: Record<string, PropertyEditorFieldDefinition> = {}
  for (const [fieldKey, field] of Object.entries(selected.fields)) {
    const overridden = Object.prototype.hasOwnProperty.call(dialogCustomBlockProperties.value, fieldKey)
    record[fieldKey] = overridden ? dialogCustomBlockProperties.value[fieldKey] : field.value
    fields[fieldKey] = { ...field.definition, resettable: overridden }
  }
  return [{
    key: String(selected.position),
    title: selected.entry?.manifest.name ?? selected.key,
    record,
    fields,
  }]
})
const dialogProjectIconAction = computed<OcActionButtonAction>(() => ({
  ...projectIconAction.value,
  title: tr('propertyEditor.richText.chooseProjectIcon', '选择项目图标'),
}))

function openSelectedNodeEditor(): void {
  const currentEditor = editor.value
  const selection = currentEditor?.state.selection
  if (!currentEditor || !(selection instanceof NodeSelection)) return
  const kind = selectedNodeKind.value
  if (!kind) return
  dialogNodeTarget.value = { position: selection.from, nodeType: selection.node.type.name, kind }
  if (selectedNodeKind.value === 'binding') {
    dialogBindingExpression.value = String(selection.node.attrs.expression ?? '')
  } else if (selectedNodeKind.value === 'projectIcon') {
    dialogIconPath.value = String(selection.node.attrs.iconPath ?? '')
  } else if (selectedNodeKind.value === 'customBlock') {
    dialogCustomBlockProperties.value = { ...(selection.node.attrs.properties as Record<string, string>) }
    dialogCustomBlockNodeType.value = selection.node.type.name === 'blockCustomBlock'
      ? 'blockCustomBlock'
      : 'inlineCustomBlock'
  }
  selectedNodeEditorOpen.value = true
}

function updateDialogBindingExpression(event: Event): void {
  const target = event.target
  if (target instanceof HTMLInputElement) dialogBindingExpression.value = target.value
}

function selectDialogProjectIcon(payload: OcActionButtonSelectPayload): void {
  const entry = projectIconEntriesByActionKey.value.get(payload.key)
  if (entry) dialogIconPath.value = `${entry.seriesKey}/${entry.iconKey}`
}

function updateDialogCustomBlockProperty(payload: PropertyEditorMutation): void {
  dialogCustomBlockProperties.value = {
    ...dialogCustomBlockProperties.value,
    [payload.fieldKey]: String(payload.value ?? ''),
  }
}

function resetDialogCustomBlockProperty(payload: PropertyEditorFieldIntent): void {
  const next = { ...dialogCustomBlockProperties.value }
  delete next[payload.fieldKey]
  dialogCustomBlockProperties.value = next
}

function toggleDialogCustomBlockLayout(): void {
  dialogCustomBlockNodeType.value = dialogCustomBlockNodeType.value === 'inlineCustomBlock'
    ? 'blockCustomBlock'
    : 'inlineCustomBlock'
}

function confirmSelectedNodeEditor(): void {
  const currentEditor = editor.value
  const target = dialogNodeTarget.value
  if (!currentEditor || !target) return
  const node = currentEditor.state.doc.nodeAt(target.position)
  if (!node || node.type.name !== target.nodeType) return cancelSelectedNodeEditor()
  if (target.kind === 'binding') {
    const expression = dialogBindingExpression.value.trim()
    if (!expression) currentEditor.chain().focus().setNodeSelection(target.position).deleteSelection().run()
    else currentEditor.chain().focus().setNodeSelection(target.position)
      .updateAttributes(target.nodeType, { expression }).run()
  } else if (target.kind === 'projectIcon' && dialogIconPath.value) {
    currentEditor.chain().focus().setNodeSelection(target.position)
      .updateAttributes(target.nodeType, { iconPath: dialogIconPath.value }).run()
  } else if (target.kind === 'customBlock') {
    if (target.nodeType === dialogCustomBlockNodeType.value) {
      currentEditor.chain().focus().setNodeSelection(target.position)
        .updateAttributes(target.nodeType, { properties: dialogCustomBlockProperties.value }).run()
    } else {
      currentEditor.chain().focus().insertContentAt({ from: target.position, to: target.position + node.nodeSize }, {
        type: dialogCustomBlockNodeType.value,
        attrs: { ...node.attrs, properties: dialogCustomBlockProperties.value },
      }).setNodeSelection(target.position).run()
    }
  }
  selectedNodeEditorOpen.value = false
}

function cancelSelectedNodeEditor(): void {
  selectedNodeEditorOpen.value = false
  dialogIconPath.value = null
  dialogCustomBlockProperties.value = {}
  dialogCustomBlockNodeType.value = 'inlineCustomBlock'
  dialogNodeTarget.value = null
}

const editor = useEditor({
  content: visualEditorHtml(props.modelValue),
  parseOptions: richTextParseOptions,
  extensions: [
    StarterKit.configure({
      blockquote: false,
      codeBlock: false,
      heading: false,
      horizontalRule: false,
    }),
    Table.configure({ resizable: true, allowTableNodeSelection: true }),
    TableRow,
    TableHeader,
    TableCell,
    TextStyle,
    Underline,
    Color,
    FontFamily,
    StaticHighlight.configure({ multicolor: true }),
    DynamicStyle,
    TextAlign.configure({ types: ['paragraph'] }),
    TextStyleAttributes,
    BindingNode.configure({
      completion: request => props.bindingCompletion?.(request) ?? null,
    }),
    ProjectIconNode.configure({
      catalog: () => props.projectIconCatalog,
    }),
    InlineCustomBlockNode,
    BlockCustomBlockNode,
  ],
  editorProps: {
    attributes: {
      class: 'oc-rich-text-editor__content',
      spellcheck: 'true',
    },
    transformPasted: slice => remapPastedEmbedIds(slice),
    handleDOMEvents: {
      blur: () => {
        return false
      },
    },
  },
  onUpdate: ({ editor: currentEditor }) => {
    const value = canonicalEditorHtml(currentEditor.getHTML())
    lastEmittedValue.value = value
    emit('update:modelValue', value)
  },
  onTransaction: () => {
    toolbarRevision.value += 1
  },
})

watch(() => {
  toolbarRevision.value
  const selection = editor.value?.state.selection
  return selection instanceof NodeSelection
    ? `${selection.from}:${selection.node.type.name}`
    : ''
}, () => {
  if (!selectedNodeEditorOpen.value) dialogNodeTarget.value = null
})

watch(() => props.modelValue, (value) => {
  if (value === lastEmittedValue.value) {
    lastEmittedValue.value = null
    return
  }
  lastEmittedValue.value = null
  const currentEditor = editor.value
  if (!currentEditor) return
  const normalizedValue = visualEditorHtml(value)
  if (canonicalEditorHtml(currentEditor.getHTML()) === value) return
  currentEditor.commands.setContent(normalizedValue, false, richTextParseOptions)
})

function setFontFamily(value: string): void {
  const chain = editor.value?.chain().focus()
  if (!chain) return
  const cssFamily = fontOptions.value.find(option => option.value === value)?.cssFamily ?? value
  if (cssFamily) chain.setFontFamily(cssFamily).run()
  else chain.unsetFontFamily().run()
}

function insertTable(): void {
  editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

function handleTableAction(payload: OcActionButtonSelectPayload): void {
  const chain = editor.value?.chain().focus()
  if (!chain) return
  if (payload.key === 'table.add-row-before') chain.addRowBefore().run()
  else if (payload.key === 'table.add-row-after') chain.addRowAfter().run()
  else if (payload.key === 'table.add-column-before') chain.addColumnBefore().run()
  else if (payload.key === 'table.add-column-after') chain.addColumnAfter().run()
  else if (payload.key === 'table.toggle-header') chain.toggleHeaderRow().run()
  else if (payload.key === 'table.delete-row') chain.deleteRow().run()
  else if (payload.key === 'table.delete-column') chain.deleteColumn().run()
  else if (payload.key === 'table.delete') chain.deleteTable().run()
}

async function insertCustomBlock(payload: OcActionButtonSelectPayload): Promise<void> {
  const key = payload.key.startsWith('custom-block:') ? payload.key.slice('custom-block:'.length) : ''
  if (!key || !props.customBlockCatalog) return
  loadingCustomBlockKey.value = key
  try {
    await props.customBlockCatalog.ensureLoaded(key)
  } catch {
    failedCustomBlockKeys.value = new Set(failedCustomBlockKeys.value).add(key.toLowerCase())
    return
  } finally {
    loadingCustomBlockKey.value = null
  }
  if (!props.customBlockCatalog.catalog.has(key.toLowerCase())) {
    failedCustomBlockKeys.value = new Set(failedCustomBlockKeys.value).add(key.toLowerCase())
    return
  }
  if (failedCustomBlockKeys.value.has(key.toLowerCase())) {
    const nextFailedKeys = new Set(failedCustomBlockKeys.value)
    nextFailedKeys.delete(key.toLowerCase())
    failedCustomBlockKeys.value = nextFailedKeys
  }
  editor.value?.chain().focus().insertContent({
    type: 'inlineCustomBlock',
    attrs: { embedId: crypto.randomUUID(), customBlockKey: key, properties: {} },
  }).run()
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

function selectedProjectIconEntry(): ProjectIconCatalogEntry | null {
  const currentEditor = editor.value
  const selection = currentEditor?.state.selection
  if (!currentEditor || !(selection instanceof NodeSelection) || selection.node.type.name !== 'projectIcon') return null
  const [seriesKey, iconKey] = String(selection.node.attrs.iconPath ?? '').split('/')
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
  const attrs = { iconPath: `${entry.seriesKey}/${entry.iconKey}` }
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
    attrs: { iconPath: `${entry.seriesKey}/${entry.iconKey}` },
    ...(marks.length > 0 ? { marks: marks.map(mark => mark.toJSON()) } : {}),
  }
}

function focus(): void {
  editor.value?.commands.focus('end', { scrollIntoView: false })
}

defineExpose({
  editor,
  focus,
  openSelectedNodeEditor,
  confirmSelectedNodeEditor,
  cancelSelectedNodeEditor,
})
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

.oc-rich-text-editor__surface :deep(ul),
.oc-rich-text-editor__surface :deep(ol) {
  margin-block: var(--oc-space-2);
  padding-inline-start: var(--oc-space-5);
}

.oc-rich-text-editor__surface :deep(table) {
  width: 100%;
  margin-block: var(--oc-space-2);
  border-collapse: collapse;
  table-layout: fixed;
}

.oc-rich-text-editor__surface :deep(th),
.oc-rich-text-editor__surface :deep(td) {
  min-width: var(--oc-size-lg);
  padding: var(--oc-space-1) var(--oc-space-2);
  border: var(--oc-border-width) solid var(--oc-border-default);
  vertical-align: top;
}

.oc-rich-text-editor__surface :deep([class~="selectedCell"]) {
  background: var(--oc-bg-selected);
}

.oc-rich-text-editor__node-edit-layer {
  display: grid;
  max-width: var(--oc-dialog-width-md);
  max-height: inherit;
  gap: var(--oc-space-2);
  padding: var(--oc-floating-surface-padding);
  overflow: auto;
}

.oc-rich-text-editor__node-dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
</style>
