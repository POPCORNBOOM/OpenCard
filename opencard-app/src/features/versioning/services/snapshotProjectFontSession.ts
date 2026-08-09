import { convertFileSrc } from '@tauri-apps/api/core'
import {
  parseProjectFontRegistryText,
  type ProjectFontRegistryDocument,
} from '../../workspace/model/projectFontRegistry'
import {
  createProjectFontCssFamily,
  createProjectFontSetCssFamily,
  type ProjectFontResolutionContext,
} from '../../workspace/model/projectFonts'
import { fileSystemService, type FileSystemService } from '../../workspace/services/fileSystemService'

let sessionSequence = 0

export type SnapshotProjectFontSession = {
  registry: ProjectFontRegistryDocument
  context: ProjectFontResolutionContext
  release: () => void
}

export type SnapshotFontAssetResolver = (rootPath: string, source: string) => string

function snapshotPath(rootPath: string, relativePath: string): string {
  return `${rootPath.replace(/[\\/]+$/, '')}/${relativePath.replace(/^[\\/]+/, '').replace(/\\/g, '/')}`
}

function cssUrl(rootPath: string, source: string): string {
  try {
    return convertFileSrc(snapshotPath(rootPath, source))
  } catch {
    return snapshotPath(rootPath, source)
  }
}

function removeStyle(style: HTMLStyleElement): void {
  style.remove()
}

export async function createSnapshotProjectFontSession(
  rootPath: string,
  fs: Pick<FileSystemService, 'fileExists' | 'readFile'> = fileSystemService,
  resolveAsset: SnapshotFontAssetResolver = cssUrl,
): Promise<SnapshotProjectFontSession> {
  const path = snapshotPath(rootPath, '.ocfonts')
  const content = await fs.fileExists(path) ? await fs.readFile(path) : ''
  const registry = content ? parseProjectFontRegistryText(content) : {}
  if (!registry) throw new Error('Invalid snapshot project font registry')

  const cssFamilyPrefix = `OpenCardSnapshotFont-${++sessionSequence}`
  const context: ProjectFontResolutionContext = {
    fonts: registry.fonts ?? [],
    fontSets: registry.fontSets ?? [],
    cssFamilyPrefix,
  }
  let style: HTMLStyleElement | null = null
  if (typeof document !== 'undefined' && document.head && (registry.fonts?.length ?? 0) > 0) {
    style = document.createElement('style')
    style.dataset.opencardSnapshotFonts = cssFamilyPrefix
    style.textContent = (registry.fonts ?? []).map(font => (
      `@font-face { font-family: ${JSON.stringify(createProjectFontCssFamily(font.key).replace('OpenCardProjectFont', cssFamilyPrefix))}; `
      + `src: url(${JSON.stringify(resolveAsset(rootPath, font.source))}); font-weight: normal; font-style: normal; }`
    )).join('\n')
    ;(registry.fontSets ?? []).forEach(fontSet => {
      style!.textContent += `\n/* ${createProjectFontSetCssFamily(fontSet.key).replace('OpenCardProjectFontSet', `${cssFamilyPrefix}Set`)} */`
    })
    document.head.appendChild(style)
    await Promise.all((registry.fonts ?? []).map(async font => {
      try {
        if (document.fonts) await document.fonts.load(`16px ${JSON.stringify(`${cssFamilyPrefix}-${font.key}`)}`)
      } catch {
        // Keep the side renderable with the browser's fallback font.
      }
    }))
  }

  let released = false
  return {
    registry,
    context,
    release: () => {
      if (released) return
      released = true
      if (style) removeStyle(style)
    },
  }
}
