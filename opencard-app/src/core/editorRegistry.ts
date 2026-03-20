import type { Component } from 'vue'

// 编辑器接口定义
export interface IEditor {
  // 编辑器唯一标识
  id: string
  // 编辑器显示名称
  name: string
  // 支持的文件扩展名
  extensions: string[]
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
  private extensionMap: Map<string, string> = new Map()

  // 注册编辑器
  register(editor: IEditor) {
    this.editors.set(editor.id, editor)
    // 为每个扩展名建立映射
    editor.extensions.forEach(ext => {
      this.extensionMap.set(ext, editor.id)
    })
  }

  // 根据文件扩展名获取编辑器
  getEditorByExtension(extension: string): IEditor | undefined {
    const editorId = this.extensionMap.get(extension)
    return editorId ? this.editors.get(editorId) : undefined
  }

  // 根据文件路径获取编辑器
  getEditorByPath(filePath: string): IEditor | undefined {
    const ext = filePath.split('.').pop()
    return ext ? this.getEditorByExtension(ext) : undefined
  }

  // 获取所有编辑器
  getAllEditors(): IEditor[] {
    return Array.from(this.editors.values())
  }
}

import MonacoEditor from '../components/editors/MonacoEditor.vue'
import CardDesignEditor from '../components/editors/CardDesignEditor.vue'

// 单例实例
export const editorRegistry = new EditorRegistry()

// 注册内置编辑器
editorRegistry.register({
  id: 'monaco',
  name: 'Monaco Editor',
  extensions: ['md', 'txt', 'css', 'html', 'json'],
  component: MonacoEditor,
  hasPreview: false
})

editorRegistry.register({
  id: 'card-designer',
  name: 'Card Designer',
  extensions: ['opencard'],
  component: CardDesignEditor,
  hasPreview: false
})
