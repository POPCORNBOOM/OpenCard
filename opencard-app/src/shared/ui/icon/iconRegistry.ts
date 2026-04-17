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
} as const satisfies Record<string, CodiconIconDefinition | MdiIconDefinition>

export type IconName = keyof typeof iconRegistry

export type IconDefinition = CodiconIconDefinition | MdiIconDefinition
export type IconTone = 'default' | 'muted' | 'primary' | 'success' | 'warning' | 'danger'

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

export function resolveIcon(name?: string | { icon?: string } | IconDefinition): IconDefinition {
  if (isIconDefinition(name)) {
    return name
  }

  if (name && typeof name === 'object' && 'icon' in name && typeof name.icon === 'string') {
    return resolveIcon(name.icon)
  }

  if (typeof name === 'string' && name in iconRegistry) {
    return iconRegistry[name as IconName]
  }

  if (typeof name === 'string' && name.startsWith('codicon-')) {
    return {
      kind: 'codicon',
      value: name,
    }
  }

  return iconRegistry['file.default']
}
