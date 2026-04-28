/**
 * 模块说明：
 * - 定义文件类型语义与文件树图标解析规则
 * 职责边界：
 * - 只返回文件语义结果 不处理编辑器渲染流程
 */
import type { IconToken, IconTone } from '../../../shared/ui/icon/iconRegistry'

export interface FileTypeDefinition {
  id: string
  labelKey: string
  extensions?: string[]
  fileNames?: string[]
  icon: IconToken
  iconTone?: IconTone
  language?: string
  editorId: string
  previewable?: boolean
}

export interface EntryIconPresentation {
  icon: IconToken
  tone?: EntryIconTone
}

type EntryIconTone = IconTone

const iconTone = {
  opencard: 'opencard',
  json: 'json',
  markdown: 'markdown',
  typescript: 'typescript',
  javascript: 'javascript',
  vue: 'vue',
  html: 'html',
  css: 'css',
  image: 'image',
  package: 'package',
  config: 'config',
  folderDefault: 'folder-default',
  folderOpen: 'folder-open',
  folderSrc: 'folder-src',
  folderAssets: 'folder-assets',
  folderComponents: 'folder-components',
  folderViews: 'folder-views',
  folderLocales: 'folder-locales',
  folderCore: 'folder-core',
} as const satisfies Record<string, EntryIconTone>

const defaultFileType: FileTypeDefinition = {
  id: 'plaintext',
  labelKey: 'fileTypes.plaintext',
  extensions: ['txt'],
  icon: 'file.text',
  iconTone: 'muted',
  language: 'plaintext',
  editorId: 'monaco',
}

const fileTypes: FileTypeDefinition[] = [
  {
    id: 'opencard',
    labelKey: 'fileTypes.opencard',
    extensions: ['opencard'],
    icon: 'file.opencard',
    iconTone: iconTone.opencard,
    language: 'json',
    editorId: 'card-designer',
    previewable: true,
  },
  {
    id: 'json',
    labelKey: 'fileTypes.json',
    extensions: ['json'],
    fileNames: ['package.json', 'package-lock.json', 'tsconfig.json', 'jsconfig.json'],
    icon: 'file.json',
    iconTone: iconTone.json,
    language: 'json',
    editorId: 'monaco',
    previewable: true,
  },
  {
    id: 'markdown',
    labelKey: 'fileTypes.markdown',
    extensions: ['md'],
    fileNames: ['readme.md'],
    icon: 'file.markdown',
    iconTone: iconTone.markdown,
    language: 'markdown',
    editorId: 'monaco',
  },
  {
    id: 'typescript',
    labelKey: 'fileTypes.typescript',
    extensions: ['ts', 'tsx'],
    fileNames: ['vite.config.ts'],
    icon: 'file.typescript',
    iconTone: iconTone.typescript,
    language: 'typescript',
    editorId: 'monaco',
  },
  {
    id: 'javascript',
    labelKey: 'fileTypes.javascript',
    extensions: ['js', 'jsx', 'mjs', 'cjs'],
    icon: 'file.javascript',
    iconTone: iconTone.javascript,
    language: 'javascript',
    editorId: 'monaco',
  },
  {
    id: 'vue',
    labelKey: 'fileTypes.vue',
    extensions: ['vue'],
    icon: 'file.vue',
    iconTone: iconTone.vue,
    language: 'vue',
    editorId: 'monaco',
  },
  {
    id: 'html',
    labelKey: 'fileTypes.html',
    extensions: ['html'],
    icon: 'file.html',
    iconTone: iconTone.html,
    language: 'html',
    editorId: 'monaco',
  },
  {
    id: 'css',
    labelKey: 'fileTypes.css',
    extensions: ['css', 'scss', 'sass', 'less'],
    icon: 'file.css',
    iconTone: iconTone.css,
    language: 'css',
    editorId: 'monaco',
  },
  {
    id: 'image',
    labelKey: 'fileTypes.image',
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
    icon: 'file.image',
    iconTone: iconTone.image,
    editorId: 'image-preview',
  },
  {
    id: 'env',
    labelKey: 'fileTypes.env',
    fileNames: ['.env', '.env.local', '.env.development', '.env.production'],
    icon: 'file.env',
    iconTone: 'warning',
    language: 'plaintext',
    editorId: 'monaco',
  },
  {
    id: 'gitignore',
    labelKey: 'fileTypes.git',
    fileNames: ['.gitignore', '.gitattributes'],
    icon: 'file.git',
    iconTone: 'danger',
    language: 'plaintext',
    editorId: 'monaco',
  },
]

const specialFileIcons: Record<string, EntryIconPresentation> = {
  'package.json': { icon: 'file.package', tone: iconTone.package },
  'package-lock.json': { icon: 'file.lock', tone: 'warning' },
  'tsconfig.json': { icon: 'file.settings', tone: iconTone.config },
  'jsconfig.json': { icon: 'file.settings', tone: iconTone.config },
  'vite.config.ts': { icon: 'file.settings', tone: iconTone.config },
}

const directoryIcons: Record<string, { collapsed: EntryIconPresentation; expanded: EntryIconPresentation }> = {
  src: {
    collapsed: { icon: 'folder.src', tone: iconTone.folderSrc },
    expanded: { icon: 'folder.src-expanded', tone: iconTone.folderOpen },
  },
  assets: {
    collapsed: { icon: 'folder.assets', tone: iconTone.folderAssets },
    expanded: { icon: 'folder.assets-expanded', tone: iconTone.folderOpen },
  },
  components: {
    collapsed: { icon: 'folder.components', tone: iconTone.folderComponents },
    expanded: { icon: 'folder.components-expanded', tone: iconTone.folderOpen },
  },
  views: {
    collapsed: { icon: 'folder.views', tone: iconTone.folderViews },
    expanded: { icon: 'folder.views-expanded', tone: iconTone.folderOpen },
  },
  locales: {
    collapsed: { icon: 'folder.locales', tone: iconTone.folderLocales },
    expanded: { icon: 'folder.locales-expanded', tone: iconTone.folderOpen },
  },
  core: {
    collapsed: { icon: 'folder.core', tone: iconTone.folderCore },
    expanded: { icon: 'folder.core-expanded', tone: iconTone.folderOpen },
  },
}

function normalizeSegment(value: string): string {
  return value.trim().toLowerCase()
}

function getBaseName(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const segments = normalized.split('/')
  return segments[segments.length - 1] ?? normalized
}

function getExtension(path: string): string {
  const baseName = getBaseName(path)
  const dotIndex = baseName.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex === baseName.length - 1) {
    return ''
  }

  return normalizeSegment(baseName.slice(dotIndex + 1))
}

export function resolveFileType(path: string): FileTypeDefinition {
  const baseName = normalizeSegment(getBaseName(path))

  const fileNameMatch = fileTypes.find((definition) =>
    definition.fileNames?.some((fileName) => normalizeSegment(fileName) === baseName)
  )
  if (fileNameMatch) {
    const specialPresentation = specialFileIcons[baseName]
    return {
      ...fileNameMatch,
      icon: specialPresentation?.icon ?? fileNameMatch.icon,
      iconTone: specialPresentation?.tone ?? fileNameMatch.iconTone,
    }
  }

  const extension = getExtension(path)
  const extensionMatch = fileTypes.find((definition) =>
    definition.extensions?.some((candidate) => normalizeSegment(candidate) === extension)
  )
  if (extensionMatch) {
    return extensionMatch
  }

  return defaultFileType
}

export function resolveDirectoryIcon(path: string, isExpanded: boolean): EntryIconPresentation {
  const baseName = normalizeSegment(getBaseName(path))
  const iconSet = directoryIcons[baseName]
  if (iconSet) {
    return isExpanded ? iconSet.expanded : iconSet.collapsed
  }

  return {
    icon: isExpanded ? 'folder.default-expanded' : 'folder.default',
    tone: isExpanded ? iconTone.folderOpen : iconTone.folderDefault,
  }
}

export function resolveEntryIcon(path: string, isDirectory: boolean, isExpanded = false): EntryIconPresentation {
  if (isDirectory) {
    return resolveDirectoryIcon(path, isExpanded)
  }

  const fileType = resolveFileType(path)
  return {
    icon: fileType.icon,
    tone: fileType.iconTone,
  }
}

