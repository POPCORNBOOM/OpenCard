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
  projectTreePriority?: number
}

export interface ProjectTreeFilePresentation {
  labelKey: string
  priority: number
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
  config: 'config',
  folderDefault: 'folder-default',
  folderOpen: 'folder-open',
} as const satisfies Record<string, EntryIconTone>

const defaultFileType: FileTypeDefinition = {
  id: 'unsupported',
  labelKey: 'fileTypes.unsupported',
  icon: 'file.generic',
  iconTone: 'muted',
  editorId: 'unsupported-file',
}

const fileTypes: FileTypeDefinition[] = [
  {
    id: 'plaintext',
    labelKey: 'fileTypes.plaintext',
    extensions: ['txt'],
    icon: 'file.text',
    iconTone: 'muted',
    language: 'plaintext',
    editorId: 'monaco',
  },
  {
    id: 'opencard-project-profile',
    labelKey: 'fileTypes.opencardProjectProfile',
    fileNames: ['.opencardprojectprofile'],
    icon: 'file.opencard-project',
    iconTone: iconTone.config,
    language: 'json',
    editorId: 'project-config',
    previewable: true,
    projectTreePriority: 0,
  },
  {
    id: 'opencard-font-registry',
    labelKey: 'fileTypes.opencardFontRegistry',
    fileNames: ['.fontreg'],
    icon: 'file.font',
    iconTone: iconTone.config,
    language: 'json',
    editorId: 'font-registry',
    previewable: true,
    projectTreePriority: 1,
  },
  {
    id: 'opencard-icon-registry',
    labelKey: 'fileTypes.opencardIconRegistry',
    fileNames: ['.iconreg'],
    icon: 'file.image',
    iconTone: iconTone.config,
    language: 'json',
    editorId: 'icon-registry',
    previewable: true,
    projectTreePriority: 2,
  },
  {
    id: 'opencard-dictionary',
    labelKey: 'fileTypes.opencardDictionary',
    fileNames: ['.dictionary'],
    icon: 'data.collection',
    iconTone: iconTone.config,
    language: 'json',
    editorId: 'dictionary',
    previewable: true,
    projectTreePriority: 3,
  },
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
    id: 'font',
    labelKey: 'fileTypes.font',
    extensions: ['woff', 'woff2', 'ttf', 'otf'],
    icon: 'file.font',
    iconTone: 'active',
    editorId: 'font-preview',
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
  '.opencardprojectprofile': { icon: 'file.opencard-project', tone: iconTone.config },
  '.fontreg': { icon: 'file.font', tone: iconTone.config },
  '.iconreg': { icon: 'file.image', tone: iconTone.config },
  '.dictionary': { icon: 'data.collection', tone: iconTone.config },
  'package.json': { icon: 'file.package', tone: iconTone.config },
  'package-lock.json': { icon: 'file.lock', tone: 'warning' },
  'tsconfig.json': { icon: 'file.settings', tone: iconTone.config },
  'jsconfig.json': { icon: 'file.settings', tone: iconTone.config },
  'vite.config.ts': { icon: 'file.settings', tone: iconTone.config },
}

const directoryIcons: Record<string, { collapsed: EntryIconPresentation; expanded: EntryIconPresentation }> = {
  src: {
    collapsed: { icon: 'folder.src', tone: iconTone.folderDefault },
    expanded: { icon: 'folder.open', tone: iconTone.folderOpen },
  },
  assets: {
    collapsed: { icon: 'folder.assets', tone: iconTone.folderDefault },
    expanded: { icon: 'folder.open', tone: iconTone.folderOpen },
  },
  components: {
    collapsed: { icon: 'folder.components', tone: iconTone.folderDefault },
    expanded: { icon: 'folder.open', tone: iconTone.folderOpen },
  },
  views: {
    collapsed: { icon: 'folder.views', tone: iconTone.folderDefault },
    expanded: { icon: 'folder.open', tone: iconTone.folderOpen },
  },
  locales: {
    collapsed: { icon: 'folder.locales', tone: iconTone.folderDefault },
    expanded: { icon: 'folder.open', tone: iconTone.folderOpen },
  },
  core: {
    collapsed: { icon: 'folder.core', tone: iconTone.folderDefault },
    expanded: { icon: 'folder.open', tone: iconTone.folderOpen },
  },
}

function normalizeSegment(value: string): string {
  return value.trim().toLowerCase()
}

function isWindowsLikePath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/')
  return /^[A-Za-z]:\//.test(normalized) || normalized.startsWith('//')
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

function isProjectRootFile(path: string, projectRoot: string): boolean {
  const normalizedPath = path.replace(/\\/g, '/')
  const separatorIndex = normalizedPath.lastIndexOf('/')
  if (separatorIndex < 0) return true
  const parentPath = normalizedPath.slice(0, separatorIndex).replace(/\/+$/, '')
  const normalizedRoot = projectRoot.replace(/\\/g, '/').replace(/\/+$/, '')
  return isWindowsLikePath(projectRoot)
    ? parentPath.toLocaleLowerCase() === normalizedRoot.toLocaleLowerCase()
    : parentPath === normalizedRoot
}

export function resolveFileType(path: string, projectRoot?: string): FileTypeDefinition {
  const baseName = normalizeSegment(getBaseName(path))

  const fileNameMatch = fileTypes.find((definition) => {
    const isProjectMetadata = definition.id === 'opencard-project-profile'
      || definition.id === 'opencard-font-registry'
      || definition.id === 'opencard-icon-registry'
      || definition.id === 'opencard-dictionary'
    const compareCaseInsensitive = !isProjectMetadata
      || isWindowsLikePath(projectRoot ?? path)
    const fileNameMatches = definition.fileNames?.some((fileName) => (
      compareCaseInsensitive
        ? normalizeSegment(fileName) === baseName
        : fileName === getBaseName(path)
    ))
    return fileNameMatches && (!projectRoot || !isProjectMetadata || isProjectRootFile(path, projectRoot))
  })
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

export function resolveFileTypeById(fileTypeId: string | null | undefined): FileTypeDefinition {
  if (!fileTypeId) {
    return defaultFileType
  }

  const fileType = fileTypes.find((definition) => definition.id === fileTypeId)
  return fileType ?? defaultFileType
}

export function resolveProjectTreeFilePresentation(
  path: string,
  projectRoot: string,
): ProjectTreeFilePresentation | null {
  const fileType = resolveFileType(path, projectRoot)
  return fileType.projectTreePriority === undefined
    ? null
    : { labelKey: fileType.labelKey, priority: fileType.projectTreePriority }
}

export function resolveDirectoryIcon(path: string, isExpanded: boolean): EntryIconPresentation {
  const baseName = normalizeSegment(getBaseName(path))
  const iconSet = directoryIcons[baseName]
  if (iconSet) {
    return isExpanded ? iconSet.expanded : iconSet.collapsed
  }

  return {
    icon: isExpanded ? 'folder.open' : 'folder.generic',
    tone: isExpanded ? iconTone.folderOpen : iconTone.folderDefault,
  }
}

export function resolveEntryIcon(
  path: string,
  isDirectory: boolean,
  isExpanded = false,
  projectRoot?: string,
): EntryIconPresentation {
  if (isDirectory) {
    return resolveDirectoryIcon(path, isExpanded)
  }

  const fileType = resolveFileType(path, projectRoot)
  return {
    icon: fileType.icon,
    tone: fileType.iconTone,
  }
}

