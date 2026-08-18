import { convertFileSrc } from '@tauri-apps/api/core'
import type { ProjectRemoteResourcePolicy } from '../workspace/model/projectMetadata'
import {
  EMPTY_PROJECT_ICON_CATALOG,
  type ProjectIconCatalog,
} from '../workspace/services/projectIconCatalog'
import {
  isRemoteResourceAllowed,
  resolveEditorResourcePath,
} from '../editor-runtime/services/editorResource'
import type { CustomBlockRuntimeCatalog } from './expandCustomBlocks'
import type { PreparedRichTextCatalog } from './prepareRichText'
import { createProjectCustomBlockFontFamily } from '../workspace/services/projectCustomBlockResources'

export type CardRenderResourceContext = {
  readonly resourceRootPath: string | null
  readonly remoteResourcePolicy?: ProjectRemoteResourcePolicy
  readonly customBlockCatalog: CustomBlockRuntimeCatalog
  readonly projectIconCatalog: ProjectIconCatalog
  readonly richText?: PreparedRichTextCatalog
  readonly resolveFontFamily?: (references: string) => string
}

export function createCardRenderResourceContext(options: {
  resourceRootPath?: string | null
  remoteResourcePolicy?: ProjectRemoteResourcePolicy
  customBlockCatalog?: CustomBlockRuntimeCatalog
  projectIconCatalog?: ProjectIconCatalog
  richText?: PreparedRichTextCatalog
  resolveFontFamily?: (references: string) => string
}): CardRenderResourceContext {
  return {
    resourceRootPath: options.resourceRootPath ?? null,
    remoteResourcePolicy: options.remoteResourcePolicy,
    customBlockCatalog: options.customBlockCatalog ?? new Map(),
    projectIconCatalog: options.projectIconCatalog ?? EMPTY_PROJECT_ICON_CATALOG,
    richText: options.richText ?? new Map(),
    resolveFontFamily: options.resolveFontFamily,
  }
}

export function resolveCardAssetSrc(
  source: string,
  context: CardRenderResourceContext,
): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(source) && !/^[a-z]:[\\/]/i.test(source)) {
    return isRemoteResourceAllowed(source, context.remoteResourcePolicy) ? source : ''
  }
  const resolvedPath = resolveEditorResourcePath(context.resourceRootPath, source)
  return resolvedPath ? convertFileSrc(resolvedPath) : ''
}

export function resolveCustomBlockAssetSrc(
  source: string,
  customBlockKey: string,
  context: CardRenderResourceContext,
): string {
  const match = /^resource:image:([a-z0-9][a-z0-9._-]*)$/i.exec(source.trim())
  if (!match) return resolveCardAssetSrc(source, context)
  const entry = context.customBlockCatalog.get(customBlockKey.toLowerCase())
  const resource = entry?.manifest.resources?.images?.find(candidate => (
    candidate.key.toLowerCase() === match[1]!.toLowerCase()
  ))
  return resource ? entry?.resourceUrls?.get(resource.source.toLowerCase()) ?? '' : ''
}

export function resolveCustomBlockFontFamily(
  value: string,
  customBlockKey: string,
  context: CardRenderResourceContext,
  fallback: (value: string) => string,
): string {
  const entry = context.customBlockCatalog.get(customBlockKey.toLowerCase())
  const mapped = value.split(';').map(candidate => {
    const trimmed = candidate.trim()
    const match = /^resource:font:([a-z0-9][a-z0-9._-]*)$/i.exec(trimmed)
    if (!match) return trimmed
    const resource = entry?.manifest.resources?.fonts?.find(font => (
      font.key.toLowerCase() === match[1]!.toLowerCase()
    ))
    return resource ? JSON.stringify(createProjectCustomBlockFontFamily(customBlockKey, resource.key)) : ''
  }).filter(Boolean)
  return fallback(mapped.join('; '))
}
