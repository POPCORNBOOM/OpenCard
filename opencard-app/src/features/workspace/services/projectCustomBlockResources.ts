import type { CardBlock } from '../../../entities/card/model'
import type { ProjectFontRegistry } from '../model/projectFontRegistry'
import type { ProjectRemoteResourcePolicy } from '../model/projectMetadata'
import { isRemoteResourceAllowed } from '../../editor-runtime/services/editorResource'
import type { FileSystemService } from './fileSystemService'
import type { ProjectCustomBlockResourceIndex } from '../model/projectCustomBlocks'

export type CollectedCustomBlockResources = {
  files: ReadonlyMap<string, Uint8Array>
  index: ProjectCustomBlockResourceIndex
  imageSources: ReadonlyMap<string, string>
  fontSources: ReadonlyMap<string, string>
}

export function createProjectCustomBlockFontFamily(packageKey: string, fontKey: string): string {
  return `OpenCardCustomBlock-${packageKey}-${fontKey}`
}

function visitBlocks(root: CardBlock, visit: (block: CardBlock) => void): void {
  visit(root)
  if (root.type !== 'simple-container-block' && root.type !== 'flow-container-block') return
  for (const child of root.children) visitBlocks(child.block, visit)
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function decodeDataUrl(source: string): { bytes: Uint8Array; extension: string } | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(source)
  if (!match) return null
  const mime = match[1] ?? 'application/octet-stream'
  const decoded = match[2]
    ? Uint8Array.from(atob(match[3]), char => char.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(match[3]))
  const extension = mime === 'image/png' ? 'png'
    : mime === 'image/jpeg' ? 'jpg'
      : mime === 'image/webp' ? 'webp'
        : 'bin'
  return { bytes: decoded, extension }
}

function extensionOf(source: string, fallback: string): string {
  const path = source.split(/[?#]/, 1)[0]
  return /\.([a-z0-9]+)$/i.exec(path)?.[1].toLocaleLowerCase() ?? fallback
}

export async function collectProjectCustomBlockResources(options: {
  root: CardBlock
  projectRootPath: string
  projectFonts?: ProjectFontRegistry
  remoteResourcePolicy?: ProjectRemoteResourcePolicy
  fs: Pick<FileSystemService, 'readBinaryFile'>
  fetchBytes?: (url: string) => Promise<Uint8Array>
}): Promise<CollectedCustomBlockResources> {
  const imageSources = new Set<string>()
  const fontKeys = new Set<string>()
  visitBlocks(options.root, block => {
    if (block.type === 'image-block' && block.image?.trim()) imageSources.add(block.image.trim())
    const fontFamily = 'fontFamily' in block ? block.fontFamily : undefined
    for (const entry of fontFamily?.split(';') ?? []) {
      const value = entry.trim()
      if (value.toLocaleLowerCase().startsWith('font:')) fontKeys.add(value.slice(5).toLocaleLowerCase())
    }
  })

  const files = new Map<string, Uint8Array>()
  const images: { key: string; source: string }[] = []
  const fonts: { key: string; name: string; source: string }[] = []
  const imageSourceMap = new Map<string, string>()
  const fontSourceMap = new Map<string, string>()
  const root = options.projectRootPath.replace(/\\/g, '/').replace(/\/$/, '')

  for (const source of imageSources) {
    let bytes: Uint8Array
    let extension = extensionOf(source, 'bin')
    const data = decodeDataUrl(source)
    if (data) {
      bytes = data.bytes
      extension = data.extension
    } else if (/^https?:\/\//i.test(source)) {
      if (!isRemoteResourceAllowed(source, options.remoteResourcePolicy) || !options.fetchBytes) {
        throw new Error(`Custom block image cannot be downloaded: ${source}`)
      }
      bytes = await options.fetchBytes(source)
    } else {
      const relative = source.replace(/\\/g, '/').replace(/^\/+/, '')
      if (relative.split('/').includes('..')) throw new Error(`Invalid custom block image path: ${source}`)
      bytes = await options.fs.readBinaryFile(`${root}/${relative}`)
    }
    const hash = await sha256(bytes)
    const archivePath = `resources/images/${hash}.${extension}`
    if (!files.has(archivePath)) files.set(archivePath, bytes)
    images.push({ key: hash, source: archivePath })
    imageSourceMap.set(source, archivePath)
  }

  for (const key of fontKeys) {
    const font = Object.entries(options.projectFonts ?? {}).find(([candidate]) => candidate.toLocaleLowerCase() === key)?.[1]
    if (!font) throw new Error(`Custom block font is missing: font:${key}`)
    const bytes = await options.fs.readBinaryFile(`${root}/${font.source.replace(/\\/g, '/')}`)
    const hash = await sha256(bytes)
    const archivePath = `resources/fonts/${hash}.${extensionOf(font.source, 'bin')}`
    if (!files.has(archivePath)) files.set(archivePath, bytes)
    fonts.push({ key, name: font.name, source: archivePath })
    fontSourceMap.set(key, archivePath)
  }

  return {
    files,
    index: {
      ...(images.length ? { images } : {}),
      ...(fonts.length ? { fonts } : {}),
    },
    imageSources: imageSourceMap,
    fontSources: fontSourceMap,
  }
}

export function rewriteProjectCustomBlockResourceReferences(
  root: CardBlock,
  packageKey: string,
  resources: CollectedCustomBlockResources,
): void {
  visitBlocks(root, block => {
    if (block.type === 'image-block') {
      const archivePath = resources.imageSources.get(block.image)
      if (archivePath) block.image = `ocblock:${packageKey}/${archivePath}`
    }
    if ('fontFamily' in block && block.fontFamily) {
      block.fontFamily = block.fontFamily.split(';').map(entry => {
        const value = entry.trim()
        if (!value.toLocaleLowerCase().startsWith('font:')) return value
        const key = value.slice(5).toLocaleLowerCase()
        return resources.fontSources.has(key) ? createProjectCustomBlockFontFamily(packageKey, key) : value
      }).join('; ')
    }
  })
}
