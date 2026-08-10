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

export type CardRenderResourceContext = {
  readonly resourceRootPath: string | null
  readonly remoteResourcePolicy?: ProjectRemoteResourcePolicy
  readonly customBlockCatalog: CustomBlockRuntimeCatalog
  readonly projectIconCatalog: ProjectIconCatalog
}

export function createCardRenderResourceContext(options: {
  resourceRootPath?: string | null
  remoteResourcePolicy?: ProjectRemoteResourcePolicy
  customBlockCatalog?: CustomBlockRuntimeCatalog
  projectIconCatalog?: ProjectIconCatalog
}): CardRenderResourceContext {
  return {
    resourceRootPath: options.resourceRootPath ?? null,
    remoteResourcePolicy: options.remoteResourcePolicy,
    customBlockCatalog: options.customBlockCatalog ?? new Map(),
    projectIconCatalog: options.projectIconCatalog ?? EMPTY_PROJECT_ICON_CATALOG,
  }
}

export function resolveCardAssetSrc(
  source: string,
  context: CardRenderResourceContext,
): string {
  const packaged = /^ocblock:([^/]+)\/(.+)$/i.exec(source)
  if (packaged) {
    const packageKey = packaged[1]?.toLowerCase()
    const resourcePath = packaged[2]?.toLowerCase()
    if (!packageKey || !resourcePath) return ''
    return context.customBlockCatalog.get(packageKey)?.resourceUrls?.get(resourcePath) ?? ''
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(source) && !/^[a-z]:[\\/]/i.test(source)) {
    return isRemoteResourceAllowed(source, context.remoteResourcePolicy) ? source : ''
  }
  const resolvedPath = resolveEditorResourcePath(context.resourceRootPath, source)
  return resolvedPath ? convertFileSrc(resolvedPath) : ''
}
