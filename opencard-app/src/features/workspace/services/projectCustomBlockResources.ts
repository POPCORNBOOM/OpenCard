import type { CardBlock } from '../../../entities/card/model'
import { visitCardBlockTree } from '../../../entities/card/tree'
import type { ProjectFontRegistry } from '../model/projectFontRegistry'
import type { ProjectRemoteResourcePolicy } from '../model/projectMetadata'
import { isRemoteResourceAllowed } from '../../editor-runtime/services/editorResource'
import type { FileSystemService } from './fileSystemService'
import type { ProjectCustomBlockResourceIndex } from '../model/projectCustomBlocks'
import { findProjectCustomBlockFile } from './projectCustomBlock'
import type { ProjectIconSeries } from '../model/projectIcons'
import { findProjectIcon, projectIconIdentity, type ProjectIconCatalog, type ProjectIconCatalogEntry } from './projectIconCatalog'
import {
  composeProjectCustomBlockIconAtlas,
  createProjectCustomBlockIconSeries,
  type ProjectCustomBlockIconAtlas,
} from './projectCustomBlockIconAtlas'
import {
  collectProjectIconReferences,
  rewriteProjectIconReferences,
} from '../../../shared/rich-text/projectIconReference'

export type CollectedCustomBlockResources = {
  files: ReadonlyMap<string, Uint8Array>
  index: ProjectCustomBlockResourceIndex
  imageSources: ReadonlyMap<string, string>
  fontSources: ReadonlyMap<string, string>
  fontFamilyReplacements: ReadonlyMap<string, string>
  iconReplacements: ReadonlyMap<string, { seriesKey: string; iconKey: string }>
}

type CustomBlockResourceCatalog = ReadonlyMap<string, {
  readonly manifest: {
    readonly key: string
    readonly resources?: ProjectCustomBlockResourceIndex
  }
  readonly files: ReadonlyMap<string, Uint8Array>
}>

export function createProjectCustomBlockFontFamily(packageKey: string, fontKey: string): string {
  return `OpenCardCustomBlock-${packageKey}-${fontKey}`
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
  return /\.([a-z0-9]+)$/i.exec(path)?.[1].toLowerCase() ?? fallback
}

export async function collectProjectCustomBlockResources(options: {
  root: CardBlock
  projectRootPath: string
  projectFonts?: ProjectFontRegistry
  remoteResourcePolicy?: ProjectRemoteResourcePolicy
  fs: Pick<FileSystemService, 'readBinaryFile'>
  fetchBytes?: (url: string) => Promise<Uint8Array>
  packageKey: string
  projectIconCatalog?: ProjectIconCatalog
  customBlockCatalog?: CustomBlockResourceCatalog
  composeIconAtlas?: (
    entries: readonly ProjectIconCatalogEntry[],
    loadSourceBytes: (entry: ProjectIconCatalogEntry) => Promise<Uint8Array>,
  ) => Promise<ProjectCustomBlockIconAtlas>
}): Promise<CollectedCustomBlockResources> {
  const imageSources = new Set<string>()
  const fontKeys = new Set<string>()
  const iconIdentities = new Map<string, { seriesKey: string; iconKey: string }>()
  const packagedFontFamilies = new Set<string>()
  visitCardBlockTree(options.root, block => {
    if (block.type === 'image-block' && block.image?.trim()) imageSources.add(block.image.trim())
    const fontFamily = 'fontFamily' in block ? block.fontFamily : undefined
    for (const entry of fontFamily?.split(';') ?? []) {
      const value = entry.trim()
      if (value.toLowerCase().startsWith('font:')) fontKeys.add(value.slice(5).toLowerCase())
      else if (value.toLowerCase().startsWith('opencardcustomblock-')) packagedFontFamilies.add(value.toLowerCase())
    }
    for (const value of Object.values(block)) {
      if (typeof value !== 'string') continue
      for (const reference of collectProjectIconReferences(value)) {
        iconIdentities.set(projectIconIdentity(reference.seriesKey, reference.iconKey), reference)
      }
    }
  })

  const files = new Map<string, Uint8Array>()
  const images: { key: string; source: string }[] = []
  const imageArchivePaths = new Map<string, string>()
  const fonts: { key: string; name: string; source: string }[] = []
  const imageSourceMap = new Map<string, string>()
  const fontSourceMap = new Map<string, string>()
  const fontFamilyReplacements = new Map<string, string>()
  const iconReplacements = new Map<string, { seriesKey: string; iconKey: string }>()
  let resourcesIconSeries: ProjectIconSeries[] = []
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
    } else if (source.toLowerCase().startsWith('ocblock:')) {
      const match = /^ocblock:([^/]+)\/(.+)$/i.exec(source)
      const packageKey = match?.[1]?.toLowerCase()
      const resourcePath = match?.[2]
      const entry = packageKey ? options.customBlockCatalog?.get(packageKey) : undefined
      const resourceBytes = entry && resourcePath
        ? findProjectCustomBlockFile(entry.files, resourcePath)
        : undefined
      if (!resourceBytes) {
        throw new Error(`Custom block image resource is missing: ${source}`)
      }
      bytes = resourceBytes
      extension = extensionOf(resourcePath!, 'bin')
    } else {
      const relative = source.replace(/\\/g, '/').replace(/^\/+/, '')
      if (relative.split('/').includes('..')) throw new Error(`Invalid custom block image path: ${source}`)
      bytes = await options.fs.readBinaryFile(`${root}/${relative}`)
    }
    const hash = await sha256(bytes)
    const archivePath = imageArchivePaths.get(hash) ?? `resources/images/${hash}.${extension}`
    imageArchivePaths.set(hash, archivePath)
    if (!files.has(archivePath)) files.set(archivePath, bytes)
    if (!images.some(image => image.key === hash)) images.push({ key: hash, source: archivePath })
    imageSourceMap.set(source, archivePath)
  }

  for (const key of fontKeys) {
    const font = Object.entries(options.projectFonts ?? {}).find(([candidate]) => candidate.toLowerCase() === key)?.[1]
    if (!font) throw new Error(`Custom block font is missing: font:${key}`)
    const bytes = await options.fs.readBinaryFile(`${root}/${font.source.replace(/\\/g, '/')}`)
    const hash = await sha256(bytes)
    const archivePath = `resources/fonts/${hash}.${extensionOf(font.source, 'bin')}`
    if (!files.has(archivePath)) files.set(archivePath, bytes)
    fonts.push({ key, name: font.name, source: archivePath })
    fontSourceMap.set(key, archivePath)
  }

  for (const family of packagedFontFamilies) {
    let match: { bytes: Uint8Array; name: string; source: string } | null = null
    for (const entry of options.customBlockCatalog?.values() ?? []) {
      for (const font of entry.manifest.resources?.fonts ?? []) {
        if (createProjectCustomBlockFontFamily(entry.manifest.key, font.key).toLowerCase() !== family) continue
        const bytes = findProjectCustomBlockFile(entry.files, font.source)
        if (!bytes) throw new Error(`Custom block font resource is missing: ${font.source}`)
        match = { bytes, name: font.name, source: font.source }
      }
    }
    if (!match) throw new Error(`Custom block font is missing: ${family}`)
    const hash = await sha256(match.bytes)
    const key = `font-${hash}`
    const archivePath = `resources/fonts/${hash}.${extensionOf(match.source, 'bin')}`
    if (!files.has(archivePath)) files.set(archivePath, match.bytes)
    if (!fonts.some(font => font.key === key)) fonts.push({ key, name: match.name, source: archivePath })
    fontFamilyReplacements.set(family, createProjectCustomBlockFontFamily(options.packageKey, key))
  }

  if (iconIdentities.size > 0) {
    const entries = [...iconIdentities.values()].map(reference => {
      const entry = findProjectIcon(options.projectIconCatalog, reference.seriesKey, reference.iconKey)
      if (!entry) throw new Error(`Custom block icon is missing: ${reference.seriesKey}/${reference.iconKey}`)
      return entry
    })
    const loadIconSourceBytes = async (icon: ProjectIconCatalogEntry): Promise<Uint8Array> => {
      for (const customBlock of options.customBlockCatalog?.values() ?? []) {
        const series = customBlock.manifest.resources?.iconSeries?.find(candidate => (
          candidate.key.toLowerCase() === icon.seriesKey.toLowerCase()
        ))
        if (!series) continue
        const bytes = findProjectCustomBlockFile(customBlock.files, series.source)
        if (!bytes) throw new Error(`Custom block icon resource is missing: ${series.source}`)
        return bytes
      }
      const relative = icon.source.replace(/\\/g, '/').replace(/^\/+/, '')
      if (!relative || relative.split('/').includes('..')) {
        throw new Error(`Invalid project icon path: ${icon.source}`)
      }
      return await options.fs.readBinaryFile(`${root}/${relative}`)
    }
    const atlas = await (options.composeIconAtlas ?? composeProjectCustomBlockIconAtlas)(entries, loadIconSourceBytes)
    const hash = await sha256(atlas.bytes)
    const archivePath = `resources/icons/${hash}.png`
    files.set(archivePath, atlas.bytes)
    const series = createProjectCustomBlockIconSeries({ packageKey: options.packageKey, source: archivePath, icons: atlas.icons })
    ;[...iconIdentities.entries()].forEach(([identity], index) => {
      iconReplacements.set(identity, { seriesKey: series.key, iconKey: atlas.icons[index]!.iconKey })
    })
    resourcesIconSeries = [series]
  }

  return {
    files,
    index: {
      ...(images.length ? { images } : {}),
      ...(fonts.length ? { fonts } : {}),
      ...(resourcesIconSeries.length ? { iconSeries: resourcesIconSeries } : {}),
    },
    imageSources: imageSourceMap,
    fontSources: fontSourceMap,
    fontFamilyReplacements,
    iconReplacements,
  }
}

export function rewriteProjectCustomBlockResourceReferences(
  root: CardBlock,
  packageKey: string,
  resources: CollectedCustomBlockResources,
): void {
  visitCardBlockTree(root, block => {
    if (block.type === 'image-block') {
      const archivePath = resources.imageSources.get(block.image)
      if (archivePath) block.image = `ocblock:${packageKey}/${archivePath}`
    }
    if ('fontFamily' in block && block.fontFamily) {
      block.fontFamily = block.fontFamily.split(';').map(entry => {
        const value = entry.trim()
        const packagedReplacement = resources.fontFamilyReplacements.get(value.toLowerCase())
        if (packagedReplacement) return packagedReplacement
        if (!value.toLowerCase().startsWith('font:')) return value
        const key = value.slice(5).toLowerCase()
        return resources.fontSources.has(key) ? createProjectCustomBlockFontFamily(packageKey, key) : value
      }).join('; ')
    }
    for (const [fieldKey, fieldValue] of Object.entries(block)) {
      if (typeof fieldValue !== 'string') continue
      const rewritten = rewriteProjectIconReferences(fieldValue, reference => (
        resources.iconReplacements.get(projectIconIdentity(reference.seriesKey, reference.iconKey)) ?? reference
      ))
      if (rewritten !== fieldValue) (block as unknown as Record<string, unknown>)[fieldKey] = rewritten
    }
  })
}
