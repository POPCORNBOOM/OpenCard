/**
 * 模块说明：
 * - 维护编辑器协议定义与内置编辑器注册表
 * 职责边界：
 * - 只负责 `editorId -> component` 映射 不处理文件类型判定
 */

import type { Component } from 'vue'
import type {
  CardDesignerLayoutState,
  CardDesignerViewState,
  EditorViewportTransform,
} from '../model/editorUiState'
import type { EditorIssueSnapshot } from '../model/editorIssue'
import type { OcThemeId } from '../../../shared/ui/foundation'

export interface EditorProps {
  filePath: string
  fileName?: string
  resourceRootPath?: string | null
  modelValue?: string
  viewportTransform?: EditorViewportTransform
  cardDesignerLayout?: CardDesignerLayoutState
  cardDesignerView?: CardDesignerViewState
  structureTreeSelectionBehavior?: 'none' | 'expand' | 'expand-exclusive'
  structureTreeScrollToSelection?: boolean
  showSelectionPositionOnMove?: boolean
  showSelectionSizeOnResize?: boolean
  themeId?: OcThemeId
}

export interface EditorEmits {
  (e: 'save'): void
  (e: 'modified', isModified: boolean): void
  (e: 'update:modelValue', value: string): void
  (e: 'update-viewport-transform', value: EditorViewportTransform): void
  (e: 'update-card-designer-layout', value: CardDesignerLayoutState): void
  (e: 'update-card-designer-view', value: CardDesignerViewState): void
  (e: 'issue-snapshot', snapshot: EditorIssueSnapshot): void
  (e: 'open-file', path: string): void
}

// 编辑器接口定义
export interface IEditor {
  // 编辑器唯一标识
  id: string
  // 编辑器显示名称
  name: string
  // Vue 组件引用
  component: Component
  // 是否支持预览
  hasPreview?: boolean
  // 预览组件名称
  previewComponent?: string
}

// 编辑器注册表
class EditorRegistry {
  private editors: Map<string, IEditor> = new Map()

  // 注册编辑器
  register(editor: IEditor) {
    this.editors.set(editor.id, editor)
  }

  getEditor(editorId: string): IEditor | undefined {
    return this.editors.get(editorId)
  }

  // 获取所有编辑器
  getAllEditors(): IEditor[] {
    return Array.from(this.editors.values())
  }
}

import MonacoEditor from '../../../components/editors/MonacoEditor.vue'
import CardDesignEditor from '../../card-designer/CardDesignEditor.vue'
import ImagePreviewEditor from '../../../components/editors/ImagePreviewEditor.vue'
import ProjectConfigEditor from '../../../components/editors/ProjectConfigEditor.vue'
import DictionaryEditor from '../../../components/editors/DictionaryEditor.vue'

// 单例实例
export const editorRegistry = new EditorRegistry()

// 在此处注册内置编辑器
editorRegistry.register({
  id: 'monaco',
  name: 'Monaco Editor',
  component: MonacoEditor,
  hasPreview: false
})

editorRegistry.register({
  id: 'card-designer',
  name: 'Card Designer',
  component: CardDesignEditor,
  hasPreview: false
})

editorRegistry.register({
  id: 'image-preview',
  name: 'Image Preview',
  component: ImagePreviewEditor,
  hasPreview: false,
})

editorRegistry.register({
  id: 'project-config',
  name: 'Project Configuration',
  component: ProjectConfigEditor,
  hasPreview: false,
})

editorRegistry.register({
  id: 'dictionary',
  name: 'Dictionary',
  component: DictionaryEditor,
  hasPreview: false,
})
