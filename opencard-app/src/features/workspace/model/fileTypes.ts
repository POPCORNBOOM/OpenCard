export { RESOURCE_PACKAGE_EXTENSION, RESOURCE_PACKAGE_SUFFIX } from './resourcePackage'
/**
 * 模块说明：
 * - 定义文件类型语义与文件树图标解析规则
 * 职责边界：
 * - 只返回文件语义结果 不处理编辑器渲染流程
 */
import type { IconToken, IconTone } from '../../../shared/ui/icon/iconRegistry'
import { PROJECT_INTERNAL_DIRECTORY_NAME } from './projectStructure'

export const CARD_DOCUMENT_EXTENSION = 'ocdocument'
export const CARD_DOCUMENT_SUFFIX = `.${CARD_DOCUMENT_EXTENSION}`

export interface FileTypeDefinition {
  id: string
  labelKey: string
  extensions?: string[]
  patterns?: string[]
  fileNames?: string[]
  icon: IconToken
  iconTone?: IconTone
  language?: string
  editorId: string
  previewable?: boolean
  projectTreePriority?: number
}

export interface ProjectTreeFilePresentation {
  annotationKey: string
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
    patterns: ['.opencard/project.json'],
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
    patterns: ['.opencard/fonts/fonts.json'],
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
    patterns: ['.opencard/icons/icons.json'],
    icon: 'file.project-icon',
    iconTone: iconTone.config,
    language: 'json',
    editorId: 'icon-registry',
    previewable: true,
    projectTreePriority: 2,
  },
  {
    id: 'opencard-dictionary',
    labelKey: 'fileTypes.opencardDictionary',
    patterns: ['.opencard/locale.json'],
    icon: 'file.dictionary',
    iconTone: iconTone.config,
    language: 'json',
    editorId: 'dictionary',
    previewable: true,
    projectTreePriority: 3,
  },
  {
    id: 'opencard-project-package-manifest',
    labelKey: 'fileTypes.opencardResourcePackage',
    patterns: ['.opencard/packages/packages.json'],
    icon: 'file.package',
    iconTone: iconTone.config,
    language: 'json',
    editorId: 'external-package-manager',
    previewable: true,
    projectTreePriority: 5,
  },
  {
    id: 'opencard-resource-package',
    labelKey: 'fileTypes.opencardResourcePackage',
    extensions: ['ocpack'],
    icon: 'file.package',
    iconTone: iconTone.opencard,
    editorId: 'unsupported-file',
  },
  {
    id: 'opencard',
    labelKey: 'fileTypes.opencard',
    extensions: [CARD_DOCUMENT_EXTENSION],
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
    patterns: ['**/package.json'],
    fileNames: ['package-lock.json', 'tsconfig.json', 'jsconfig.json'],
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
    extensions: ['woff', 'woff2', 'ttf', 'otf', 'ttc', 'otc'],
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

function globMatches(value: string, pattern: string, caseInsensitive: boolean): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
  return new RegExp(`^${escaped}$`, caseInsensitive ? 'i' : '').test(value)
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

function isProjectInternalFile(path: string, projectRoot: string): boolean {
  const normalizedPath = path.replace(/\\/g, '/')
  const separatorIndex = normalizedPath.lastIndexOf('/')
  if (separatorIndex < 0) return true
  const parentPath = normalizedPath.slice(0, separatorIndex).replace(/\/+$/, '')
  const normalizedRoot = `${projectRoot.replace(/\\/g, '/').replace(/\/+$/, '')}/${PROJECT_INTERNAL_DIRECTORY_NAME}`
  return isWindowsLikePath(projectRoot)
    ? parentPath.toLocaleLowerCase() === normalizedRoot.toLocaleLowerCase()
    : parentPath === normalizedRoot
}

function isRegisteredManagedSource(
  path: string,
  projectRoot: string | undefined,
  registeredSources: ReadonlySet<string> | undefined,
): boolean {
  if (!projectRoot || !registeredSources) return false

  const normalizedPath = path.replace(/\\/g, '/')
  const normalizedRoot = projectRoot.replace(/\\/g, '/').replace(/\/+$/, '')
  const prefix = `${normalizedRoot}/`
  const relativePath = isWindowsLikePath(projectRoot)
    ? normalizedPath.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())
      ? normalizedPath.slice(prefix.length)
      : null
    : normalizedPath.startsWith(prefix)
      ? normalizedPath.slice(prefix.length)
      : null
  if (!relativePath) return false

  return [...registeredSources].some((source) => {
    const normalizedSource = source.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    return isWindowsLikePath(projectRoot)
      ? normalizedSource.toLocaleLowerCase() === relativePath.toLocaleLowerCase()
      : normalizedSource === relativePath
  })
}

export function resolveFileType(path: string, projectRoot?: string): FileTypeDefinition {
  const baseName = normalizeSegment(getBaseName(path))
  const normalizedPath = path.replace(/\\/g, '/').replace(/^.*?(?=\.opencard\/)/i, '').replace(/^\/+/, '')
  const caseInsensitive = isWindowsLikePath(projectRoot ?? path)

  const patternMatch = fileTypes.find((definition) => definition.patterns?.some((pattern) => (
    globMatches(normalizedPath, pattern, caseInsensitive)
  )))
  if (patternMatch) return patternMatch

  const fileNameMatch = fileTypes.find((definition) => {
    const matches = definition.fileNames?.some((fileName) => (
      caseInsensitive ? normalizeSegment(fileName) === baseName : fileName === getBaseName(path)
    ))
    const isLegacyProjectAlias = definition.id.startsWith('opencard-')
      && definition.fileNames?.some((fileName) => fileName.startsWith('.oc'))
    return Boolean(matches) && (!isLegacyProjectAlias || !projectRoot || isProjectInternalFile(path, projectRoot))
  })
  if (fileNameMatch) return fileNameMatch

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
    : { annotationKey: fileType.labelKey, priority: fileType.projectTreePriority }
}

export function resolveDirectoryIcon(_path: string, isExpanded: boolean): EntryIconPresentation {
  return {
    icon: isExpanded ? 'folder.open' : 'folder.generic',
    tone: iconTone.folderOpen,
  }
}

export function resolveEntryIcon(
  path: string,
  isDirectory: boolean,
  isExpanded = false,
  projectRoot?: string,
  registeredFontSources?: ReadonlySet<string>,
  registeredIconSources?: ReadonlySet<string>,
): EntryIconPresentation {
  if (isDirectory) {
    return resolveDirectoryIcon(path, isExpanded)
  }

  const fileType = resolveFileType(path, projectRoot)
  if (fileType.id === 'font'
    && projectRoot
    && registeredFontSources
    && !isRegisteredManagedSource(path, projectRoot, registeredFontSources)) {
    return {
      icon: 'file.font',
      tone: 'muted',
    }
  }
  if (fileType.id === 'image'
    && projectRoot
    && registeredIconSources
    && !isRegisteredManagedSource(path, projectRoot, registeredIconSources)) {
    return { icon: 'file.image', tone: 'muted' }
  }
  return {
    icon: fileType.icon,
    tone: fileType.iconTone,
  }
}

