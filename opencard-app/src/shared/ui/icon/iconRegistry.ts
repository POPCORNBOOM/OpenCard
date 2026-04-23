/**
 * 模块说明：
 * - 定义图标语义键到具体图标实现的统一注册表
 * 职责边界：
 * - 只描述图标映射 不定义颜色尺寸等展示策略
 */
import {
  mdiBroadcast,
  mdiCardTextOutline,
  mdiCardsOutline,
  mdiFileCodeOutline,
  mdiFileImageOutline,
  mdiFileOutline,
  mdiFolderOutline,
  mdiFolderOpenOutline,
  mdiFolderStarOutline,
  mdiFolderWrenchOutline,
  mdiImageOutline,
  mdiLanguageHtml5,
  mdiLanguageJavascript,
  mdiLanguageMarkdownOutline,
  mdiLanguageTypescript,
  mdiLanguageCss3,
  mdiRocketLaunchOutline,
  mdiVuejs,
} from '@mdi/js'

type CodiconIconDefinition = {
  kind: 'codicon'
  value: string
}

type MdiIconDefinition = {
  kind: 'mdi'
  value: string
  viewBox?: string
}

export const iconRegistry = {
  'app.files': { kind: 'codicon', value: 'codicon-files' },
  'app.git': { kind: 'codicon', value: 'codicon-source-control' },
  'app.publish': { kind: 'mdi', value: mdiRocketLaunchOutline },
  'app.close': { kind: 'codicon', value: 'codicon-close' },
  'status.folderOpen': { kind: 'codicon', value: 'codicon-folder-opened' },
  'status.watching': { kind: 'codicon', value: 'codicon-eye' },
  'tree.chevronDown': { kind: 'codicon', value: 'codicon-chevron-down' },
  'tree.chevronRight': { kind: 'codicon', value: 'codicon-chevron-right' },
  'file.default': { kind: 'mdi', value: mdiFileOutline },
  'file.text': { kind: 'mdi', value: mdiCardTextOutline },
  'file.json': { kind: 'codicon', value: 'codicon-json' },
  'file.markdown': { kind: 'mdi', value: mdiLanguageMarkdownOutline },
  'file.typescript': { kind: 'mdi', value: mdiLanguageTypescript },
  'file.javascript': { kind: 'mdi', value: mdiLanguageJavascript },
  'file.vue': { kind: 'mdi', value: mdiVuejs },
  'file.html': { kind: 'mdi', value: mdiLanguageHtml5 },
  'file.css': { kind: 'mdi', value: mdiLanguageCss3 },
  'file.image': { kind: 'mdi', value: mdiFileImageOutline },
  'file.package': { kind: 'codicon', value: 'codicon-package' },
  'file.settings': { kind: 'codicon', value: 'codicon-settings' },
  'file.lock': { kind: 'codicon', value: 'codicon-lock' },
  'file.git': { kind: 'codicon', value: 'codicon-source-control' },
  'file.env': { kind: 'codicon', value: 'codicon-key' },
  'file.opencard': { kind: 'mdi', value: mdiCardsOutline },
  'folder.default': { kind: 'mdi', value: mdiFolderOutline },
  'folder.defaultExpanded': { kind: 'mdi', value: mdiFolderOpenOutline },
  'folder.src': { kind: 'mdi', value: mdiFileCodeOutline },
  'folder.srcExpanded': { kind: 'mdi', value: mdiFolderOpenOutline },
  'folder.assets': { kind: 'mdi', value: mdiImageOutline },
  'folder.assetsExpanded': { kind: 'mdi', value: mdiFolderOpenOutline },
  'folder.components': { kind: 'mdi', value: mdiFolderStarOutline },
  'folder.componentsExpanded': { kind: 'mdi', value: mdiFolderOpenOutline },
  'folder.views': { kind: 'codicon', value: 'codicon-layout' },
  'folder.viewsExpanded': { kind: 'codicon', value: 'codicon-folder-opened' },
  'folder.locales': { kind: 'codicon', value: 'codicon-globe' },
  'folder.localesExpanded': { kind: 'codicon', value: 'codicon-folder-opened' },
  'folder.core': { kind: 'mdi', value: mdiFolderWrenchOutline },
  'folder.coreExpanded': { kind: 'mdi', value: mdiFolderOpenOutline },
  'misc.preview': { kind: 'mdi', value: mdiBroadcast },
  'misc.code': { kind: 'mdi', value: mdiFileCodeOutline },
  // Strict-route semantic aliases for all codicon usages in repository.
  'icon.account': { kind: 'codicon', value: 'codicon-account' },
  'icon.add': { kind: 'codicon', value: 'codicon-add' },
  'icon.arrow-left-right': { kind: 'codicon', value: 'codicon-arrow-left-right' },
  'icon.arrow-right': { kind: 'codicon', value: 'codicon-arrow-right' },
  'icon.arrow-swap': { kind: 'codicon', value: 'codicon-arrow-swap' },
  'icon.arrow-up': { kind: 'codicon', value: 'codicon-arrow-up' },
  'icon.check': { kind: 'codicon', value: 'codicon-check' },
  'icon.chevron-down': { kind: 'codicon', value: 'codicon-chevron-down' },
  'icon.chevron-left': { kind: 'codicon', value: 'codicon-chevron-left' },
  'icon.chevron-right': { kind: 'codicon', value: 'codicon-chevron-right' },
  'icon.circle-slash': { kind: 'codicon', value: 'codicon-circle-slash' },
  'icon.close': { kind: 'codicon', value: 'codicon-close' },
  'icon.collection': { kind: 'codicon', value: 'codicon-collection' },
  'icon.compass': { kind: 'codicon', value: 'codicon-compass' },
  'icon.copy': { kind: 'codicon', value: 'codicon-copy' },
  'icon.debug-restart': { kind: 'codicon', value: 'codicon-debug-restart' },
  'icon.discard': { kind: 'codicon', value: 'codicon-discard' },
  'icon.edit': { kind: 'codicon', value: 'codicon-edit' },
  'icon.error': { kind: 'codicon', value: 'codicon-error' },
  'icon.export': { kind: 'codicon', value: 'codicon-export' },
  'icon.eye': { kind: 'codicon', value: 'codicon-eye' },
  'icon.file': { kind: 'codicon', value: 'codicon-file' },
  'icon.file-code': { kind: 'codicon', value: 'codicon-file-code' },
  'icon.file-media': { kind: 'codicon', value: 'codicon-file-media' },
  'icon.file-text': { kind: 'codicon', value: 'codicon-file-text' },
  'icon.files': { kind: 'codicon', value: 'codicon-files' },
  'icon.folder': { kind: 'codicon', value: 'codicon-folder' },
  'icon.folder-opened': { kind: 'codicon', value: 'codicon-folder-opened' },
  'icon.globe': { kind: 'codicon', value: 'codicon-globe' },
  'icon.json': { kind: 'codicon', value: 'codicon-json' },
  'icon.key': { kind: 'codicon', value: 'codicon-key' },
  'icon.layers': { kind: 'codicon', value: 'codicon-layers' },
  'icon.layout': { kind: 'codicon', value: 'codicon-layout' },
  'icon.list-selection': { kind: 'codicon', value: 'codicon-list-selection' },
  'icon.list-tree': { kind: 'codicon', value: 'codicon-list-tree' },
  'icon.lock': { kind: 'codicon', value: 'codicon-lock' },
  'icon.menu': { kind: 'codicon', value: 'codicon-menu' },
  'icon.package': { kind: 'codicon', value: 'codicon-package' },
  'icon.play': { kind: 'codicon', value: 'codicon-play' },
  'icon.rocket': { kind: 'codicon', value: 'codicon-rocket' },
  'icon.save': { kind: 'codicon', value: 'codicon-save' },
  'icon.search': { kind: 'codicon', value: 'codicon-search' },
  'icon.settings': { kind: 'codicon', value: 'codicon-settings' },
  'icon.settings-gear': { kind: 'codicon', value: 'codicon-settings-gear' },
  'icon.source-control': { kind: 'codicon', value: 'codicon-source-control' },
  'icon.star-full': { kind: 'codicon', value: 'codicon-star-full' },
  'icon.symbol-boolean': { kind: 'codicon', value: 'codicon-symbol-boolean' },
  'icon.symbol-class': { kind: 'codicon', value: 'codicon-symbol-class' },
  'icon.symbol-color': { kind: 'codicon', value: 'codicon-symbol-color' },
  'icon.symbol-key': { kind: 'codicon', value: 'codicon-symbol-key' },
  'icon.symbol-number': { kind: 'codicon', value: 'codicon-symbol-number' },
  'icon.symbol-string': { kind: 'codicon', value: 'codicon-symbol-string' },
  'icon.trash': { kind: 'codicon', value: 'codicon-trash' },
  'icon.warning': { kind: 'codicon', value: 'codicon-warning' },
} as const satisfies Record<string, CodiconIconDefinition | MdiIconDefinition>

export type IconName = keyof typeof iconRegistry

export type IconDefinition = CodiconIconDefinition | MdiIconDefinition
export type IconTone = 'default' | 'muted' | 'primary' | 'success' | 'warning' | 'danger'
export type IconResolvable = IconName | string | { icon?: IconName | string } | IconDefinition

function isIconDefinition(value: unknown): value is IconDefinition {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<IconDefinition>
  return (
    (candidate.kind === 'codicon' || candidate.kind === 'mdi')
    && typeof candidate.value === 'string'
  )
}

export function resolveIcon(name?: IconResolvable): IconDefinition {
  if (isIconDefinition(name)) {
    return name
  }

  if (name && typeof name === 'object' && 'icon' in name && typeof name.icon === 'string') {
    return resolveIcon(name.icon)
  }

  if (typeof name === 'string' && name in iconRegistry) {
    return iconRegistry[name as IconName]
  }

  return iconRegistry['file.default']
}
