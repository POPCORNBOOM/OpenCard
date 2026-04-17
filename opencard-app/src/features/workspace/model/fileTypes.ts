import type { IconName, IconTone } from '../../../shared/ui/icon/iconRegistry'

export interface FileTypeDefinition {
  id: string
  labelKey: string
  extensions?: string[]
  fileNames?: string[]
  icon: IconName
  iconTone?: IconTone
  iconColor?: string
  language?: string
  editorId: string
  previewable?: boolean
}

export interface EntryIconPresentation {
  icon: IconName
  tone?: IconTone
  color?: string
}

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
    iconColor: 'var(--icon-opencard)',
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
    iconColor: 'var(--icon-json)',
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
    iconColor: 'var(--icon-markdown)',
    language: 'markdown',
    editorId: 'monaco',
  },
  {
    id: 'typescript',
    labelKey: 'fileTypes.typescript',
    extensions: ['ts', 'tsx'],
    fileNames: ['vite.config.ts'],
    icon: 'file.typescript',
    iconColor: 'var(--icon-typescript)',
    language: 'typescript',
    editorId: 'monaco',
  },
  {
    id: 'javascript',
    labelKey: 'fileTypes.javascript',
    extensions: ['js', 'jsx', 'mjs', 'cjs'],
    icon: 'file.javascript',
    iconColor: 'var(--icon-javascript)',
    language: 'javascript',
    editorId: 'monaco',
  },
  {
    id: 'vue',
    labelKey: 'fileTypes.vue',
    extensions: ['vue'],
    icon: 'file.vue',
    iconColor: 'var(--icon-vue)',
    language: 'vue',
    editorId: 'monaco',
  },
  {
    id: 'html',
    labelKey: 'fileTypes.html',
    extensions: ['html'],
    icon: 'file.html',
    iconColor: 'var(--icon-html)',
    language: 'html',
    editorId: 'monaco',
  },
  {
    id: 'css',
    labelKey: 'fileTypes.css',
    extensions: ['css', 'scss', 'sass', 'less'],
    icon: 'file.css',
    iconColor: 'var(--icon-css)',
    language: 'css',
    editorId: 'monaco',
  },
  {
    id: 'image',
    labelKey: 'fileTypes.image',
    extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
    icon: 'file.image',
    iconColor: 'var(--icon-image)',
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
  'package.json': { icon: 'file.package', color: 'var(--icon-package)' },
  'package-lock.json': { icon: 'file.lock', tone: 'warning' },
  'tsconfig.json': { icon: 'file.settings', color: 'var(--icon-config)' },
  'jsconfig.json': { icon: 'file.settings', color: 'var(--icon-config)' },
  'vite.config.ts': { icon: 'file.settings', color: 'var(--icon-config)' },
}

const directoryIcons: Record<string, { collapsed: EntryIconPresentation; expanded: EntryIconPresentation }> = {
  src: {
    collapsed: { icon: 'folder.src', color: 'var(--icon-folder-src)' },
    expanded: { icon: 'folder.srcExpanded', color: 'var(--icon-folder-open)' },
  },
  assets: {
    collapsed: { icon: 'folder.assets', color: 'var(--icon-folder-assets)' },
    expanded: { icon: 'folder.assetsExpanded', color: 'var(--icon-folder-open)' },
  },
  components: {
    collapsed: { icon: 'folder.components', color: 'var(--icon-folder-components)' },
    expanded: { icon: 'folder.componentsExpanded', color: 'var(--icon-folder-open)' },
  },
  views: {
    collapsed: { icon: 'folder.views', color: 'var(--icon-folder-views)' },
    expanded: { icon: 'folder.viewsExpanded', color: 'var(--icon-folder-open)' },
  },
  locales: {
    collapsed: { icon: 'folder.locales', color: 'var(--icon-folder-locales)' },
    expanded: { icon: 'folder.localesExpanded', color: 'var(--icon-folder-open)' },
  },
  core: {
    collapsed: { icon: 'folder.core', color: 'var(--icon-folder-core)' },
    expanded: { icon: 'folder.coreExpanded', color: 'var(--icon-folder-open)' },
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
      iconColor: specialPresentation?.color ?? fileNameMatch.iconColor,
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
    icon: isExpanded ? 'folder.defaultExpanded' : 'folder.default',
    color: isExpanded ? 'var(--icon-folder-open)' : 'var(--icon-folder-default)',
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
    color: fileType.iconColor,
  }
}
