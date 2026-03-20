/** 所有编辑器组件都要实现的通用接口 */

export interface EditorProps {
  filePath: string
}

export interface EditorEmits {
  (e: 'save'): void
  (e: 'modified', isModified: boolean): void
}
